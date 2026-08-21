import {neon} from '@neondatabase/serverless';
import {createGunzip} from 'node:zlib';
import {Readable} from 'node:stream';
import {createInterface} from 'node:readline';

const databaseUrl=process.env.DATABASE_URL;if(!databaseUrl)throw new Error('Falta DATABASE_URL');
const imdbId=String(process.env.IMDB_ID||'').trim();if(!/^tt\d+$/.test(imdbId))throw new Error('IMDB_ID inválido');
const sql=neon(databaseUrl),RATINGS='https://datasets.imdbws.com/title.ratings.tsv.gz',BASICS='https://datasets.imdbws.com/title.basics.tsv.gz';
const targetNum=Number(imdbId.slice(2));
const nowIso=()=>new Date().toISOString();
const isSeries=t=>t==='tvSeries'||t==='tvMiniSeries';
const omdbKey=()=>process.env.OMDB_API_KEY||process.env.OMDB_APIKEY||process.env.OMDB_KEY||null;
function firstYear(v){const m=String(v||'').match(/(19|20)\d{2}/);return m?Number(m[0]):null}
function mapOmdbType(v){const t=String(v||'').toLowerCase();if(t==='movie')return'movie';if(t==='series')return'tvSeries';return null}
function votesOrNull(v){if(v==null||v==='N/A')return null;const digits=String(v).replace(/[^0-9]/g,'');return digits?Number(digits):null}
async function stream(url){const r=await fetch(url,{headers:{'User-Agent':'PikoFilm/3.0 personal-noncommercial-single-discovery'}});if(!r.ok||!r.body)throw new Error(`IMDb dataset HTTP ${r.status}: ${url}`);return Readable.fromWeb(r.body).pipe(createGunzip())}
async function findRating(){const rl=createInterface({input:await stream(RATINGS),crlfDelay:Infinity});let head=true;for await(const line of rl){if(head){head=false;continue}const[id,r,v]=line.split('\t'),n=Number(id.slice(2));if(id===imdbId)return{rating:Number(r),votes:Number(v)};if(Number.isFinite(n)&&n>targetNum)break}return{rating:null,votes:null}}
async function findBasics(){const rl=createInterface({input:await stream(BASICS),crlfDelay:Infinity});let head=true;for await(const line of rl){if(head){head=false;continue}const p=line.split('\t'),id=p[0],n=Number(id.slice(2));if(id===imdbId){const type=p[1];return{candidate_type:type==='movie'||isSeries(type)?type:null,title:p[2]==='\\N'?null:p[2],year:Number(p[5])||null}}if(Number.isFinite(n)&&n>targetNum)break}return null}
async function omdb(){const key=omdbKey();if(!key)return null;try{const r=await fetch(`https://www.omdbapi.com/?apikey=${encodeURIComponent(key)}&i=${encodeURIComponent(imdbId)}&plot=short&r=json`,{headers:{'User-Agent':'PikoFilm/3.0'},signal:AbortSignal.timeout(10000)});if(!r.ok)return null;const j=await r.json();if(j?.Response==='False')return null;const rating=j?.imdbRating&&j.imdbRating!=='N/A'?Number(j.imdbRating):null;return{candidate_type:mapOmdbType(j?.Type),title:j?.Title&&j.Title!=='N/A'?j.Title:null,year:firstYear(j?.Year),rating:Number.isFinite(rating)?rating:null,votes:votesOrNull(j?.imdbVotes)}}catch{return null}}
async function adminEvent(action,payload){try{await sql`INSERT INTO admin_events(event_type,entity_type,entity_id,action,payload,created_at) VALUES('news','candidate',${imdbId},${action},${JSON.stringify(payload)}::jsonb,now())`}catch{}}
async function currentAttempt(){try{const [r]=await sql`SELECT source_snapshot->>'authoritativeAttempts' AS attempts FROM catalog_candidates WHERE imdb_id=${imdbId} LIMIT 1`;return Number(r?.attempts||0)||1}catch{return 1}}
async function markFailed(e){const when=nowIso(),message=e?.message||String(e),attempt=await currentAttempt();try{await sql`UPDATE catalog_candidates SET source_snapshot=COALESCE(source_snapshot,'{}'::jsonb)||${JSON.stringify({authoritativeStatus:'failed',manualAuthoritativeFailedAt:when,manualAuthoritativeError:message})}::jsonb,updated_at=now() WHERE imdb_id=${imdbId}`}catch{}await adminEvent('manual_authoritative_failed',{attempt,error:message});}
async function main(){
  const o=await omdb();
  let basics=o?{candidate_type:o.candidate_type,title:o.title,year:o.year}:null,rating=o?{rating:o.rating,votes:o.votes}:null,source='omdb';
  if(!basics?.candidate_type||!basics?.title||!basics?.year){basics=await findBasics();source=source==='omdb'?'omdb+datasets':'datasets'}
  if(rating?.rating==null||rating?.votes==null){rating=await findRating();source=source==='omdb'?'omdb+datasets':'datasets'}
  if(!basics?.candidate_type||!basics?.title||!basics?.year||rating?.rating==null||rating?.votes==null)throw new Error('No se pudieron completar los mínimos del candidato');
  const [existing]=await sql`SELECT source_snapshot FROM catalog_candidates WHERE imdb_id=${imdbId} LIMIT 1`;const prior=existing?.source_snapshot||{},attempt=Number(prior.authoritativeAttempts||0)||1;
  const snap={...prior,title:basics.title||prior.title||imdbId,originalTitle:basics.title||prior.originalTitle||imdbId,manual:true,manualActive:true,matchedRule:'manual',discoveryVersion:'novedades-v1',discoveredAt:prior.discoveredAt||nowIso(),manualAuthoritativeResolvedAt:nowIso(),manualResolver:source,authoritativeStatus:'complete',manualAuthoritativeError:null,minimums:{imdb:true,title:true,year:true,type:true,rating:true,votes:true}};
  await sql`INSERT INTO catalog_candidates(imdb_id,candidate_type,year,imdb_rating,imdb_votes,eligibility_status,first_seen_at,last_seen_at,became_eligible_at,last_evaluated_at,source_snapshot,created_at,updated_at)
    VALUES(${imdbId},${basics.candidate_type},${basics.year},${rating.rating},${rating.votes},'eligible',now(),now(),now(),now(),${JSON.stringify(snap)}::jsonb,now(),now())
    ON CONFLICT(imdb_id) DO UPDATE SET candidate_type=EXCLUDED.candidate_type,year=EXCLUDED.year,imdb_rating=EXCLUDED.imdb_rating,imdb_votes=EXCLUDED.imdb_votes,eligibility_status='eligible',became_eligible_at=COALESCE(catalog_candidates.became_eligible_at,now()),last_seen_at=now(),last_evaluated_at=now(),source_snapshot=EXCLUDED.source_snapshot,updated_at=now()`;
  await adminEvent('manual_authoritative_resolved',{attempt,rating:rating.rating,votes:rating.votes,type:basics.candidate_type,year:basics.year,source});
  console.log(JSON.stringify({imdbId,attempt,...basics,...rating,source},null,2));
}
main().catch(async e=>{await markFailed(e);console.error(e);process.exit(1)});

import {neon} from '@neondatabase/serverless';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

const dbUrl=process.env.DATABASE_URL;
const runId=Number(process.env.PIPELINE_RUN_ID||0);
const imdbId=String(process.env.IDENTITY_IMDB_ID||'').trim();
const base=process.env.PIKOFILM_URL||'https://imdb-catalog-eight.vercel.app';
if(!dbUrl)throw new Error('Falta DATABASE_URL');
if(!runId)throw new Error('Falta PIPELINE_RUN_ID');
if(!/^tt\d+$/.test(imdbId))throw new Error('IDENTITY_IMDB_ID inválido');
const sql=neon(dbUrl),token=crypto.createHash('sha256').update(dbUrl).digest('hex');
async function audit(action,payload={}){try{await sql`INSERT INTO admin_events(event_type,entity_type,entity_id,action,payload,created_at) VALUES('identity','identity_refresh',${String(runId)},${action},${JSON.stringify(payload)}::jsonb,now())`}catch{}}
async function finish(status,summary,errors=0,updated=0){await sql`UPDATE pipeline_runs SET status=${status},finished_at=now(),processed_count=1,updated_count=${updated},error_count=${errors},summary=COALESCE(summary,'{}'::jsonb)||${JSON.stringify(summary)}::jsonb,updated_at=now() WHERE id=${runId}`}
async function post(path,payload){const r=await fetch(`${base}${path}`,{method:'POST',headers:{'content-type':'application/json','x-pikofilm-worker':token},body:JSON.stringify(payload)});if(!r.ok)throw new Error(`${path} HTTP ${r.status}: ${(await r.text()).slice(0,220)}`);return r.json()}
async function main(){
  const [row]=await sql`SELECT m.imdb_id,COALESCE(m.title_es,m.title,m.original_title) title,m.original_title,m.title_es,m.year,m.tmdb_id,m.fa_id FROM movies m LEFT JOIN catalog_exclusions ex USING(imdb_id) WHERE ex.imdb_id IS NULL AND m.imdb_id=${imdbId}`;
  if(!row)throw new Error('Título no encontrado o excluido');
  await sql`UPDATE pipeline_runs SET source='github',summary=COALESCE(summary,'{}'::jsonb)||${JSON.stringify({stage:'running',scope:'single',imdb_id:imdbId,current_title:row.title,progress_pct:5})}::jsonb,updated_at=now() WHERE id=${runId}`;
  await audit('single_started',{imdb_id:imdbId,title:row.title});
  let tmdbId=row.tmdb_id||null,faId=row.fa_id||null,tmdbMethod=null,faMethod=null;
  if(!tmdbId){
    const res=await post('/api/identity/batch',{runId,ids:[imdbId],mode:'tmdb'}),x=res.results?.[0];
    if(x?.ok&&x.updated)tmdbMethod='tmdb_batch';
    const [fresh]=await sql`SELECT tmdb_id FROM movies WHERE imdb_id=${imdbId}`;tmdbId=fresh?.tmdb_id||null;
  }
  await sql`UPDATE pipeline_runs SET summary=COALESCE(summary,'{}'::jsonb)||${JSON.stringify({stage:'running',current_block:'FilmAffinity',progress_pct:45,tmdb_id:tmdbId})}::jsonb,updated_at=now() WHERE id=${runId}`;
  if(!faId){
    const wiki=await post('/api/identity/wiki-batch',{runId,ids:[imdbId]}),w=wiki.results?.[0];
    if(w?.faId){faId=String(w.faId);faMethod='wikidata'}
    if(!faId){
      const [fresh]=await sql`SELECT imdb_id,COALESCE(title_es,title,original_title) title,original_title,title_es,year FROM movies WHERE imdb_id=${imdbId}`;
      const p=spawnSync('python',['worker/fa-id-search.py'],{input:JSON.stringify([fresh]),encoding:'utf8',timeout:180000});
      if(p.error)throw p.error;if(p.status!==0)throw new Error((p.stderr||'FilmAffinity helper falló').slice(-500));
      let out=[];try{out=JSON.parse((p.stdout||'[]').trim())}catch{throw new Error('Respuesta inválida de fa-id-search.py')}
      const x=out.find(v=>v.imdb_id===imdbId)||out[0];
      if(x?.circuit_breaker)throw new Error(`FilmAffinity bloqueado: ${x.reason||'protección activa'}`);
      if(x?.fa_id){faId=String(x.fa_id);faMethod=`python_${x.status||'high'}`;const patch=JSON.stringify({identity_resolver:`fa_python_${x.status||'high'}_github`,identity_resolved_at:new Date().toISOString(),identity_refresh_state:'pending',identity_refresh_reason:'identity_completed',identity_refresh_marked_at:new Date().toISOString(),identity_completed_at:new Date().toISOString(),fa_search:{status:x.status||'unknown',fa_id:faId,best_fa_id:x.best_fa_id||faId,confidence:Number(x.confidence||0),margin:Number(x.margin||0),attempted_at:new Date().toISOString(),run_id:runId}});await sql`UPDATE movies SET fa_id=${faId},fa_url=${'https://www.filmaffinity.com/es/film'+faId+'.html'},source_status=COALESCE(source_status,'{}'::jsonb)||${patch}::jsonb,synced_at=now() WHERE imdb_id=${imdbId}`}
      else {const status=x?.status||'not_found';const data={status,best_fa_id:x?.best_fa_id||null,confidence:Number(x?.confidence||0),margin:Number(x?.margin||0),attempted_at:new Date().toISOString(),run_id:runId};await sql`UPDATE movies SET source_status=COALESCE(source_status,'{}'::jsonb)||jsonb_build_object('fa_search',${JSON.stringify(data)}::jsonb),synced_at=now() WHERE imdb_id=${imdbId}`}
    }
  }
  const [final]=await sql`SELECT tmdb_id,fa_id FROM movies WHERE imdb_id=${imdbId}`;tmdbId=final?.tmdb_id||null;faId=final?.fa_id||null;
  const complete=Boolean(tmdbId&&faId),nextState=complete?'IDENTITY_VALIDATION':'IDENTITY_PENDING';
  const summary={stage:'done',scope:'single',imdb_id:imdbId,title:row.title,progress_pct:100,tmdb_id:tmdbId,fa_id:faId,tmdb_method:tmdbMethod,fa_method:faMethod,identity_complete:complete,next_state:nextState,missing:[!tmdbId?'TMDb':null,!faId?'FilmAffinity':null].filter(Boolean)};
  await finish('success',summary,0,Number(Boolean(tmdbMethod))+Number(Boolean(faMethod)));
  await audit('single_completed',summary);console.log(JSON.stringify(summary,null,2));
}
main().catch(async e=>{const summary={stage:'failed',scope:'single',imdb_id:imdbId,error:{message:e?.message||String(e)}};try{await finish('failed',summary,1,0);await audit('single_failed',summary)}catch{}console.error(e);process.exit(1)});

import 'server-only';
import {db} from './db';
import {omdbMinimumByImdb} from './omdb-minimum';

const toCandidateType=itemType=>itemType==='movie'?'movie':'tvSeries';
const hasMinimums=r=>Boolean(r.imdb_id&&r.title&&r.title!==r.imdb_id&&r.candidate_type);

async function pool(items,limit,fn){let idx=0;await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(idx<items.length){const item=items[idx++];await fn(item)}}))}

export async function seedPlexNewsCandidates({resolveLimit=25}={}){
  const sql=db();
  const rows=await sql`
    SELECT p.rating_key,p.plex_title,p.plex_year,p.item_type,x.external_id imdb_id,c.imdb_rating,c.imdb_votes,c.candidate_type,c.year,c.eligibility_status,c.source_snapshot
    FROM plex_items p
    JOIN plex_external_ids x ON x.rating_key=p.rating_key AND x.provider='imdb'
    LEFT JOIN movies m ON m.imdb_id=x.external_id
    LEFT JOIN catalog_exclusions ex ON ex.imdb_id=x.external_id
    LEFT JOIN catalog_candidates c ON c.imdb_id=x.external_id
    WHERE p.active AND p.item_type IN('movie','show') AND m.imdb_id IS NULL AND ex.imdb_id IS NULL
    ORDER BY p.added_at DESC NULLS LAST`;

  let seeded=0,resolved=0,failed=0;
  const normalized=rows.map(r=>({...r,title:r.source_snapshot?.title||r.plex_title||r.imdb_id,year:r.year||r.plex_year||null,candidate_type:r.candidate_type||toCandidateType(r.item_type)}));

  for(const r of normalized){
    const ready=hasMinimums(r);
    const snap={origin:'plex',matchedRule:'plex',title:r.title,originalTitle:r.title,plexRatingKey:r.rating_key,plexYear:r.plex_year||null,plexDetectedAt:new Date().toISOString(),discoveryVersion:'novedades-v1',minimums:{imdb:true,title:Boolean(r.title&&r.title!==r.imdb_id),year:Boolean(r.year),type:Boolean(r.candidate_type),rating:r.imdb_rating!=null,votes:r.imdb_votes!=null}};
    await sql`INSERT INTO catalog_candidates(imdb_id,candidate_type,year,imdb_rating,imdb_votes,eligibility_status,first_seen_at,last_seen_at,became_eligible_at,last_evaluated_at,source_snapshot,created_at,updated_at)
      VALUES(${r.imdb_id},${r.candidate_type},${r.year},${r.imdb_rating??null},${r.imdb_votes??null},${ready?'eligible':'processing'},now(),now(),${ready?new Date():null},now(),${JSON.stringify(snap)}::jsonb,now(),now())
      ON CONFLICT(imdb_id) DO UPDATE SET candidate_type=COALESCE(catalog_candidates.candidate_type,EXCLUDED.candidate_type),year=COALESCE(catalog_candidates.year,EXCLUDED.year),last_seen_at=now(),eligibility_status=CASE WHEN catalog_candidates.eligibility_status='catalogued' THEN 'catalogued' WHEN ${ready} THEN 'eligible' ELSE 'processing' END,became_eligible_at=CASE WHEN ${ready} THEN COALESCE(catalog_candidates.became_eligible_at,now()) ELSE catalog_candidates.became_eligible_at END,last_evaluated_at=now(),source_snapshot=COALESCE(catalog_candidates.source_snapshot,'{}'::jsonb)||EXCLUDED.source_snapshot,updated_at=now()`;
    seeded++;
  }

  const pending=normalized.filter(r=>!hasMinimums(r)).slice(0,Math.max(0,Number(resolveLimit)||0));
  const omdb=new Map();
  await pool(pending,5,async r=>{try{const d=await omdbMinimumByImdb(r.imdb_id,{timeoutMs:8000});if(d)omdb.set(r.imdb_id,d)}catch{}});

  for(const r of pending){
    try{
      const d=omdb.get(r.imdb_id)||null;
      const final={imdb_id:r.imdb_id,title:d?.title||r.title||r.plex_title||r.imdb_id,year:d?.year||r.year||r.plex_year||null,candidate_type:d?.candidate_type||r.candidate_type||toCandidateType(r.item_type),imdb_rating:r.imdb_rating??d?.imdb_rating??null,imdb_votes:r.imdb_votes??d?.imdb_votes??null};
      const ready=hasMinimums(final);
      const snap={origin:'plex',matchedRule:'plex',title:final.title,originalTitle:final.title,plexRatingKey:r.rating_key,plexDetectedAt:new Date().toISOString(),omdbStatus:d?'complete':'unavailable',omdbResolvedAt:d?new Date().toISOString():null,minimums:{imdb:true,title:Boolean(final.title&&final.title!==r.imdb_id),year:Boolean(final.year),type:Boolean(final.candidate_type),rating:final.imdb_rating!=null,votes:final.imdb_votes!=null}};
      await sql`UPDATE catalog_candidates SET candidate_type=COALESCE(${final.candidate_type},candidate_type),year=COALESCE(${final.year},year),imdb_rating=COALESCE(imdb_rating,${final.imdb_rating}),imdb_votes=COALESCE(imdb_votes,${final.imdb_votes}),eligibility_status=CASE WHEN eligibility_status='catalogued' THEN 'catalogued' WHEN ${ready} THEN 'eligible' ELSE 'processing' END,became_eligible_at=CASE WHEN ${ready} THEN COALESCE(became_eligible_at,now()) ELSE became_eligible_at END,last_evaluated_at=now(),source_snapshot=COALESCE(source_snapshot,'{}'::jsonb)||${JSON.stringify(snap)}::jsonb,updated_at=now() WHERE imdb_id=${r.imdb_id}`;
      if(ready)resolved++;
    }catch(e){failed++;await sql`UPDATE catalog_candidates SET source_snapshot=COALESCE(source_snapshot,'{}'::jsonb)||${JSON.stringify({origin:'plex',matchedRule:'plex',plexResolveError:String(e?.message||e),plexResolveFailedAt:new Date().toISOString()})}::jsonb,updated_at=now() WHERE imdb_id=${r.imdb_id}`}
  }

  const[left]=await sql`SELECT count(*)::int n FROM catalog_candidates c LEFT JOIN movies m USING(imdb_id) LEFT JOIN catalog_exclusions ex USING(imdb_id) WHERE m.imdb_id IS NULL AND ex.imdb_id IS NULL AND c.source_snapshot->>'origin'='plex' AND c.eligibility_status='processing'`;
  return{seeded,resolved,failed,pending:Number(left?.n||0)};
}

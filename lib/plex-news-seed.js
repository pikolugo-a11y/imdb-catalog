import 'server-only';
import {db} from './db';
import {resolveManualNewsCandidate} from './news-manual-resolver';

const toCandidateType=itemType=>itemType==='movie'?'movie':'tvSeries';

export async function seedPlexNewsCandidates({resolveLimit=25}={}){
  const sql=db();
  const rows=await sql`
    SELECT p.rating_key,p.plex_title,p.plex_year,p.item_type,x.external_id imdb_id,c.imdb_rating,c.imdb_votes,c.candidate_type
    FROM plex_items p
    JOIN plex_external_ids x ON x.rating_key=p.rating_key AND x.provider='imdb'
    LEFT JOIN movies m ON m.imdb_id=x.external_id
    LEFT JOIN catalog_exclusions ex ON ex.imdb_id=x.external_id
    LEFT JOIN catalog_candidates c ON c.imdb_id=x.external_id
    WHERE p.active AND p.item_type IN('movie','show') AND m.imdb_id IS NULL AND ex.imdb_id IS NULL
    ORDER BY p.added_at DESC NULLS LAST`;

  let seeded=0,resolved=0,failed=0;
  for(const r of rows){
    const snap={origin:'plex',matchedRule:'plex',title:r.plex_title||r.imdb_id,originalTitle:r.plex_title||r.imdb_id,plexRatingKey:r.rating_key,plexYear:r.plex_year||null,plexDetectedAt:new Date().toISOString(),discoveryVersion:'novedades-v1'};
    const alreadyReady=r.imdb_rating!=null&&r.imdb_votes!=null&&r.candidate_type;
    await sql`
      INSERT INTO catalog_candidates(imdb_id,candidate_type,year,imdb_rating,imdb_votes,eligibility_status,first_seen_at,last_seen_at,became_eligible_at,last_evaluated_at,source_snapshot,created_at,updated_at)
      VALUES(${r.imdb_id},${toCandidateType(r.item_type)},${r.plex_year||null},${r.imdb_rating??null},${r.imdb_votes??null},${alreadyReady?'eligible':'processing'},now(),now(),${alreadyReady?new Date():null},now(),${JSON.stringify(snap)}::jsonb,now(),now())
      ON CONFLICT(imdb_id) DO UPDATE SET candidate_type=COALESCE(catalog_candidates.candidate_type,EXCLUDED.candidate_type),year=COALESCE(catalog_candidates.year,EXCLUDED.year),last_seen_at=now(),eligibility_status=CASE WHEN catalog_candidates.eligibility_status='catalogued' THEN 'catalogued' WHEN catalog_candidates.imdb_rating IS NOT NULL AND catalog_candidates.imdb_votes IS NOT NULL THEN 'eligible' ELSE 'processing' END,became_eligible_at=CASE WHEN catalog_candidates.imdb_rating IS NOT NULL AND catalog_candidates.imdb_votes IS NOT NULL THEN COALESCE(catalog_candidates.became_eligible_at,now()) ELSE catalog_candidates.became_eligible_at END,source_snapshot=COALESCE(catalog_candidates.source_snapshot,'{}'::jsonb)||EXCLUDED.source_snapshot,updated_at=now()`;
    seeded++;
  }

  const pending=rows.filter(r=>r.imdb_rating==null||r.imdb_votes==null||!r.candidate_type).slice(0,Math.max(0,Number(resolveLimit)||0));
  for(const r of pending){
    try{
      const d=await resolveManualNewsCandidate(r.imdb_id),ready=Boolean(d.candidate_type&&d.year&&d.imdb_rating!=null&&d.imdb_votes!=null);
      const snap={...d.source_snapshot,manual:false,manualActive:false,origin:'plex',matchedRule:'plex',plexRatingKey:r.rating_key,plexDetectedAt:new Date().toISOString()};
      await sql`UPDATE catalog_candidates SET candidate_type=COALESCE(${d.candidate_type},candidate_type),year=COALESCE(${d.year},year),imdb_rating=COALESCE(${d.imdb_rating},imdb_rating),imdb_votes=COALESCE(${d.imdb_votes},imdb_votes),eligibility_status=${ready?'eligible':'processing'},became_eligible_at=CASE WHEN ${ready} THEN COALESCE(became_eligible_at,now()) ELSE became_eligible_at END,last_evaluated_at=now(),source_snapshot=COALESCE(source_snapshot,'{}'::jsonb)||${JSON.stringify(snap)}::jsonb,updated_at=now() WHERE imdb_id=${r.imdb_id}`;
      resolved++;
    }catch(e){failed++;await sql`UPDATE catalog_candidates SET source_snapshot=COALESCE(source_snapshot,'{}'::jsonb)||${JSON.stringify({origin:'plex',matchedRule:'plex',plexResolveError:String(e?.message||e),plexResolveFailedAt:new Date().toISOString()})}::jsonb,updated_at=now() WHERE imdb_id=${r.imdb_id}`}
  }

  const [left]=await sql`SELECT count(*)::int n FROM catalog_candidates c LEFT JOIN movies m USING(imdb_id) LEFT JOIN catalog_exclusions ex USING(imdb_id) WHERE m.imdb_id IS NULL AND ex.imdb_id IS NULL AND c.source_snapshot->>'origin'='plex' AND c.eligibility_status='processing'`;
  return{seeded,resolved,failed,pending:Number(left?.n||0)};
}

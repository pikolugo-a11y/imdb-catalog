import 'server-only';
import {db} from './db';
import {imdbRatingsFromOfficialDataset} from './imdb-rating-on-demand';

const toCandidateType=itemType=>itemType==='movie'?'movie':'tvSeries';
const hasMinimums=r=>Boolean(r.imdb_id&&r.plex_title&&r.plex_year&&toCandidateType(r.item_type)&&r.imdb_rating!=null&&r.imdb_votes!=null);

export async function seedPlexNewsCandidates({resolveLimit=25}={}){
  const sql=db();
  const rows=await sql`
    SELECT p.rating_key,p.plex_title,p.plex_year,p.item_type,x.external_id imdb_id,c.imdb_rating,c.imdb_votes,c.candidate_type,c.eligibility_status
    FROM plex_items p
    JOIN plex_external_ids x ON x.rating_key=p.rating_key AND x.provider='imdb'
    LEFT JOIN movies m ON m.imdb_id=x.external_id
    LEFT JOIN catalog_exclusions ex ON ex.imdb_id=x.external_id
    LEFT JOIN catalog_candidates c ON c.imdb_id=x.external_id
    WHERE p.active AND p.item_type IN('movie','show') AND m.imdb_id IS NULL AND ex.imdb_id IS NULL
    ORDER BY p.added_at DESC NULLS LAST`;

  let seeded=0,resolved=0,failed=0;
  for(const r of rows){
    const type=toCandidateType(r.item_type),ready=hasMinimums(r);
    const snap={origin:'plex',matchedRule:'plex',title:r.plex_title||r.imdb_id,originalTitle:r.plex_title||r.imdb_id,plexRatingKey:r.rating_key,plexYear:r.plex_year||null,plexDetectedAt:new Date().toISOString(),discoveryVersion:'novedades-v1',minimums:{imdb:true,title:Boolean(r.plex_title),year:Boolean(r.plex_year),type:Boolean(type),rating:r.imdb_rating!=null,votes:r.imdb_votes!=null}};
    await sql`
      INSERT INTO catalog_candidates(imdb_id,candidate_type,year,imdb_rating,imdb_votes,eligibility_status,first_seen_at,last_seen_at,became_eligible_at,last_evaluated_at,source_snapshot,created_at,updated_at)
      VALUES(${r.imdb_id},${type},${r.plex_year||null},${r.imdb_rating??null},${r.imdb_votes??null},${ready?'eligible':'processing'},now(),now(),${ready?new Date():null},now(),${JSON.stringify(snap)}::jsonb,now(),now())
      ON CONFLICT(imdb_id) DO UPDATE SET
        candidate_type=COALESCE(catalog_candidates.candidate_type,EXCLUDED.candidate_type),
        year=COALESCE(catalog_candidates.year,EXCLUDED.year),
        last_seen_at=now(),
        eligibility_status=CASE WHEN catalog_candidates.eligibility_status='catalogued' THEN 'catalogued' WHEN ${ready} THEN 'eligible' ELSE 'processing' END,
        became_eligible_at=CASE WHEN ${ready} THEN COALESCE(catalog_candidates.became_eligible_at,now()) ELSE catalog_candidates.became_eligible_at END,
        last_evaluated_at=now(),
        source_snapshot=COALESCE(catalog_candidates.source_snapshot,'{}'::jsonb)||EXCLUDED.source_snapshot,
        updated_at=now()`;
    seeded++;
  }

  const pending=rows.filter(r=>!hasMinimums(r)).slice(0,Math.max(0,Number(resolveLimit)||0));
  const needRatings=pending.filter(r=>r.imdb_rating==null||r.imdb_votes==null).map(r=>r.imdb_id);
  const ratings=await imdbRatingsFromOfficialDataset(needRatings,{timeoutMs:30000});

  for(const r of pending){
    try{
      const rating=ratings.get(r.imdb_id)||null;
      const finalRating=r.imdb_rating??rating?.rating??null,finalVotes=r.imdb_votes??rating?.votes??null,type=toCandidateType(r.item_type);
      const ready=Boolean(r.imdb_id&&r.plex_title&&r.plex_year&&type&&finalRating!=null&&finalVotes!=null);
      const snap={origin:'plex',matchedRule:'plex',plexRatingKey:r.rating_key,plexDetectedAt:new Date().toISOString(),minimums:{imdb:true,title:Boolean(r.plex_title),year:Boolean(r.plex_year),type:Boolean(type),rating:finalRating!=null,votes:finalVotes!=null},imdb_ratings_source:rating?.source||null,imdb_ratings_updated_at:rating?new Date().toISOString():null};
      await sql`UPDATE catalog_candidates SET candidate_type=COALESCE(candidate_type,${type}),year=COALESCE(year,${r.plex_year||null}),imdb_rating=COALESCE(imdb_rating,${finalRating}),imdb_votes=COALESCE(imdb_votes,${finalVotes}),eligibility_status=CASE WHEN eligibility_status='catalogued' THEN 'catalogued' WHEN ${ready} THEN 'eligible' ELSE 'processing' END,became_eligible_at=CASE WHEN ${ready} THEN COALESCE(became_eligible_at,now()) ELSE became_eligible_at END,last_evaluated_at=now(),source_snapshot=COALESCE(source_snapshot,'{}'::jsonb)||${JSON.stringify(snap)}::jsonb,updated_at=now() WHERE imdb_id=${r.imdb_id}`;
      if(ready)resolved++;
    }catch(e){failed++;await sql`UPDATE catalog_candidates SET source_snapshot=COALESCE(source_snapshot,'{}'::jsonb)||${JSON.stringify({origin:'plex',matchedRule:'plex',plexResolveError:String(e?.message||e),plexResolveFailedAt:new Date().toISOString()})}::jsonb,updated_at=now() WHERE imdb_id=${r.imdb_id}`}
  }

  const [left]=await sql`SELECT count(*)::int n FROM catalog_candidates c LEFT JOIN movies m USING(imdb_id) LEFT JOIN catalog_exclusions ex USING(imdb_id) WHERE m.imdb_id IS NULL AND ex.imdb_id IS NULL AND c.source_snapshot->>'origin'='plex' AND c.eligibility_status='processing'`;
  return{seeded,resolved,failed,pending:Number(left?.n||0)};
}

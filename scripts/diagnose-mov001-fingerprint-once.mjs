import {neon} from '@neondatabase/serverless';
import {ratingPhysicalFingerprint} from '../lib/mov001-canonical.mjs';

const imdbId=process.argv[2];
if(!/^tt\d+$/.test(String(imdbId||''))) throw new Error('IMDb ID inválido');
if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL no está configurada');
const sql=neon(process.env.DATABASE_URL);
const rows=await sql`SELECT p.rating_key,pf.media_index,pf.part_index,pf.file_path,pf.file_size_bytes,pf.duration_ms file_duration_ms,pm.duration_ms media_duration_ms,COALESCE(pf.duration_ms,pm.duration_ms) duration_ms,pf.plex_part_id FROM plex_items p JOIN plex_external_ids x ON x.rating_key=p.rating_key AND x.provider='imdb' AND x.external_id=${imdbId} JOIN plex_files pf ON pf.rating_key=p.rating_key LEFT JOIN plex_media pm ON pm.rating_key=pf.rating_key AND pm.media_index=pf.media_index WHERE p.active AND p.item_type='movie' AND COALESCE(pf.exists_on_server,true)<>false ORDER BY p.rating_key,pf.media_index,pf.part_index`;
const ratingKeys=[...new Set(rows.map(r=>String(r.rating_key)))];
const out=[];
for(const ratingKey of ratingKeys){
 const group=rows.filter(r=>String(r.rating_key)===ratingKey);
 const [check]=await sql`SELECT mfv.source_fingerprint saved_hash,(SELECT md5(string_agg(lower(COALESCE(pfv.file_path,''))||'|'||COALESCE(pfv.file_size_bytes::text,'')||'|'||COALESCE(pfv.duration_ms::text,(SELECT pmv.duration_ms::text FROM plex_media pmv WHERE pmv.rating_key=pfv.rating_key AND pmv.media_index=pfv.media_index LIMIT 1),'')||'|'||COALESCE(pfv.plex_part_id,''),',' ORDER BY pfv.media_index,pfv.part_index,lower(COALESCE(pfv.file_path,''))||'|'||COALESCE(pfv.file_size_bytes::text,'')||'|'||COALESCE(pfv.duration_ms::text,(SELECT pmv.duration_ms::text FROM plex_media pmv WHERE pmv.rating_key=pfv.rating_key AND pmv.media_index=pfv.media_index LIMIT 1),'')||'|'||COALESCE(pfv.plex_part_id,''))) FROM plex_files pfv WHERE pfv.rating_key=${ratingKey} AND COALESCE(pfv.exists_on_server,true)<>false) lifecycle_hash FROM movie_file_validation mfv WHERE mfv.rating_key=${ratingKey}`;
 out.push({ratingKey,savedHash:check?.saved_hash||null,jsHash:ratingPhysicalFingerprint(group),lifecycleHash:check?.lifecycle_hash||null,components:group.map(r=>({media_index:r.media_index,part_index:r.part_index,file_path:r.file_path,file_path_trimmed:String(r.file_path||'').trim(),file_size_bytes:r.file_size_bytes,file_duration_ms:r.file_duration_ms,media_duration_ms:r.media_duration_ms,effective_duration_ms:r.duration_ms,plex_part_id:r.plex_part_id}))});
}
console.log(JSON.stringify({imdbId,out},null,2));

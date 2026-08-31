import 'server-only';
import crypto from 'node:crypto';
import {db} from './db';

const physicalIdentity=r=>[String(r.file_path||'').trim().toLowerCase(),r.file_size_bytes??'',r.duration_ms??'',r.plex_part_id??''].join('|');
const physicalKey=r=>crypto.createHash('sha256').update(physicalIdentity(r)).digest('hex');

async function assertExceptionStillCurrent(sql,finding){
  if(!['duration','filename','duplicate'].includes(String(finding.finding_type||'')))throw new Error('La incidencia no pertenece a la validación física de películas');
  const rows=await sql`SELECT p.rating_key,pf.file_path,pf.file_size_bytes,pf.duration_ms,pf.plex_part_id FROM plex_items p JOIN plex_external_ids x ON x.rating_key=p.rating_key AND x.provider='imdb' AND x.external_id=${finding.imdb_id} JOIN plex_files pf ON pf.rating_key=p.rating_key WHERE p.active AND p.item_type='movie' AND COALESCE(pf.exists_on_server,true)<>false ORDER BY p.rating_key,pf.media_index,pf.part_index`;
  if(!rows.length)throw new Error('El archivo físico ya no está vigente. Sincroniza Plex y vuelve a analizar la película.');
  const keys=[...new Set(rows.map(physicalKey))];
  const current=finding.finding_type==='duplicate'
    ?crypto.createHash('sha256').update(keys.sort().join('|')).digest('hex')
    :rows.filter(r=>String(r.rating_key)===String(finding.rating_key)).map(physicalKey).includes(String(finding.fingerprint||''))?String(finding.fingerprint):null;
  if(!current||current!==String(finding.fingerprint||''))throw new Error('La incidencia pertenece a un archivo anterior. Sincroniza Plex y vuelve a analizar la película antes de aceptarla.');
  return{physicalFiles:keys.length,currentFingerprint:current};
}

export async function getMovieQualityFinding(id){const sql=db();const[finding]=await sql`SELECT id,rating_key,imdb_id,finding_type,status,fingerprint,details,resolved_at,last_seen_at FROM movie_quality_findings WHERE id=${id}`;return finding||null}

export async function setMovieQualityFindingAction(id,action,note=''){
  const sql=db();
  const [finding]=await sql`SELECT id,rating_key,imdb_id,finding_type,status,fingerprint,details FROM movie_quality_findings WHERE id=${id}`;
  if(!finding)throw new Error('Incidencia no encontrada');
  let current=null;
  if(action==='exception')current=await assertExceptionStillCurrent(sql,finding);
  const status=action==='exception'?'exception':action==='waiting_sync'?'waiting_sync':'pending';
  await sql.transaction([
    sql`UPDATE movie_quality_findings SET status=${status},resolved_at=CASE WHEN ${status}='exception' THEN now() ELSE NULL END WHERE id=${id}`,
    sql`INSERT INTO movie_quality_actions(finding_id,action,note,fingerprint,created_at) VALUES(${id},${action},${note||null},${finding.fingerprint},now())`
  ]);
  return{...finding,status,previousStatus:finding.status,current};
}

import 'server-only';
import {db} from './db';

export async function setMovieQualityFindingAction(id,action,note=''){
  const sql=db();
  const [finding]=await sql`SELECT id,fingerprint FROM movie_quality_findings WHERE id=${id}`;
  if(!finding)throw new Error('Incidencia no encontrada');
  const status=action==='exception'?'exception':action==='waiting_sync'?'waiting_sync':'pending';
  await sql.transaction([
    sql`UPDATE movie_quality_findings SET status=${status},resolved_at=CASE WHEN ${status}='exception' THEN now() ELSE NULL END WHERE id=${id}`,
    sql`INSERT INTO movie_quality_actions(finding_id,action,note,fingerprint,created_at) VALUES(${id},${action},${note||null},${finding.fingerprint},now())`
  ]);
}

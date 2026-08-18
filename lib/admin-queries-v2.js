import 'server-only';
import {db} from './db';

export async function getAdminOverview(filters={}){
  const sql=db(),status=String(filters.status||''),job=String(filters.job||'');
  const[counts,pipeline,syncs,events]=await Promise.all([
    sql`SELECT (SELECT count(*)::int FROM movies) movies,(SELECT count(*)::int FROM plex_items WHERE active) plex_active,(SELECT count(*)::int FROM series_reference) series,(SELECT count(*)::int FROM series_season_availability WHERE country_code='ES' AND status IN('ES_AVAILABLE','EXCEPTION_AVAILABLE')) availability_es`,
    sql`SELECT id,job_type,source,status,started_at,finished_at,processed_count,added_count,updated_count,skipped_count,error_count,summary,round(extract(epoch from (COALESCE(finished_at,now())-started_at))::numeric,1) duration_seconds FROM pipeline_runs WHERE (${status}='' OR status=${status}) AND (${job}='' OR job_type=${job}) ORDER BY created_at DESC LIMIT 80`,
    sql`SELECT id,started_at,finished_at,sync_mode,library_count,new_count,changed_count,missing_count,error_count,status,notes FROM plex_sync_runs ORDER BY started_at DESC LIMIT 15`,
    sql`SELECT id,event_type,entity_type,entity_id,action,payload,created_at FROM admin_events ORDER BY created_at DESC LIMIT 30`
  ]);
  return{counts:counts[0],pipeline,syncs,events};
}

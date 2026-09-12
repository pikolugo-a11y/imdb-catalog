import 'server-only';
import {db} from './db';

/**
 * Incidencias técnicas que siguen activas ahora mismo.
 *
 * Un error deja de ser activo cuando se resuelve explícitamente o cuando una
 * ejecución posterior del mismo proceso y entidad termina correctamente. Esta
 * es la misma semántica funcional que debe usar cualquier superficie que
 * resuma la salud operativa; el histórico completo sigue viviendo en
 * process_run_errors / Operaciones.
 */
export async function getActiveOperationalAttention(sql=db()){
  const [row]=await sql`
    WITH active_errors AS (
      SELECT e.*
      FROM process_run_errors e
      WHERE e.occurred_at>=now()-interval '30 days'
        AND e.resolved_at IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM process_runs later
          WHERE later.process_code=e.process_code
            AND later.requested_at>e.occurred_at
            AND later.technical_status='succeeded'
            AND COALESCE(later.entity_type,'')=COALESCE(e.entity_type,'')
            AND COALESCE(later.entity_id,'')=COALESCE(e.entity_id,'')
        )
    ), incident_groups AS (
      SELECT process_code,
             COALESCE(step,'') step,
             COALESCE(error_code,error_class,'MESSAGE:'||left(message,120)) error_key,
             COALESCE(source,'') source
      FROM active_errors
      GROUP BY process_code,COALESCE(step,''),COALESCE(error_code,error_class,'MESSAGE:'||left(message,120)),COALESCE(source,'')
    )
    SELECT (SELECT count(*)::int FROM active_errors) occurrences,
           (SELECT count(*)::int FROM incident_groups) incidents
  `;
  return{occurrences:Number(row?.occurrences||0),incidents:Number(row?.incidents||0)};
}

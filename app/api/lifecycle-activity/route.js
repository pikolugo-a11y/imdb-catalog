import {NextResponse} from 'next/server';
import {db} from '@/lib/db';
export const dynamic='force-dynamic';

export async function GET(){
  const sql=db();
  const rows=await sql`
    SELECT p.run_id,p.entity_id AS imdb_id,p.technical_status,p.functional_result,p.requested_at,p.finished_at,
           COALESCE(m.title_es,m.title,m.original_title,p.entity_id) AS title,
           child.after_compact AS result,
           child.technical_status AS child_status,
           child.functional_result AS child_result
    FROM process_runs p
    LEFT JOIN movies m ON m.imdb_id=p.entity_id
    LEFT JOIN LATERAL(
      SELECT c.after_compact,c.technical_status,c.functional_result
      FROM process_runs c
      WHERE c.parent_run_id=p.run_id AND c.process_code='PROC-LC-001'
      ORDER BY c.requested_at DESC LIMIT 1
    ) child ON true
    WHERE p.process_code='PROC-LC-001' AND p.trigger_source='catalog_admission'
      AND p.requested_at>now()-interval '7 days'
    ORDER BY p.requested_at DESC LIMIT 8`;
  return NextResponse.json({items:rows.map(r=>({runId:r.run_id,imdbId:r.imdb_id,title:r.title,technicalStatus:r.technical_status,functionalResult:r.functional_result,requestedAt:r.requested_at,finishedAt:r.finished_at,result:r.result||null,childStatus:r.child_status||null,childResult:r.child_result||null}))},{headers:{'Cache-Control':'no-store'}});
}

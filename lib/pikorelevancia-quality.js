import 'server-only';
import {db} from './db';
import {PIKORELEVANCE_VERSION} from './pikorelevance-core.mjs';
import {getActiveBatch,getLatestBatch} from './batch-engine';

export const PIKORELEVANCE_QUALITY_PAGE_SIZE=50;
const normPage=v=>Math.max(1,Number.parseInt(String(v||1),10)||1);

export async function getPikoRelevanceQualityPage({page=1,q=''}={}){
  const sql=db(),safePage=normPage(page),term=String(q||'').trim().slice(0,120),params=[PIKORELEVANCE_VERSION],where=[
    `c.type IN ('Serie','Miniserie')`,
    `ex.imdb_id IS NULL`,
    `a.imdb_id IS NULL`
  ];
  if(term){params.push(`%${term}%`);where.push(`(c.display_title ILIKE $${params.length} OR c.original_title ILIKE $${params.length} OR c.imdb_id ILIKE $${params.length})`);}
  const clause=where.join(' AND ');
  const [countRow]=await sql.query(`SELECT count(*)::int total
    FROM catalog_read_model c
    LEFT JOIN catalog_exclusions ex ON ex.imdb_id=c.imdb_id
    LEFT JOIN series_relevance_assessments a ON a.imdb_id=c.imdb_id AND a.formula_version=$1
    WHERE ${clause}`,params);
  const total=Number(countRow?.total||0),pages=Math.max(1,Math.ceil(total/PIKORELEVANCE_QUALITY_PAGE_SIZE)),current=Math.min(safePage,pages),offset=(current-1)*PIKORELEVANCE_QUALITY_PAGE_SIZE;
  const listParams=[...params,PIKORELEVANCE_QUALITY_PAGE_SIZE,offset],limitIndex=listParams.length-1,offsetIndex=listParams.length;
  const rows=await sql.query(`SELECT c.imdb_id,c.display_title,c.original_title,c.year,c.final_rating,rq.status queue_status
    FROM catalog_read_model c
    LEFT JOIN catalog_exclusions ex ON ex.imdb_id=c.imdb_id
    LEFT JOIN series_relevance_assessments a ON a.imdb_id=c.imdb_id AND a.formula_version=$1
    LEFT JOIN LATERAL(
      SELECT bi.status FROM batch_run_items bi
      JOIN batch_run_control brc ON brc.run_id=bi.batch_run_id
      WHERE brc.process_code='PROC-REL-001' AND brc.closed_at IS NULL AND bi.entity_id=c.imdb_id
      ORDER BY bi.item_id DESC LIMIT 1
    ) rq ON true
    WHERE ${clause}
    ORDER BY c.final_rating DESC NULLS LAST,c.year DESC NULLS LAST,c.display_title ASC,c.imdb_id ASC
    LIMIT $${limitIndex} OFFSET $${offsetIndex}`,listParams);
  const [currentCount]=await sql.query(`SELECT count(*)::int count FROM catalog_read_model c JOIN series_relevance_assessments a ON a.imdb_id=c.imdb_id AND a.formula_version=$1 LEFT JOIN catalog_exclusions ex ON ex.imdb_id=c.imdb_id WHERE c.type IN ('Serie','Miniserie') AND ex.imdb_id IS NULL`,[PIKORELEVANCE_VERSION]);
  const [active,latest]=await Promise.all([getActiveBatch('PROC-REL-001',sql),getLatestBatch('PROC-REL-001',sql)]);
  return{rows,total,page:current,pages,q:term,currentCount:Number(currentCount?.count||0),active,latest,version:PIKORELEVANCE_VERSION};
}

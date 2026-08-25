import 'server-only';
import {db} from './db';

const PAGE_SIZE=50;
const TYPES=new Set(['','movie','series']);
const STATUSES=new Set(['','untried','not_found','error','review','processing']);
const PLEX=new Set(['','in','out']);
const SORTS=new Set(['year_desc','year_asc','title_asc','title_desc']);
const clampPage=n=>Math.max(1,Number.parseInt(n,10)||1);
const one=v=>Array.isArray(v)?v[0]:v;

export function parseIdentityFilters(filters={}){
  const rawType=String(one(filters.type)||''),rawStatus=String(one(filters.status)||''),rawPlex=String(one(filters.plex)||''),rawSort=String(one(filters.sort)||'year_desc');
  return{
    q:String(one(filters.q)||'').trim().toLowerCase(),
    type:TYPES.has(rawType)?rawType:'',
    status:STATUSES.has(rawStatus)?rawStatus:'',
    plex:PLEX.has(rawPlex)?rawPlex:'',
    sort:SORTS.has(rawSort)?rawSort:'year_desc',
    page:clampPage(one(filters.page)),
    pageSize:PAGE_SIZE
  };
}

function outcomeToStatus(row){
  if(row.processing)return'processing';
  if(row.manual_review)return'review';
  if(row.last_outcome==='NO_ENCONTRADO')return'not_found';
  if(row.last_outcome==='ERROR')return'error';
  return'untried';
}

export async function getIdentityCatalogPage(filters={}){
  const sql=db();
  const p=parseIdentityFilters(filters),isImdb=/^tt\d+$/i.test(p.q),like='%'+p.q+'%';
  const base=sql`cl.lifecycle_state='IDENTITY_PENDING'
    AND m.tmdb_id IS NULL
    AND ex.imdb_id IS NULL
    AND (${p.type}='' OR (${p.type}='movie' AND m.type='Película') OR (${p.type}='series' AND m.type IN ('Serie','Miniserie')))
    AND (${p.q}='' OR (${isImdb} AND lower(m.imdb_id)=${p.q}) OR (NOT ${isImdb} AND (
      lower(COALESCE(m.title_es,'')) LIKE ${like} OR lower(COALESCE(m.title,'')) LIKE ${like} OR
      lower(COALESCE(m.original_title,'')) LIKE ${like} OR lower(m.imdb_id) LIKE ${like}
    )))
    AND (${p.plex}='' OR (${p.plex}='in' AND crm.effective_status='in_plex') OR (${p.plex}='out' AND COALESCE(crm.effective_status,'missing')<>'in_plex'))`;

  const statePredicate=sql`(${p.status}='' OR
    (${p.status}='processing' AND EXISTS(SELECT 1 FROM batch_jobs aj WHERE aj.entity_type='title' AND aj.entity_id=m.imdb_id AND aj.stage='IDENTITY_PENDING' AND aj.status IN('queued','leased','running','retry_wait'))) OR
    (${p.status}='review' AND COALESCE(ps.manual_review,false)=true) OR
    (${p.status}='not_found' AND COALESCE(ps.manual_review,false)=false AND ps.last_outcome='NO_ENCONTRADO') OR
    (${p.status}='error' AND COALESCE(ps.manual_review,false)=false AND ps.last_outcome='ERROR') OR
    (${p.status}='untried' AND COALESCE(ps.manual_review,false)=false AND COALESCE(ps.attempt_count,0)=0 AND NOT EXISTS(SELECT 1 FROM batch_jobs aj WHERE aj.entity_type='title' AND aj.entity_id=m.imdb_id AND aj.stage='IDENTITY_PENDING' AND aj.status IN('queued','leased','running','retry_wait')))
  )`;

  const [countRow]=await sql`SELECT count(*)::int total
    FROM catalog_lifecycle cl JOIN movies m USING(imdb_id)
    LEFT JOIN catalog_exclusions ex USING(imdb_id)
    LEFT JOIN catalog_read_model crm ON crm.imdb_id=m.imdb_id
    LEFT JOIN batch_process_state ps ON ps.entity_type='title' AND ps.entity_id=m.imdb_id AND ps.stage='IDENTITY_PENDING'
    WHERE ${base} AND ${statePredicate}`;
  const total=Number(countRow?.total||0),pages=Math.max(1,Math.ceil(total/p.pageSize)),page=Math.min(p.page,pages),offset=(page-1)*p.pageSize;

  const rows=await sql`SELECT m.imdb_id,m.type,COALESCE(m.title_es,m.title,m.original_title) AS display_title,m.title AS main_title,m.original_title,m.year,m.tmdb_id,
      COALESCE(m.manual_poster_url,m.poster_path,crm.poster_path) AS poster_path,
      COALESCE(crm.effective_status,'missing') AS plex_status,
      ps.attempt_count,ps.last_attempt_at,ps.last_outcome,COALESCE(ps.manual_review,false) AS manual_review,ps.manual_review_reason,
      EXISTS(SELECT 1 FROM batch_jobs aj WHERE aj.entity_type='title' AND aj.entity_id=m.imdb_id AND aj.stage='IDENTITY_PENDING' AND aj.status IN('queued','leased','running','retry_wait')) AS processing,
      cl.blocking_reason
    FROM catalog_lifecycle cl JOIN movies m USING(imdb_id)
    LEFT JOIN catalog_exclusions ex USING(imdb_id)
    LEFT JOIN catalog_read_model crm ON crm.imdb_id=m.imdb_id
    LEFT JOIN batch_process_state ps ON ps.entity_type='title' AND ps.entity_id=m.imdb_id AND ps.stage='IDENTITY_PENDING'
    WHERE ${base} AND ${statePredicate}
    ORDER BY
      CASE WHEN ${p.sort}='year_desc' THEN m.year END DESC NULLS LAST,
      CASE WHEN ${p.sort}='year_asc' THEN m.year END ASC NULLS LAST,
      CASE WHEN ${p.sort}='title_asc' THEN lower(COALESCE(m.title_es,m.title,m.original_title,'')) END ASC NULLS LAST,
      CASE WHEN ${p.sort}='title_desc' THEN lower(COALESCE(m.title_es,m.title,m.original_title,'')) END DESC NULLS LAST,
      m.imdb_id ASC
    LIMIT ${p.pageSize} OFFSET ${offset}`;

  const [statusRow]=await sql`SELECT
      count(*) FILTER(WHERE COALESCE(ps.manual_review,false)=false AND COALESCE(ps.attempt_count,0)=0 AND NOT EXISTS(SELECT 1 FROM batch_jobs aj WHERE aj.entity_type='title' AND aj.entity_id=m.imdb_id AND aj.stage='IDENTITY_PENDING' AND aj.status IN('queued','leased','running','retry_wait')))::int untried,
      count(*) FILTER(WHERE COALESCE(ps.manual_review,false)=false AND ps.last_outcome='NO_ENCONTRADO')::int not_found,
      count(*) FILTER(WHERE COALESCE(ps.manual_review,false)=false AND ps.last_outcome='ERROR')::int error,
      count(*) FILTER(WHERE COALESCE(ps.manual_review,false)=true)::int review,
      count(*) FILTER(WHERE EXISTS(SELECT 1 FROM batch_jobs aj WHERE aj.entity_type='title' AND aj.entity_id=m.imdb_id AND aj.stage='IDENTITY_PENDING' AND aj.status IN('queued','leased','running','retry_wait')))::int processing
    FROM catalog_lifecycle cl JOIN movies m USING(imdb_id)
    LEFT JOIN catalog_exclusions ex USING(imdb_id)
    LEFT JOIN catalog_read_model crm ON crm.imdb_id=m.imdb_id
    LEFT JOIN batch_process_state ps ON ps.entity_type='title' AND ps.entity_id=m.imdb_id AND ps.stage='IDENTITY_PENDING'
    WHERE ${base}`;

  return{
    rows:rows.map(r=>({...r,identity_status:outcomeToStatus(r),in_plex:r.plex_status==='in_plex'})),
    total,page,pageSize,pages,
    first:total?offset+1:0,last:Math.min(offset+p.pageSize,total),
    statusCounts:statusRow||{untried:0,not_found:0,error:0,review:0,processing:0},filters:p
  };
}

export async function getIdentityWorkflowStats(){
  const sql=db();
  const[r]=await sql`SELECT count(*)::int affected_catalog,
    count(*) FILTER(WHERE m.type='Película')::int movies,
    count(*) FILTER(WHERE m.type IN('Serie','Miniserie'))::int series
    FROM catalog_lifecycle cl JOIN movies m USING(imdb_id)
    LEFT JOIN catalog_exclusions ex USING(imdb_id)
    WHERE cl.lifecycle_state='IDENTITY_PENDING' AND m.tmdb_id IS NULL AND ex.imdb_id IS NULL`;
  return r||{affected_catalog:0,movies:0,series:0};
}

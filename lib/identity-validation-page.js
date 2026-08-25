import 'server-only';
import {db} from './db';

const PAGE_SIZE=50;
const SUBSTATES=new Set(['','evidence_pending','ready','doubtful','probable_error']);
const TYPES=new Set(['','movie','series']);
const PLEX=new Set(['','in','out']);
const one=v=>Array.isArray(v)?v[0]:v;
const clampPage=n=>Math.max(1,Number.parseInt(n,10)||1);

export function parseIdentityValidationFilters(filters={}){
  const substate=String(one(filters.substate)||''),type=String(one(filters.type)||''),plex=String(one(filters.plex)||'');
  const rawYear=String(one(filters.year)||'').trim();
  return{
    q:String(one(filters.q)||'').trim().toLowerCase(),
    substate:SUBSTATES.has(substate)?substate:'',
    type:TYPES.has(type)?type:'',
    plex:PLEX.has(plex)?plex:'',
    year:/^\d{4}$/.test(rawYear)?Number(rawYear):0,
    page:clampPage(one(filters.page)),pageSize:PAGE_SIZE
  };
}

function classifyRow(r){
  const link=r.validation_details?.link_evidence||{};
  const forward=Boolean(link.forward_match),reverse=Boolean(link.reverse_match);
  const forwardFound=Boolean(link.forward_found||link.forward_tmdb_id),reverseFound=Boolean(link.reverse_imdb_id);
  let diagnosis;
  if(r.substate==='evidence_pending') diagnosis={code:'evidence_missing',label:'Falta evidencia',detail:!forwardFound&&!reverseFound?'Falta comprobar el vínculo directo en ambos sentidos.':!forwardFound?'Falta comprobar IMDb → TMDb.':'Falta comprobar TMDb → IMDb.',severity:'neutral'};
  else if(forward&&reverse) diagnosis={code:'bidirectional_match',label:'Coincidencia fuerte',detail:'IMDb ↔ TMDb confirmado en ambos sentidos.',severity:'ok'};
  else if(forward&&!reverse) diagnosis={code:'reverse_mismatch',label:'Cruce inverso no confirmado',detail:reverseFound?`TMDb devuelve ${link.reverse_imdb_id}; esperado ${r.imdb_id}.`:'IMDb → TMDb coincide, pero falta confirmar TMDb → IMDb.',severity:r.substate==='probable_error'?'bad':'warn'};
  else if(!forward&&reverse) diagnosis={code:'forward_mismatch',label:'Cruce directo no confirmado',detail:forwardFound?`IMDb devuelve TMDb ${link.forward_tmdb_id}; esperado ${r.tmdb_id||'—'}.`:'TMDb → IMDb coincide, pero falta confirmar IMDb → TMDb.',severity:r.substate==='probable_error'?'bad':'warn'};
  else diagnosis={code:'link_conflict',label:r.substate==='probable_error'?'Cruce incompatible':'Cruce dudoso',detail:forwardFound||reverseFound?'Los IDs devueltos no confirman la pareja IMDb ↔ TMDb.':'No existe vínculo directo suficiente entre ambos proveedores.',severity:r.substate==='probable_error'?'bad':'warn'};
  const manual=r.manual_review||null,batchManual=Boolean(r.batch_manual_review);
  const canValidate=r.substate!=='evidence_pending';
  const primaryAction=r.substate==='evidence_pending'?'refresh':r.substate==='ready'?'validate':r.substate==='probable_error'?'review':'review';
  return{...r,in_plex:r.plex_status==='in_plex',diagnosis,capabilities:{canRefresh:true,canValidate,canEditIds:true,canManualReview:canValidate,primaryAction},batch_manual_review:batchManual,manual_review:manual};
}

export async function getIdentityValidationSnapshot(filters={}){
  const sql=db(),p=parseIdentityValidationFilters(filters),like='%'+p.q+'%';
  const ready=sql`v.tmdb_id=m.tmdb_id AND ((v.imdb_original_title IS NOT NULL AND v.imdb_year IS NOT NULL AND v.tmdb_original_title IS NOT NULL AND v.tmdb_year IS NOT NULL) OR COALESCE((v.validation_details #>> '{link_evidence,forward_match}')::boolean,false) OR COALESCE((v.validation_details #>> '{link_evidence,reverse_match}')::boolean,false))`;
  const common=sql`ex.imdb_id IS NULL AND cl.lifecycle_state IN('IDENTITY_VALIDATION','IDENTITY_REVIEW_REQUIRED') AND (${p.year}=0 OR m.year=${p.year}) AND (${p.q}='' OR lower(COALESCE(m.title_es,m.title,m.original_title,'')) LIKE ${like} OR lower(m.imdb_id) LIKE ${like} OR lower(COALESCE(m.tmdb_id,'')) LIKE ${like}) AND (${p.plex}='' OR (${p.plex}='in' AND crm.effective_status='in_plex') OR (${p.plex}='out' AND COALESCE(crm.effective_status,'missing')<>'in_plex'))`;
  const typeCondition=sql`(${p.type}='' OR (${p.type}='movie' AND m.type='Película') OR (${p.type}='series' AND m.type IN('Serie','Miniserie')))`;
  const stateCondition=sql`(${p.substate}='' OR (${p.substate}='evidence_pending' AND cl.lifecycle_state='IDENTITY_VALIDATION' AND NOT(${ready})) OR (${p.substate}='ready' AND cl.lifecycle_state='IDENTITY_VALIDATION' AND ${ready}) OR (${p.substate}='doubtful' AND cl.lifecycle_state='IDENTITY_REVIEW_REQUIRED' AND COALESCE(v.validation_score,0)>=60) OR (${p.substate}='probable_error' AND cl.lifecycle_state='IDENTITY_REVIEW_REQUIRED' AND COALESCE(v.validation_score,0)<60))`;
  const joins=sql`FROM catalog_lifecycle cl JOIN movies m USING(imdb_id) LEFT JOIN identity_validation v USING(imdb_id) LEFT JOIN catalog_exclusions ex USING(imdb_id) LEFT JOIN catalog_read_model crm ON crm.imdb_id=m.imdb_id LEFT JOIN batch_process_state ps ON ps.entity_type='title' AND ps.entity_id=m.imdb_id AND ps.stage='IDENTITY_VALIDATION'`;
  const[stateRows,typeRows,countRows]=await Promise.all([
    sql`SELECT count(*)::int total,count(*) FILTER(WHERE cl.lifecycle_state='IDENTITY_VALIDATION' AND NOT(${ready}))::int evidence_pending,count(*) FILTER(WHERE cl.lifecycle_state='IDENTITY_VALIDATION' AND ${ready})::int ready,count(*) FILTER(WHERE cl.lifecycle_state='IDENTITY_REVIEW_REQUIRED' AND COALESCE(v.validation_score,0)>=60)::int doubtful,count(*) FILTER(WHERE cl.lifecycle_state='IDENTITY_REVIEW_REQUIRED' AND COALESCE(v.validation_score,0)<60)::int probable_error ${joins} WHERE ${common} AND ${typeCondition}`,
    sql`SELECT count(*) FILTER(WHERE m.type='Película')::int movies,count(*) FILTER(WHERE m.type IN('Serie','Miniserie'))::int series ${joins} WHERE ${common} AND ${stateCondition}`,
    sql`SELECT count(*)::int total ${joins} WHERE ${common} AND ${typeCondition} AND ${stateCondition}`
  ]);
  const total=Number(countRows[0]?.total||0),pages=Math.max(1,Math.ceil(total/p.pageSize)),page=Math.min(p.page,pages),offset=(page-1)*p.pageSize;
  const rows=await sql`SELECT m.imdb_id,m.type,COALESCE(m.title_es,m.title,m.original_title) display_title,m.original_title,m.year,m.tmdb_id,COALESCE(crm.effective_status,'missing') plex_status,v.validation_status,v.validation_score,v.validation_details,v.suspected_source,v.imdb_title,v.imdb_original_title,v.imdb_year,v.tmdb_title_es,v.tmdb_original_title,v.tmdb_year,v.validated_at,(v.validation_details->'manual') manual_review,COALESCE(ps.manual_review,false) batch_manual_review,ps.manual_review_reason batch_manual_review_reason,cl.lifecycle_state,CASE WHEN cl.lifecycle_state='IDENTITY_REVIEW_REQUIRED' AND COALESCE(v.validation_score,0)>=60 THEN 'doubtful' WHEN cl.lifecycle_state='IDENTITY_REVIEW_REQUIRED' THEN 'probable_error' WHEN ${ready} THEN 'ready' ELSE 'evidence_pending' END substate ${joins} WHERE ${common} AND ${typeCondition} AND ${stateCondition} ORDER BY CASE WHEN cl.lifecycle_state='IDENTITY_REVIEW_REQUIRED' THEN 0 ELSE 1 END,v.validation_score NULLS FIRST,m.year DESC NULLS LAST,m.imdb_id LIMIT ${p.pageSize} OFFSET ${offset}`;
  return{stats:{...(stateRows[0]||{}),...(typeRows[0]||{})},rows:rows.map(classifyRow),pagination:{total,page,pages,pageSize:p.pageSize,first:total?offset+1:0,last:Math.min(offset+p.pageSize,total)},filters:p};
}

export async function getIdentityValidationStats(filters={}){return (await getIdentityValidationSnapshot({...filters,page:1})).stats}
export async function getIdentityValidationPage(filters={}){const s=await getIdentityValidationSnapshot(filters);return{rows:s.rows,total:s.pagination.total,page:s.pagination.page,pages:s.pagination.pages,pageSize:s.pagination.pageSize}}

import 'server-only';
import {db} from './db';

export const EXCLUDED_V4_PAGE_SIZE=50;
const norm=s=>String(s||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim();
const dbNorm=x=>`translate(lower(COALESCE(${x},'')),'áéíóúüñ','aeiouun')`;
const first=v=>Array.isArray(v)?v[0]:v;
export function parseExcludedV4(raw={}){const q=String(first(raw.q)||'').trim(),page=Math.max(1,Number.parseInt(first(raw.page),10)||1);return{q,page}}
export function excludedV4Href(state,patch={}){const s={...state,...patch},p=new URLSearchParams();if(s.q)p.set('q',s.q);if(Number(s.page)>1)p.set('page',String(s.page));const x=p.toString();return `/catalogo/excluidas${x?`?${x}`:''}`}

const base=`FROM catalog_exclusions e
LEFT JOIN movies m ON m.imdb_id=e.imdb_id
LEFT JOIN catalog_candidates c ON c.imdb_id=e.imdb_id`;
const pending=`COALESCE(c.source_snapshot->>'restoredFromExclusion','false')='true' AND c.eligibility_status IN('eligible','processing')`;

export async function getExcludedV4(raw={}){
  const p=parseExcludedV4(raw),sql=db(),params=[],w=[`NOT (${pending})`];
  if(p.q){params.push(`%${norm(p.q)}%`);const i=params.length;params.push(p.q);const j=params.length;w.push(`(${dbNorm(`COALESCE(m.title_es,m.title,m.original_title,c.source_snapshot->>'title',c.source_snapshot->>'originalTitle',e.imdb_id)`)} LIKE $${i} OR ${dbNorm(`COALESCE(m.original_title,c.source_snapshot->>'originalTitle')`)} LIKE $${i} OR lower(e.imdb_id)=lower($${j}))`)}
  const where=w.join(' AND '),[count]=await sql.query(`SELECT count(*)::int total ${base} WHERE ${where}`,params),total=Number(count?.total||0),pageCount=Math.max(1,Math.ceil(total/EXCLUDED_V4_PAGE_SIZE)),page=Math.min(p.page,pageCount),offset=(page-1)*EXCLUDED_V4_PAGE_SIZE;
  const rows=await sql.query(`SELECT e.imdb_id,COALESCE(m.title_es,m.title,m.original_title,c.source_snapshot->>'title',c.source_snapshot->>'originalTitle',e.imdb_id) display_title,COALESCE(m.original_title,c.source_snapshot->>'originalTitle') original_title,COALESCE(m.year,c.year) year,COALESCE(m.type,CASE WHEN c.candidate_type='movie' THEN 'Película' WHEN c.candidate_type='tvMiniSeries' THEN 'Miniserie' WHEN c.candidate_type='tvSeries' THEN 'Serie' ELSE NULL END) type,e.excluded_at ${base} WHERE ${where} ORDER BY e.excluded_at DESC NULLS LAST,e.imdb_id ASC LIMIT ${EXCLUDED_V4_PAGE_SIZE} OFFSET ${offset}`,params);
  return{state:{...p,page},rows,total,pageCount};
}

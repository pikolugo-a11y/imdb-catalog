import 'server-only';
import {db} from './db';
import {classifySeries} from './series-quality-domain.mjs';

const safeStatus=v=>['all','present','missing_actionable','availability_unknown','not_available_es'].includes(String(v))?String(v):'all';
const safeCoverage=v=>['all','present','absent'].includes(String(v))?String(v):'all';
const num=v=>Number(v||0);
const evidence=v=>{try{const x=JSON.parse(String(v||''));return x?.ser005===1?x:null}catch{return null}};
const withOverrideState=row=>{const ev=evidence(row.note),accepted=['special','not_needed'].includes(String(row.decision||'')),current=accepted&&ev&&String(ev.plex_rating_key)===String(row.rating_key)&&String(ev.plex_fingerprint||'')===String(row.fingerprint||'');return{...row,override_current:Boolean(current),override_stale:Boolean(accepted&&!current),override_note:ev?.note||null,accepted_evidence:ev}};

export async function getSeriesDetailSummary(ratingKey){
  const sql=db();
  const[s]=await sql`SELECT r.*,c.display_title,c.original_title,c.poster_path,c.final_rating,ir.normalized_rating::float8 imdb_rating,ir.votes::bigint imdb_votes,tr.normalized_rating::float8 tmdb_rating,tr.votes::bigint tmdb_votes,c.effective_status,c.genres,m.overview,m.tagline,c.tmdb_id FROM series_reference r JOIN plex_items show ON show.rating_key=r.show_rating_key AND show.active AND show.item_type='show' LEFT JOIN catalog_read_model c ON c.imdb_id=r.imdb_id LEFT JOIN movie_metadata m ON m.imdb_id=r.imdb_id LEFT JOIN title_ratings ir ON ir.imdb_id=r.imdb_id AND ir.source='imdb' AND ir.status='available' LEFT JOIN title_ratings tr ON tr.imdb_id=r.imdb_id AND tr.source='tmdb' AND tr.status='available' LEFT JOIN catalog_exclusions ex ON ex.imdb_id=r.imdb_id WHERE r.show_rating_key=${ratingKey} AND ex.imdb_id IS NULL LIMIT 1`;
  if(!s)return null;
  const[seasonCounts,totals,extrasRaw,combined,quality,runs,overrides]=await Promise.all([
    sql`SELECT e.season_number,count(*)::int total,count(*) FILTER(WHERE e.effective_status='present')::int present,count(*) FILTER(WHERE e.effective_status='missing_actionable')::int missing,count(*) FILTER(WHERE e.effective_status='availability_unknown')::int unknown,count(*) FILTER(WHERE e.effective_status='not_available_es')::int noes,a.status availability_status,a.source availability_source,a.confidence availability_confidence,a.manual_override,a.checked_at availability_checked_at,a.note availability_note FROM series_episode_effective_status e LEFT JOIN series_season_availability a ON a.show_rating_key=e.show_rating_key AND a.season_number=e.season_number AND a.country_code='ES' WHERE e.show_rating_key=${ratingKey} GROUP BY e.season_number,a.status,a.source,a.confidence,a.manual_override,a.checked_at,a.note ORDER BY e.season_number`,
    sql`SELECT count(*)::int total,count(*) FILTER(WHERE effective_status='present')::int present,count(*) FILTER(WHERE effective_status='missing_actionable')::int missing,count(*) FILTER(WHERE effective_status='availability_unknown')::int unknown,count(*) FILTER(WHERE effective_status='not_available_es')::int noes FROM series_episode_effective_status WHERE show_rating_key=${ratingKey}`,
    sql`SELECT p.rating_key,p.parent_index season_number,p.item_index episode_number,p.plex_title,p.plex_updated_at,p.fingerprint,o.decision,o.note,o.updated_at override_updated_at FROM plex_items p LEFT JOIN series_reference_episodes r ON r.show_rating_key=${ratingKey} AND r.season_number=p.parent_index AND r.episode_number=p.item_index LEFT JOIN series_episode_overrides o ON o.show_rating_key=${ratingKey} AND o.season_number=p.parent_index AND o.episode_number=p.item_index WHERE p.active AND p.item_type='episode' AND p.grandparent_rating_key=${ratingKey} AND r.show_rating_key IS NULL AND NOT EXISTS(SELECT 1 FROM series_diagnostics d WHERE d.show_rating_key=${ratingKey} AND p.rating_key=ANY(string_to_array(COALESCE(d.covered_by_rating_key,''),','))) ORDER BY p.parent_index,p.item_index,p.rating_key LIMIT 300`,
    sql`SELECT season_number,episode_number,status,confidence,reason,covered_by_rating_key,expected_name,expected_runtime_minutes,actual_duration_minutes,diagnosed_at FROM series_diagnostics WHERE show_rating_key=${ratingKey} AND status='covered_combined' ORDER BY season_number,episode_number LIMIT 200`,
    sql`SELECT round(avg(q.score)::numeric,1) score,count(*)::int evaluated,count(*) FILTER(WHERE q.confidence='high')::int enriched,min(q.score)::int worst,max(q.score)::int best FROM plex_items p JOIN piko_quality q ON q.rating_key=p.rating_key WHERE p.active AND p.item_type='episode' AND p.grandparent_rating_key=${ratingKey} AND q.status='evaluated'`,
    sql`SELECT id,run_type,status,started_at,finished_at,processed_count,changed_count,error_count,summary FROM series_quality_runs WHERE scope_key=${ratingKey} ORDER BY started_at DESC LIMIT 8`,
    sql`SELECT season_number,episode_number,decision,note,created_at,updated_at FROM series_episode_overrides WHERE show_rating_key=${ratingKey} ORDER BY updated_at DESC LIMIT 100`
  ]);
  const extras=extrasRaw.map(withOverrideState),t=totals[0]||{total:0,present:0,missing:0,unknown:0,noes:0};
  const unresolvedExtras=extras.filter(e=>!e.override_current),resolvedExtras=extras.filter(e=>e.override_current);
  const row={...s,has_reference:true,plex_detail_trusted:Boolean(s.plex_detail_refreshed_at&&!s.plex_invalidated_at),plex_changed:Boolean(s.plex_invalidated_at),reference_invalidated:Boolean(s.plex_invalidated_at),reference_invalid_reason:s.plex_invalid_reason,actionable_missing:num(t.missing),availability_unknown:num(t.unknown),not_available_es:num(t.noes),unmapped_plex_episodes:unresolvedExtras.length,plex_episodes:num(t.present),updated_at:runs[0]?.finished_at||runs[0]?.started_at||s.refreshed_at};
  const classification=classifySeries(row);
  return{...s,seasonCounts,totals:{total:num(t.total),present:num(t.present),missing:num(t.missing),unknown:num(t.unknown),noes:num(t.noes)},extras,unresolvedExtras,resolvedExtras,combined,quality:quality[0]||null,runs,overrides,classification};
}

export async function getSeriesEpisodeScope(ratingKey,{season='all',status='all',coverage='all',limit=160}={}){
  const sql=db(),sn=season==='all'||season==null?0:Math.max(0,Number(season)||0),st=safeStatus(status),cv=safeCoverage(coverage),lim=Math.min(300,Math.max(20,Number(limit)||160));
  const rows=await sql`SELECT e.*,r.overview,d.status diagnostic_status,d.confidence diagnostic_confidence,d.reason diagnostic_reason,d.covered_by_rating_key,d.actual_duration_minutes,d.diagnosed_at FROM series_episode_effective_status e LEFT JOIN series_reference_episodes r ON r.show_rating_key=e.show_rating_key AND r.season_number=e.season_number AND r.episode_number=e.episode_number LEFT JOIN series_diagnostics d ON d.show_rating_key=e.show_rating_key AND d.season_number=e.season_number AND d.episode_number=e.episode_number WHERE e.show_rating_key=${ratingKey} AND (${sn}=0 OR e.season_number=${sn}) AND (${st}='all' OR e.effective_status=${st}) AND (${cv}='all' OR (${cv}='present' AND e.effective_status='present') OR (${cv}='absent' AND e.effective_status<>'present')) ORDER BY e.season_number,e.episode_number LIMIT ${lim}`;
  return rows;
}

export function seriesMaintenance(summary){
  const byType=new Map();for(const r of summary.runs||[])if(!byType.has(r.run_type))byType.set(r.run_type,r);
  const plex=byType.get('plex_detail'),tmdb=byType.get('tmdb_refresh'),es=byType.get('es_availability');
  const primary=summary.classification?.primaryState==='plex_sync'?'plex':summary.classification?.primaryState==='tmdb_refresh'?'tmdb':summary.totals?.unknown>0?'es':null;
  return[
    {key:'plex',label:'Plex',description:'Relee temporadas y episodios físicos de esta serie y reconcilia la cobertura.',last:plex,recommended:primary==='plex'},
    {key:'tmdb',label:'TMDb',description:'Actualiza estructura oficial, fechas y estado de la serie y vuelve a reconciliar.',last:tmdb,recommended:primary==='tmdb'},
    {key:'es',label:'España',description:'Comprueba solo disponibilidad territorial pendiente mediante TMDb y Watchmode.',last:es,recommended:primary==='es'}
  ];
}

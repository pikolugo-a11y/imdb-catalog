import 'server-only';
import {db} from './db';
import {classifySeries,SER004_RECHECK_DAYS} from './series-quality-domain.mjs';
import {SERIES_EPISODE_GRACE_DAYS} from './series-exigibility.mjs';

const allowed=new Set(['attention','tracking','pre_quality','plex_sync','tmdb_refresh','missing','unmapped','unknown','uptodate','all']);
const episodeAllowed=new Set(['all','missing','actionable','spain','premiere']);
const sortAllowed=new Set(['priority','missing_asc','missing_desc','year_desc','year_asc']);
const attentionStates=new Set(['missing','unmapped']);
const trackingStates=new Set(['pre_quality','plex_sync','tmdb_refresh','unknown']);
const n=v=>Number(v||0);
const year=v=>{const x=Number(v);return Number.isFinite(x)&&x>0?x:null};

function buildCounts(classified){
  const counts={all:classified.length,pre_quality:0,plex_sync:0,tmdb_refresh:0,missing:0,unmapped:0,unknown:0,uptodate:0};
  const episodes={physical:0,present:0,missing:0,actionable:0,spain:0,premiere:0};
  for(const r of classified){
    counts[r.primaryState]=(counts[r.primaryState]||0)+1;
    episodes.physical+=n(r.plex_episodes);
    episodes.present+=n(r.episode_present);
    episodes.missing+=n(r.episode_missing_total);
    episodes.actionable+=n(r.episode_actionable_now);
    episodes.spain+=n(r.episode_pending_spain);
    episodes.premiere+=n(r.episode_pending_premiere);
  }
  counts.attention=counts.missing+counts.unmapped;
  counts.tracking=counts.pre_quality+counts.plex_sync+counts.tmdb_refresh+counts.unknown;
  counts.evaluable=counts.all-counts.pre_quality;
  counts.traced=counts.all;
  counts.unclassified=classified.filter(r=>!r.primaryState).length;
  counts.tmdb_status=classified.reduce((acc,r)=>{const k=r.tmdb_status||'Desconocido';acc[k]=(acc[k]||0)+1;return acc},{});
  counts.uptodate_tmdb_status=classified.filter(r=>r.primaryState==='uptodate').reduce((acc,r)=>{const k=r.tmdb_status||'Desconocido';acc[k]=(acc[k]||0)+1;return acc},{});
  counts.episodes=episodes;
  return counts;
}

async function getClassifiedSeries(sql=db()){
  const raw=await sql`SELECT rm.*,COALESCE(tm.imdb_id,rm.imdb_id) effective_imdb_id,COALESCE(av.availability_due,0)::int availability_due,COALESCE(ep.episode_present,0)::int episode_present,COALESCE(ep.episode_missing_total,0)::int episode_missing_total,COALESCE(ep.episode_actionable_now,0)::int episode_actionable_now,COALESCE(ep.episode_pending_unknown,0)::int episode_pending_unknown,COALESCE(ep.episode_pending_noes,0)::int episode_pending_noes,COALESCE(ep.episode_pending_spain,0)::int episode_pending_spain,COALESCE(ep.episode_pending_premiere,0)::int episode_pending_premiere FROM series_quality_read_model rm LEFT JOIN plex_show_effective_ids pe ON pe.rating_key=rm.show_rating_key LEFT JOIN movies tm ON tm.type IN('Serie','Miniserie') AND tm.source_status->>'identity_mode'='tmdb_only' AND tm.tmdb_id=pe.tmdb_id LEFT JOIN (SELECT e.show_rating_key,count(*) FILTER(WHERE e.effective_status='availability_unknown' AND (e.air_date IS NOT NULL AND e.air_date<=CURRENT_DATE-(${SERIES_EPISODE_GRACE_DAYS} * interval '1 day')) AND (a.checked_at IS NULL OR a.checked_at<=now()-(${SER004_RECHECK_DAYS} * interval '1 day')))::int availability_due FROM series_episode_effective_status e LEFT JOIN series_season_availability a ON a.show_rating_key=e.show_rating_key AND a.season_number=e.season_number AND a.country_code='ES' GROUP BY e.show_rating_key) av ON av.show_rating_key=rm.show_rating_key LEFT JOIN (SELECT e.show_rating_key,count(*) FILTER(WHERE e.effective_status='present')::int episode_present,count(*) FILTER(WHERE e.plex_diagnostic_status='missing')::int episode_missing_total,count(*) FILTER(WHERE e.plex_diagnostic_status='missing' AND (e.air_date IS NOT NULL AND e.air_date<=CURRENT_DATE-(${SERIES_EPISODE_GRACE_DAYS} * interval '1 day')) AND e.effective_status='missing_actionable')::int episode_actionable_now,count(*) FILTER(WHERE e.plex_diagnostic_status='missing' AND (e.air_date IS NOT NULL AND e.air_date<=CURRENT_DATE-(${SERIES_EPISODE_GRACE_DAYS} * interval '1 day')) AND e.effective_status='availability_unknown')::int episode_pending_unknown,count(*) FILTER(WHERE e.plex_diagnostic_status='missing' AND (e.air_date IS NOT NULL AND e.air_date<=CURRENT_DATE-(${SERIES_EPISODE_GRACE_DAYS} * interval '1 day')) AND e.effective_status='not_available_es')::int episode_pending_noes,count(*) FILTER(WHERE e.plex_diagnostic_status='missing' AND (e.air_date IS NOT NULL AND e.air_date<=CURRENT_DATE-(${SERIES_EPISODE_GRACE_DAYS} * interval '1 day')) AND e.effective_status IN('availability_unknown','not_available_es'))::int episode_pending_spain,count(*) FILTER(WHERE e.plex_diagnostic_status='missing' AND (e.air_date IS NULL OR e.air_date>CURRENT_DATE-(${SERIES_EPISODE_GRACE_DAYS} * interval '1 day')))::int episode_pending_premiere FROM series_episode_effective_status e GROUP BY e.show_rating_key) ep ON ep.show_rating_key=rm.show_rating_key ORDER BY rm.title`;
  return raw.map(r=>{const corrected={...r,actionable_missing:n(r.episode_actionable_now),availability_unknown:n(r.episode_pending_unknown),not_available_es:n(r.episode_pending_noes)};return{...corrected,...classifySeries(corrected)}});
}

export async function getSeriesQualityCounts(sql=db()){
  return buildCounts(await getClassifiedSeries(sql));
}

export async function getSeriesFilenameFormatWarnings({page=1,pageSize=50}={}){
  const sql=db(),safePage=Math.max(1,Number(page)||1),safeSize=Math.max(1,Math.min(Number(pageSize)||50,100)),offset=(safePage-1)*safeSize;
  const[countRow]=await sql`WITH bad AS (
    SELECT p.grandparent_rating_key show_rating_key,count(*)::int bad_files
    FROM plex_items p
    JOIN plex_files f ON f.rating_key=p.rating_key
    WHERE p.active
      AND p.item_type='episode'
      AND f.file_path IS NOT NULL
      AND substring(f.file_path from '^.+ - [0-9]{1,2}x[0-9]{1,3} - .+[.][^.]+') IS DISTINCT FROM f.file_path
    GROUP BY p.grandparent_rating_key
  )
  SELECT count(*)::int total,COALESCE(sum(bad_files),0)::int bad_files FROM bad`;
  const total=Number(countRow?.total||0),badFiles=Number(countRow?.bad_files||0);
  const rows=await sql`WITH file_stats AS (
    SELECT p.grandparent_rating_key show_rating_key,
           count(*)::int total_files,
           count(*) FILTER(WHERE f.file_path IS NOT NULL AND substring(f.file_path from '^.+ - [0-9]{1,2}x[0-9]{1,3} - .+[.][^.]+') IS DISTINCT FROM f.file_path)::int bad_files
    FROM plex_items p
    JOIN plex_files f ON f.rating_key=p.rating_key
    WHERE p.active AND p.item_type='episode'
    GROUP BY p.grandparent_rating_key
  )
  SELECT fs.show_rating_key,COALESCE(show.plex_title,'Serie sin título') series_title,
         fs.bad_files,fs.total_files
  FROM file_stats fs
  JOIN plex_items show ON show.rating_key=fs.show_rating_key AND show.item_type='show'
  WHERE fs.bad_files>0
  ORDER BY fs.bad_files DESC,series_title,fs.show_rating_key
  LIMIT ${safeSize} OFFSET ${offset}`;
  return{rows,total,badFiles,page:safePage,pageSize:safeSize,pages:Math.max(1,Math.ceil(total/safeSize))};
}
export async function getSeriesGroupedFilesWarnings({page=1,pageSize=50}={}){
  const sql=db(),safePage=Math.max(1,Number(page)||1),safeSize=Math.max(1,Math.min(Number(pageSize)||50,100)),offset=(safePage-1)*safeSize;
  const[countRow]=await sql`SELECT count(*)::int total FROM (
    SELECT p.rating_key
    FROM plex_items p
    JOIN plex_files f ON f.rating_key=p.rating_key
    WHERE p.active AND p.item_type='episode'
    GROUP BY p.rating_key
    HAVING count(*)>1
  ) grouped`;
  const total=Number(countRow?.total||0);
  const rows=await sql`WITH grouped AS (
    SELECT p.rating_key episode_rating_key,p.grandparent_rating_key show_rating_key,
           COALESCE(show.plex_title,'Serie sin título') series_title,
           p.parent_index season_number,p.item_index episode_number,
           COALESCE(p.plex_title,'Capítulo sin título') episode_title,
           count(*)::int file_count
    FROM plex_items p
    JOIN plex_items show ON show.rating_key=p.grandparent_rating_key
    JOIN plex_files f ON f.rating_key=p.rating_key
    WHERE p.active AND p.item_type='episode'
    GROUP BY p.rating_key,p.grandparent_rating_key,show.plex_title,p.parent_index,p.item_index,p.plex_title
    HAVING count(*)>1
  ), paged AS (
    SELECT * FROM grouped
    ORDER BY series_title,season_number,episode_number,episode_rating_key
    LIMIT ${safeSize} OFFSET ${offset}
  )
  SELECT g.*,
         jsonb_agg(jsonb_build_object(
           'file_name',f.file_path,
           'size_bytes',f.file_size_bytes,
           'duration_ms',f.duration_ms,
           'container',f.container,
           'media_index',f.media_index,
           'part_index',f.part_index
         ) ORDER BY f.media_index,f.part_index) files
  FROM paged g
  JOIN plex_files f ON f.rating_key=g.episode_rating_key
  GROUP BY g.episode_rating_key,g.show_rating_key,g.series_title,g.season_number,g.episode_number,g.episode_title,g.file_count
  ORDER BY g.series_title,g.season_number,g.episode_number,g.episode_rating_key`;
  return{rows,total,page:safePage,pageSize:safeSize,pages:Math.max(1,Math.ceil(total/safeSize))};
}

export async function rebuildSeriesQualityReadModel(sql=db()){
  await sql`WITH ec AS (SELECT show_rating_key,count(*) FILTER(WHERE effective_status='present')::int present,count(*) FILTER(WHERE effective_status='missing_actionable' AND (air_date IS NOT NULL AND air_date<=CURRENT_DATE-(${SERIES_EPISODE_GRACE_DAYS} * interval '1 day')))::int actionable_missing,count(*) FILTER(WHERE effective_status='availability_unknown' AND (air_date IS NOT NULL AND air_date<=CURRENT_DATE-(${SERIES_EPISODE_GRACE_DAYS} * interval '1 day')))::int availability_unknown,count(*) FILTER(WHERE effective_status='not_available_es' AND (air_date IS NOT NULL AND air_date<=CURRENT_DATE-(${SERIES_EPISODE_GRACE_DAYS} * interval '1 day')))::int not_available_es FROM series_episode_effective_status GROUP BY show_rating_key), px AS (SELECT p.grandparent_rating_key show_rating_key,count(*)::int plex_episodes,count(*) FILTER(WHERE ref.show_rating_key IS NULL AND NOT EXISTS(SELECT 1 FROM series_diagnostics d WHERE d.show_rating_key=p.grandparent_rating_key AND p.rating_key=ANY(string_to_array(COALESCE(d.covered_by_rating_key,''),','))) AND NOT (o.decision IN ('special','not_needed') AND COALESCE(o.note,'') LIKE '%\"ser005\":1%' AND substring(o.note from '\"plex_rating_key\":\"([^\"]*)\"')=p.rating_key AND substring(o.note from '\"plex_fingerprint\":\"([^\"]*)\"')=COALESCE(p.fingerprint,'')))::int unmapped FROM plex_items p LEFT JOIN series_reference_episodes ref ON ref.show_rating_key=p.grandparent_rating_key AND ref.season_number=p.parent_index AND ref.episode_number=p.item_index LEFT JOIN series_episode_overrides o ON o.show_rating_key=p.grandparent_rating_key AND o.season_number=p.parent_index AND o.episode_number=p.item_index WHERE p.active AND p.item_type='episode' GROUP BY p.grandparent_rating_key) INSERT INTO series_quality_read_model(show_rating_key,imdb_id,title,year,poster_path,lifecycle_state,blocking_reason,has_reference,pre_quality_pending,plex_detail_trusted,plex_changed,refreshed_at,next_check_at,reference_invalidated,reference_invalid_reason,tmdb_status,first_air_date,last_air_date,next_air_date,official_seasons,official_episodes,present,actionable_missing,availability_unknown,not_available_es,unmapped_plex_episodes,plex_episodes,updated_at) SELECT p.rating_key,COALESCE(sr.imdb_id,x.external_id),COALESCE(sr.title,p.plex_title),COALESCE(sr.year,p.plex_year),crm.poster_path,cl.lifecycle_state,cl.blocking_reason,(sr.show_rating_key IS NOT NULL),(sr.show_rating_key IS NULL),(sr.plex_detail_refreshed_at IS NOT NULL AND sr.plex_invalidated_at IS NULL),(sr.plex_invalidated_at IS NOT NULL),sr.refreshed_at,sr.next_check_at,(sr.plex_invalidated_at IS NOT NULL),sr.plex_invalid_reason,sr.tmdb_status,sr.first_air_date,sr.last_air_date,sr.next_air_date,sr.official_seasons,sr.official_episodes,COALESCE(ec.present,0),COALESCE(ec.actionable_missing,0),COALESCE(ec.availability_unknown,0),COALESCE(ec.not_available_es,0),COALESCE(px.unmapped,0),COALESCE(px.plex_episodes,0),now() FROM plex_items p LEFT JOIN series_reference sr ON sr.show_rating_key=p.rating_key LEFT JOIN plex_external_ids x ON x.rating_key=p.rating_key AND x.provider='imdb' LEFT JOIN catalog_lifecycle cl ON cl.imdb_id=COALESCE(sr.imdb_id,x.external_id) LEFT JOIN catalog_read_model crm ON crm.imdb_id=COALESCE(sr.imdb_id,x.external_id) LEFT JOIN ec ON ec.show_rating_key=p.rating_key LEFT JOIN px ON px.show_rating_key=p.rating_key WHERE p.active AND p.item_type='show' ON CONFLICT(show_rating_key) DO UPDATE SET imdb_id=EXCLUDED.imdb_id,title=EXCLUDED.title,year=EXCLUDED.year,poster_path=EXCLUDED.poster_path,lifecycle_state=EXCLUDED.lifecycle_state,blocking_reason=EXCLUDED.blocking_reason,has_reference=EXCLUDED.has_reference,pre_quality_pending=EXCLUDED.pre_quality_pending,plex_detail_trusted=EXCLUDED.plex_detail_trusted,plex_changed=EXCLUDED.plex_changed,refreshed_at=EXCLUDED.refreshed_at,next_check_at=EXCLUDED.next_check_at,reference_invalidated=EXCLUDED.reference_invalidated,reference_invalid_reason=EXCLUDED.reference_invalid_reason,tmdb_status=EXCLUDED.tmdb_status,first_air_date=EXCLUDED.first_air_date,last_air_date=EXCLUDED.last_air_date,next_air_date=EXCLUDED.next_air_date,official_seasons=EXCLUDED.official_seasons,official_episodes=EXCLUDED.official_episodes,present=EXCLUDED.present,actionable_missing=EXCLUDED.actionable_missing,availability_unknown=EXCLUDED.availability_unknown,not_available_es=EXCLUDED.not_available_es,unmapped_plex_episodes=EXCLUDED.unmapped_plex_episodes,plex_episodes=EXCLUDED.plex_episodes,updated_at=now()`;
  await sql`DELETE FROM series_quality_read_model rm WHERE NOT EXISTS(SELECT 1 FROM plex_items p WHERE p.rating_key=rm.show_rating_key AND p.active AND p.item_type='show')`;
}

export async function getSeriesQualityV3(filters={}){
  const sql=db(),q=String(filters.q||'').trim().toLowerCase(),state=allowed.has(String(filters.state))?String(filters.state):'attention',episodeState=episodeAllowed.has(String(filters.episode))?String(filters.episode):'all',sort=sortAllowed.has(String(filters.sort))?String(filters.sort):'priority',page=Math.max(1,Number(filters.page)||1),pageSize=50;
  const allClassified=await getClassifiedSeries(sql);
  const counts=buildCounts(allClassified);
  const searched=q?allClassified.filter(r=>String(r.title||'').toLowerCase().includes(q)):allClassified;
  let filtered=state==='all'?searched:state==='attention'?searched.filter(r=>attentionStates.has(r.primaryState)):state==='tracking'?searched.filter(r=>trackingStates.has(r.primaryState)):searched.filter(r=>r.primaryState===state);
  const episodeField={missing:'episode_missing_total',actionable:'episode_actionable_now',spain:'episode_pending_spain',premiere:'episode_pending_premiere'}[episodeState]||null;
  if(episodeField)filtered=filtered.filter(r=>n(r[episodeField])>0);
  const priority={missing:0,unmapped:1,pre_quality:2,plex_sync:3,tmdb_refresh:4,unknown:5,uptodate:6};
  const fallback=(a,b)=>(priority[a.primaryState]-priority[b.primaryState])||(n(b.episode_actionable_now)-n(a.episode_actionable_now))||String(a.title).localeCompare(String(b.title),'es');
  filtered.sort((a,b)=>{
    if(sort==='missing_asc')return(n(a.episode_actionable_now)-n(b.episode_actionable_now))||fallback(a,b);
    if(sort==='missing_desc')return(n(b.episode_actionable_now)-n(a.episode_actionable_now))||fallback(a,b);
    if(sort==='year_asc'||sort==='year_desc'){
      const ay=year(a.year),by=year(b.year);
      if(ay==null&&by!=null)return 1;
      if(ay!=null&&by==null)return-1;
      if(ay!=null&&by!=null&&ay!==by)return sort==='year_asc'?ay-by:by-ay;
      return fallback(a,b);
    }
    return(episodeField?(n(b[episodeField])-n(a[episodeField])):0)||fallback(a,b);
  });
  const total=filtered.length,offset=(page-1)*pageSize,rows=filtered.slice(offset,offset+pageSize);
  const [lastRun]=await sql`SELECT process_code run_type,technical_status status,started_at,finished_at,metrics FROM process_runs WHERE process_code IN('PROC-SER-001','PROC-SER-002','PROC-SER-003','PROC-SER-004','PROC-SER-005','PROC-SER-006') ORDER BY requested_at DESC LIMIT 1`;
  return{rows,counts,total,page,pageSize,pages:Math.max(1,Math.ceil(total/pageSize)),episodeState,sort,lastRun:lastRun||null};
}

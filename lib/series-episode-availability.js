import 'server-only';

const allowed=new Set(['available','not_yet_available']);
const clean=v=>String(v??'').trim();

export async function setEpisodeSpainAvailability(sql,{ratingKey,season,episode,status,source='manual_ui',note=null,sourceUrl=null,providerData=null,confidence='high'}={}){
  const key=clean(ratingKey),sn=Number(season),en=Number(episode),st=clean(status);
  if(!key||!Number.isInteger(sn)||sn<0||!Number.isInteger(en)||en<1)throw new Error('Episodio inválido');
  if(!allowed.has(st))throw new Error('Disponibilidad de episodio inválida');
  const[ref]=await sql`SELECT r.imdb_id,e.name FROM series_reference r JOIN series_reference_episodes e ON e.show_rating_key=r.show_rating_key WHERE r.show_rating_key=${key} AND e.season_number=${sn} AND e.episode_number=${en} LIMIT 1`;
  if(!ref?.imdb_id)throw new Error('El episodio oficial ya no existe');
  const[before]=await sql`SELECT availability_status,source,confidence,available_from,note FROM series_episode_availability WHERE show_rating_key=${key} AND season_number=${sn} AND episode_number=${en} AND country_code='ES' LIMIT 1`;
  await sql`INSERT INTO series_episode_availability(show_rating_key,season_number,episode_number,country_code,availability_status,available_from,source,source_url,provider_data,confidence,checked_at,note) VALUES(${key},${sn},${en},'ES',${st},${st==='available'?new Date().toISOString().slice(0,10):null},${clean(source)||'manual_ui'},${sourceUrl||null},${providerData?JSON.stringify(providerData):null}::jsonb,${clean(confidence)||'high'},now(),${note||null}) ON CONFLICT(show_rating_key,season_number,episode_number,country_code) DO UPDATE SET availability_status=EXCLUDED.availability_status,available_from=CASE WHEN EXCLUDED.availability_status='available' THEN COALESCE(series_episode_availability.available_from,EXCLUDED.available_from) ELSE NULL END,source=EXCLUDED.source,source_url=EXCLUDED.source_url,provider_data=EXCLUDED.provider_data,confidence=EXCLUDED.confidence,checked_at=now(),note=EXCLUDED.note`;
  return{ratingKey:key,season:sn,episode:en,status:st,imdbId:ref.imdb_id,name:ref.name||null,before:before||null};
}

export async function markAllEpisodesSpainAvailable(sql,{ratingKey,source='manual_ui_bulk',note='Todos los episodios oficiales marcados manualmente como emitidos en España'}={}){
  const key=clean(ratingKey);if(!key)throw new Error('Serie inválida');
  const[series]=await sql`SELECT imdb_id FROM series_reference WHERE show_rating_key=${key} LIMIT 1`;if(!series?.imdb_id)throw new Error('Serie no encontrada');
  const[before]=await sql`SELECT count(*)::int total,count(*) FILTER(WHERE ea.availability_status='available')::int already_available,count(*) FILTER(WHERE ea.availability_status='not_yet_available')::int explicit_no FROM series_reference_episodes e LEFT JOIN series_episode_availability ea ON ea.show_rating_key=e.show_rating_key AND ea.season_number=e.season_number AND ea.episode_number=e.episode_number AND ea.country_code='ES' WHERE e.show_rating_key=${key}`;
  await sql`INSERT INTO series_episode_availability(show_rating_key,season_number,episode_number,country_code,availability_status,available_from,source,source_url,provider_data,confidence,checked_at,note) SELECT e.show_rating_key,e.season_number,e.episode_number,'ES','available',CURRENT_DATE,${clean(source)||'manual_ui_bulk'},NULL,NULL::jsonb,'high',now(),${note} FROM series_reference_episodes e WHERE e.show_rating_key=${key} ON CONFLICT(show_rating_key,season_number,episode_number,country_code) DO UPDATE SET availability_status='available',available_from=COALESCE(series_episode_availability.available_from,EXCLUDED.available_from),source=EXCLUDED.source,source_url=NULL,provider_data=NULL,confidence='high',checked_at=now(),note=EXCLUDED.note`;
  return{ratingKey:key,imdbId:series.imdb_id,total:Number(before?.total||0),alreadyAvailable:Number(before?.already_available||0),overwrittenNo:Number(before?.explicit_no||0)};
}

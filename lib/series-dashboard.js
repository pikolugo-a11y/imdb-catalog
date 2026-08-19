import 'server-only';
import {db} from './db';

export async function getSeriesDashboard(showRatingKey){
  const sql=db();
  const key=String(showRatingKey||'');
  if(!key)return{quality:null,seasonQuality:[],technical:null,seasonTechnical:[]};

  let aggregates=[];
  try{
    aggregates=await sql`
      SELECT entity_type,entity_key,parent_key,season_index,score,band,analyzed_count,total_count,formula_version,updated_at
      FROM piko_quality_aggregates
      WHERE (entity_type='show' AND entity_key=${key}) OR (entity_type='season' AND parent_key=${key})
      ORDER BY entity_type,season_index NULLS FIRST`;
  }catch{
    aggregates=[];
  }

  const quality=aggregates.find(x=>x.entity_type==='show')||null;
  const seasonQuality=aggregates.filter(x=>x.entity_type==='season');

  const technicalRows=await sql`
    SELECT m.resolution,m.video_codec,m.audio_codec,m.audio_channels,count(*)::int n
    FROM plex_items p
    JOIN plex_media m ON m.rating_key=p.rating_key AND m.media_index=0
    WHERE p.active AND p.item_type='episode' AND p.grandparent_rating_key=${key}
    GROUP BY m.resolution,m.video_codec,m.audio_codec,m.audio_channels
    ORDER BY n DESC
    LIMIT 1`;

  const seasonTechnicalRows=await sql`
    SELECT p.parent_index season_index,m.resolution,m.video_codec,m.audio_codec,m.audio_channels,count(*)::int n
    FROM plex_items p
    JOIN plex_media m ON m.rating_key=p.rating_key AND m.media_index=0
    WHERE p.active AND p.item_type='episode' AND p.grandparent_rating_key=${key}
    GROUP BY p.parent_index,m.resolution,m.video_codec,m.audio_codec,m.audio_channels
    ORDER BY p.parent_index,n DESC`;

  const seasonTechnical=[];
  for(const row of seasonTechnicalRows){
    if(!seasonTechnical.some(x=>Number(x.season_index)===Number(row.season_index)))seasonTechnical.push(row);
  }

  return{quality,seasonQuality,technical:technicalRows[0]||null,seasonTechnical};
}

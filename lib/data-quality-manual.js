import 'server-only';
import {db} from './db';
import {audit} from './runlog';
import {PIKOSCORE_V3_VERSION} from './pikoscore-v3-core.mjs';

export const MANUAL_RATING_SOURCES=Object.freeze({
  imdb:{label:'IMDb',scale:10,type:'audience'},
  tmdb:{label:'TMDb',scale:100,type:'audience'},
  trakt:{label:'Trakt',scale:100,type:'audience'},
  letterboxd:{label:'Letterboxd',scale:5,type:'cinephile'},
  rt_critics:{label:'RT críticos',scale:100,type:'critics'},
  rt_audience:{label:'RT audiencia',scale:100,type:'audience'},
  metacritic:{label:'Metacritic',scale:100,type:'critics'},
  metacritic_user:{label:'Metacritic usuarios',scale:10,type:'audience'},
  roger_ebert:{label:'Roger Ebert',scale:4,type:'critics'},
});

const validId=v=>{const x=String(v||'').trim();if(!/^tt\d+$/.test(x))throw new Error('IMDb ID inválido');return x};
const clean=v=>String(v??'').trim();
const jsonValue=(value,extra={})=>JSON.stringify({value,source:'manual',updated_at:new Date().toISOString(),...extra});

export async function saveManualDataField(imdbId,field,value){
  imdbId=validId(imdbId);field=clean(field);value=clean(value);if(!value)throw new Error('El valor no puede estar vacío');
  const sql=db();
  if(['title_es','original_title','country'].includes(field))await sql.query(`UPDATE movies SET ${field}=$1,synced_at=now() WHERE imdb_id=$2`,[value,imdbId]);
  else if(field==='year'){const n=Number(value);if(!Number.isInteger(n)||n<1801||n>2200)throw new Error('Año inválido');await sql`UPDATE movies SET year=${n},synced_at=now() WHERE imdb_id=${imdbId}`;}
  else if(field==='runtime'){const n=Number(value);if(!Number.isFinite(n)||n<=0||n>2000)throw new Error('Duración inválida');await sql`UPDATE movies SET runtime=${Math.round(n)},synced_at=now() WHERE imdb_id=${imdbId}`;}
  else if(field==='type'){if(!['Película','Serie','Miniserie'].includes(value))throw new Error('Tipo inválido');await sql`UPDATE movies SET type=${value},synced_at=now() WHERE imdb_id=${imdbId}`;}
  else if(['overview','original_language','release_date'].includes(field)){
    if(field==='release_date'&&!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error('Fecha inválida');
    await sql.query(`INSERT INTO movie_metadata(imdb_id,${field},metadata_enriched_at,metadata_source) VALUES($1,$2,now(),'manual') ON CONFLICT(imdb_id) DO UPDATE SET ${field}=EXCLUDED.${field},metadata_enriched_at=now(),metadata_source='manual'`,[imdbId,value]);
  } else if(field==='genres'){
    const genres=[...new Set(value.split(',').map(x=>x.trim()).filter(Boolean))];if(!genres.length)throw new Error('Indica al menos un género');
    await sql`DELETE FROM movie_genres WHERE imdb_id=${imdbId}`;for(const genre of genres)await sql`INSERT INTO movie_genres(imdb_id,genre) VALUES(${imdbId},${genre}) ON CONFLICT DO NOTHING`;
  } else if(['director','cast'].includes(field)){
    const key=field==='director'?'data_quality_external_director':'data_quality_external_cast';
    await sql.query(`UPDATE movies SET source_status=jsonb_set(COALESCE(source_status,'{}'::jsonb),ARRAY[$1],$2::jsonb,true),synced_at=now() WHERE imdb_id=$3`,[key,jsonValue(value),imdbId]);
  } else if(['poster_path','backdrop_path'].includes(field)){
    if(/^https?:\/\//i.test(value)){
      const key=field==='poster_path'?'data_quality_external_poster':'data_quality_external_backdrop';
      const payload=JSON.stringify({url:value,source:'manual',updated_at:new Date().toISOString()});
      await sql.query(`UPDATE movies SET source_status=jsonb_set(COALESCE(source_status,'{}'::jsonb),ARRAY[$1],$2::jsonb,true),synced_at=now() WHERE imdb_id=$3`,[key,payload,imdbId]);
    }else await sql.query(`UPDATE movies SET ${field}=$1,synced_at=now() WHERE imdb_id=$2`,[value,imdbId]);
  } else throw new Error('Campo no editable manualmente');
  await audit('data_quality','title',imdbId,'manual_field_saved',{field,value:field==='overview'?`${value.slice(0,120)}${value.length>120?'…':''}`:value});
  return{imdbId,field};
}

export async function acceptIncompleteData(imdbId){
  imdbId=validId(imdbId);const sql=db(),payload=JSON.stringify({decision:'accepted_incomplete',source:'manual',updated_at:new Date().toISOString()});
  await sql.query(`UPDATE movies SET source_status=jsonb_set(COALESCE(source_status,'{}'::jsonb),'{data_quality_manual_data}',$1::jsonb,true),synced_at=now() WHERE imdb_id=$2`,[payload,imdbId]);
  await audit('data_quality','title',imdbId,'manual_data_accepted',{decision:'accepted_incomplete'});return{imdbId};
}

export async function saveManualRating(imdbId,source,rating,votes=null){
  imdbId=validId(imdbId);source=clean(source);const cfg=MANUAL_RATING_SOURCES[source];if(!cfg)throw new Error('Fuente de rating inválida');
  const raw=Number(rating);if(!Number.isFinite(raw)||raw<0||raw>cfg.scale)throw new Error(`La puntuación debe estar entre 0 y ${cfg.scale}`);
  const voteNumber=clean(votes)===''?null:Number(votes);if(voteNumber!=null&&(!Number.isFinite(voteNumber)||voteNumber<0))throw new Error('Número de votos inválido');
  const normalized=Math.round((raw/cfg.scale)*1000)/100;const sql=db();
  await sql`INSERT INTO title_ratings(imdb_id,source,rating,scale,normalized_rating,votes,rating_type,provider,observed_at,fetched_at,expires_at,status,raw_payload) VALUES(${imdbId},${source},${raw},${cfg.scale},${normalized},${voteNumber==null?null:Math.round(voteNumber)},${cfg.type},'manual',now(),now(),NULL,'available',${JSON.stringify({manual:true})}::jsonb) ON CONFLICT(imdb_id,source) DO UPDATE SET rating=EXCLUDED.rating,scale=EXCLUDED.scale,normalized_rating=EXCLUDED.normalized_rating,votes=EXCLUDED.votes,rating_type=EXCLUDED.rating_type,provider='manual',observed_at=now(),fetched_at=now(),expires_at=NULL,status='available',raw_payload=EXCLUDED.raw_payload`;
  await sql`UPDATE movies SET ratings_refreshed_at=now(),pikoscore_calculated_at=NULL,pikoscore_version=NULL,pikoscore_confidence=NULL,source_status=COALESCE(source_status,'{}'::jsonb)-'data_quality_manual_ratings',synced_at=now() WHERE imdb_id=${imdbId}`;
  await audit('data_quality','title',imdbId,'manual_rating_saved',{source,rating:raw,scale:cfg.scale,normalized,votes:voteNumber});return{imdbId,source,normalized};
}

export async function fixRatingsAtFive(imdbId){
  imdbId=validId(imdbId);const sql=db(),payload=JSON.stringify({decision:'fixed_five',source:'manual',updated_at:new Date().toISOString()});
  await sql.query(`UPDATE movies SET final_rating=5,pikoscore_calculated_at=now(),pikoscore_version=$1,pikoscore_confidence=0,source_status=jsonb_set(COALESCE(source_status,'{}'::jsonb),'{data_quality_manual_ratings}',$2::jsonb,true),synced_at=now() WHERE imdb_id=$3`,[PIKOSCORE_V3_VERSION,payload,imdbId]);
  await audit('data_quality','title',imdbId,'manual_ratings_fixed_five',{decision:'fixed_five',score:5});return{imdbId,score:5};
}

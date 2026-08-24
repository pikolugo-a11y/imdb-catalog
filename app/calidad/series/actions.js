'use server';
import {revalidatePath} from 'next/cache';
import {db} from '@/lib/db';
import {recomputeLifecycleForIds} from '@/lib/lifecycle';
import {refreshSeriesUnitary} from '@/lib/series-unitary';

export async function refreshOneSeriesAction(_previousState,formData){
  try{
    const imdbId=String(formData.get('imdbId')||'').trim()||null;
    const ratingKey=String(formData.get('ratingKey')||'').trim()||null;
    const r=await refreshSeriesUnitary({imdbId,ratingKey});
    revalidatePath('/calidad');
    revalidatePath('/calidad/series');
    revalidatePath(`/calidad/series/${r.ratingKey}`);
    revalidatePath(`/catalogo/${r.imdbId}`);
    revalidatePath('/admin');
    return{ok:true,message:`Serie actualizada: ${r.seasons} temporadas · ${r.episodes} episodios`};
  }catch(e){
    return{ok:false,message:e?.message||'No se pudo actualizar la serie'};
  }
}

export async function resetSeasonAvailabilityAction(formData){
  const ratingKey=String(formData.get('ratingKey')||'').trim();
  const season=Number(formData.get('season'));
  if(!ratingKey||!Number.isInteger(season)||season<1)throw new Error('Temporada inválida');
  const sql=db();
  const[s]=await sql`SELECT imdb_id FROM series_reference WHERE show_rating_key=${ratingKey} LIMIT 1`;
  if(!s?.imdb_id)throw new Error('Serie no encontrada');
  await sql`UPDATE series_season_availability SET manual_override=false,status='UNKNOWN',source='manual_reset',confidence='unknown',checked_at=now(),note='Override manual retirado; pendiente de refresco automático' WHERE show_rating_key=${ratingKey} AND season_number=${season} AND country_code='ES'`;
  await refreshSeriesUnitary({ratingKey});
  await recomputeLifecycleForIds([s.imdb_id]);
  revalidatePath('/calidad');
  revalidatePath('/calidad/series');
  revalidatePath(`/calidad/series/${ratingKey}`);
  revalidatePath(`/catalogo/${s.imdb_id}`);
}

export async function reviewSeriesExtraAction(formData){
  const ratingKey=String(formData.get('ratingKey')||'').trim();
  const season=Number(formData.get('season'));
  const episode=Number(formData.get('episode'));
  const decision=String(formData.get('decision')||'').trim();
  const note=String(formData.get('note')||'').trim().slice(0,300);
  if(!ratingKey||!Number.isInteger(season)||!Number.isInteger(episode)||season<0||episode<0)throw new Error('Episodio inválido');
  if(!['special','not_needed','reopen'].includes(decision))throw new Error('Decisión inválida');
  const sql=db();
  const[s]=await sql`SELECT imdb_id FROM series_reference WHERE show_rating_key=${ratingKey} LIMIT 1`;
  if(!s?.imdb_id)throw new Error('Serie no encontrada');
  if(decision==='reopen'){
    await sql`DELETE FROM series_episode_overrides WHERE show_rating_key=${ratingKey} AND season_number=${season} AND episode_number=${episode}`;
  }else{
    await sql`INSERT INTO series_episode_overrides(show_rating_key,season_number,episode_number,decision,note,created_at,updated_at) VALUES(${ratingKey},${season},${episode},${decision},${note||null},now(),now()) ON CONFLICT(show_rating_key,season_number,episode_number) DO UPDATE SET decision=EXCLUDED.decision,note=EXCLUDED.note,updated_at=now()`;
  }
  await recomputeLifecycleForIds([s.imdb_id]);
  revalidatePath('/calidad');
  revalidatePath('/calidad/series');
  revalidatePath(`/calidad/series/${ratingKey}`);
  revalidatePath(`/catalogo/${s.imdb_id}`);
}

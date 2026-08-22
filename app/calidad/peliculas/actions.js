'use server';
import {revalidatePath} from 'next/cache';
import {db} from '@/lib/db';
import {saveMovieQualitySettings} from '@/lib/movie-quality-settings';
import {audit} from '@/lib/runlog';

const n=(fd,key,fallback)=>{const v=Number(fd.get(key));return Number.isFinite(v)?v:fallback};
export async function saveMovieQualitySettingsAction(formData){
  const value=await saveMovieQualitySettings({
    duration:{minMinutes:n(formData,'durationMinMinutes',10),minPercent:n(formData,'durationMinPercent',15)},
    filename:{minSimilarity:n(formData,'filenameMinSimilarityPct',55)/100},
    pikoQuality:{minScore:n(formData,'pikoQualityMinScore',60)},
    duplicates:{verySimilarPercent:n(formData,'duplicateVerySimilarPercent',2),differentCutPercent:n(formData,'duplicateDifferentCutPercent',10)}
  });
  await audit('quality','movie_quality','settings','update_criteria',{value});
  revalidatePath('/calidad/peliculas');
  revalidatePath('/calidad');
  revalidatePath('/admin');
}

export async function correctedMovieResetAction(formData){
  const id=Number(formData.get('id'));if(!Number.isFinite(id))throw new Error('Incidencia inválida');
  const sql=db();const[f]=await sql`SELECT id,imdb_id,rating_key,finding_type FROM movie_quality_findings WHERE id=${id}`;
  if(!f?.imdb_id||!['duration','filename','duplicate'].includes(String(f.finding_type||'')))throw new Error('La incidencia no pertenece a la validación de película');
  const imdbId=f.imdb_id,ratingKey=f.rating_key;
  await audit('movie_file_validation','title',imdbId,'corrected_reset_started',{finding_id:id,rating_key:ratingKey,finding_type:f.finding_type});
  await sql.transaction([
    sql`DELETE FROM movie_quality_findings WHERE imdb_id=${imdbId}`,
    sql`DELETE FROM movie_file_validation WHERE imdb_id=${imdbId}`,
    sql`DELETE FROM piko_quality WHERE rating_key=${ratingKey}`,
    sql`DELETE FROM catalog_candidates WHERE imdb_id=${imdbId}`,
    sql`DELETE FROM plex_catalog_status WHERE imdb_id=${imdbId}`,
    sql`DELETE FROM movies WHERE imdb_id=${imdbId}`
  ]);
  await audit('movie_file_validation','title',imdbId,'corrected_reset_completed',{rating_key:ratingKey,next:'plex_sync_to_news'});
  revalidatePath('/calidad/peliculas');revalidatePath('/calidad');revalidatePath('/catalogo');revalidatePath('/novedades');revalidatePath('/plex');revalidatePath('/admin');
}

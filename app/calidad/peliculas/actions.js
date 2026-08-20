'use server';
import {revalidatePath} from 'next/cache';
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

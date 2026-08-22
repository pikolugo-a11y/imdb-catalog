'use server';
import {revalidatePath} from 'next/cache';
import {analyzeMoviePikoQuality} from '@/lib/pikoquality-unitary';

export async function analyzeOnePikoQualityAction(formData){const imdbId=String(formData.get('imdbId')||'');if(!/^tt\d+$/.test(imdbId))throw new Error('IMDb ID inválido');await analyzeMoviePikoQuality(imdbId);revalidatePath('/calidad/pikoquality');revalidatePath('/calidad/peliculas');revalidatePath('/catalogo');revalidatePath(`/catalogo/${imdbId}`);revalidatePath('/admin')}

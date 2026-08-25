'use server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {recomputeLifecycleForIds} from '@/lib/lifecycle';
import {db} from '@/lib/db';
export async function restartMissingLifecycleAction(formData){const imdbId=String(formData.get('imdbId')||'');if(!/^tt\d+$/.test(imdbId))throw new Error('IMDb ID inválido');const sql=db();const[row]=await sql`SELECT m.imdb_id FROM movies m LEFT JOIN catalog_lifecycle cl USING(imdb_id) WHERE m.imdb_id=${imdbId} AND cl.imdb_id IS NULL LIMIT 1`;if(!row)throw new Error('El título ya tiene estado Lifecycle o no existe');await recomputeLifecycleForIds([imdbId]);revalidatePath('/calidad');revalidatePath('/calidad/sin-estado');revalidatePath('/calidad/identidad');revalidatePath('/calidad/validacion-identidad');revalidatePath('/calidad/datos');revalidatePath('/calidad/peliculas');revalidatePath('/calidad/series');revalidatePath('/calidad/pikoquality');revalidatePath(`/catalogo/${imdbId}`);redirect(`/calidad/sin-estado?restarted=${encodeURIComponent(imdbId)}`)}

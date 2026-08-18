'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';

export async function markAcquiring(formData) {
  const imdbId = String(formData.get('imdbId') || '');
  if (!/^tt\d+$/.test(imdbId)) throw new Error('IMDb ID inválido');
  const sql = db();
  await sql`INSERT INTO acquisition_status (imdb_id, status, started_at, updated_at) VALUES (${imdbId}, 'acquiring', now(), now()) ON CONFLICT (imdb_id) DO UPDATE SET status='acquiring', updated_at=now(), completed_at=NULL`;
  revalidatePath('/'); revalidatePath('/catalogo'); revalidatePath(`/catalogo/${imdbId}`); revalidatePath('/sagas');
}

export async function clearAcquiring(formData) {
  const imdbId = String(formData.get('imdbId') || '');
  if (!/^tt\d+$/.test(imdbId)) throw new Error('IMDb ID inválido');
  const sql = db();
  await sql`DELETE FROM acquisition_status WHERE imdb_id=${imdbId}`;
  revalidatePath('/'); revalidatePath('/catalogo'); revalidatePath(`/catalogo/${imdbId}`); revalidatePath('/sagas');
}

export async function resolveMovieReview(formData) {
  const id = Number.parseInt(String(formData.get('id') || ''), 10);
  const status = String(formData.get('status') || '');
  if (!Number.isFinite(id) || !['approved','incorrect','deferred'].includes(status)) throw new Error('Resolución inválida');
  const note = String(formData.get('note') || '').slice(0,500);
  const sql = db();
  await sql`UPDATE plex_review_tasks SET status=${status}, resolution_note=${note || null}, resolved_at=CASE WHEN ${status}='deferred' THEN NULL ELSE now() END, updated_at=now() WHERE id=${id}`;
  revalidatePath('/'); revalidatePath('/calidad/peliculas');
}

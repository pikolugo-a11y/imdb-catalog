'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';

export async function markAcquiring(formData) {
  const imdbId = String(formData.get('imdbId') || '');
  if (!/^tt\d+$/.test(imdbId)) throw new Error('IMDb ID inválido');
  const sql = db();
  await sql`
    INSERT INTO acquisition_status (imdb_id, status, started_at, updated_at)
    VALUES (${imdbId}, 'acquiring', now(), now())
    ON CONFLICT (imdb_id) DO UPDATE SET status = 'acquiring', updated_at = now(), completed_at = NULL
  `;
  revalidatePath('/');
  revalidatePath('/catalogo');
  revalidatePath(`/catalogo/${imdbId}`);
}

export async function clearAcquiring(formData) {
  const imdbId = String(formData.get('imdbId') || '');
  if (!/^tt\d+$/.test(imdbId)) throw new Error('IMDb ID inválido');
  const sql = db();
  await sql`DELETE FROM acquisition_status WHERE imdb_id = ${imdbId}`;
  revalidatePath('/');
  revalidatePath('/catalogo');
  revalidatePath(`/catalogo/${imdbId}`);
}

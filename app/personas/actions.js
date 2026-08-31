'use server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {refreshPersonFilmography} from '@/lib/people-v2';

export async function refreshPersonFilmographyAction(formData){const id=String(formData.get('personId')||'');if(!/^\d+$/.test(id))throw new Error('Persona inválida');const requestKey=`person-refresh:${id}:${Math.floor(Date.now()/3000)}`;await refreshPersonFilmography(id,{requestKey});revalidatePath('/personas');revalidatePath(`/personas/${id}`);redirect(`/personas/${id}?refreshed=1`)}

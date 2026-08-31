'use server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {refreshPersonFilmography} from '@/lib/people-v2';

function safeReturnTo(value,id){const target=String(value||'');if(target.startsWith('/calidad/personas'))return target;if(target.startsWith(`/personas/${id}`))return target;return `/personas/${id}?refreshed=1`}
export async function refreshPersonFilmographyAction(formData){const id=String(formData.get('personId')||'');if(!/^\d+$/.test(id))throw new Error('Persona inválida');const requestKey=`person-refresh:${id}:${Math.floor(Date.now()/3000)}`;await refreshPersonFilmography(id,{requestKey});revalidatePath('/personas');revalidatePath(`/personas/${id}`);revalidatePath('/calidad');revalidatePath('/calidad/personas');redirect(safeReturnTo(formData.get('returnTo'),id))}

'use server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {refreshPeopleLite,refreshPersonFilmography} from '@/lib/people-v2';

export async function refreshPeopleLiteAction(formData){const returnTo=String(formData?.get?.('returnTo')||'/personas');const r=await refreshPeopleLite({limit:60});revalidatePath('/personas');redirect(`${returnTo}${returnTo.includes('?')?'&':'?'}people_refresh=${r.updated}&people_failed=${r.failed}`)}

export async function refreshPersonFilmographyAction(formData){const id=String(formData.get('personId')||'');if(!/^\d+$/.test(id))throw new Error('Persona inválida');await refreshPersonFilmography(id,{force:true});revalidatePath(`/personas/${id}`);redirect(`/personas/${id}?refreshed=1`)}

'use server';
import {revalidatePath} from 'next/cache';
import {db} from '@/lib/db';
import {markIdentityRefreshPending} from '@/lib/identity-refresh';

function refresh(imdbId){revalidatePath('/calidad/identidad');revalidatePath('/calidad/identidad/ambiguos');revalidatePath('/calidad');revalidatePath('/admin');if(imdbId){revalidatePath('/catalogo');revalidatePath(`/catalogo/${imdbId}`)}}
function validImdb(v){const id=String(v||'').trim();if(!/^tt\d+$/.test(id))throw new Error('IMDb ID inválido');return id}
function validFa(v){const id=String(v||'').trim();if(!/^\d+$/.test(id))throw new Error('FilmAffinity ID inválido');return id}

export async function selectFaCandidateAction(formData){const sql=db(),imdbId=validImdb(formData.get('imdbId')),faId=validFa(formData.get('faId'));const patch=JSON.stringify({fa_search:{status:'selected_manual',selected_fa_id:faId,selected_at:new Date().toISOString()},identity_resolver:'fa_ambiguous_manual_selection',identity_resolved_at:new Date().toISOString()});const [r]=await sql`UPDATE movies SET fa_id=${faId},fa_url=${'https://www.filmaffinity.com/es/film'+faId+'.html'},source_status=COALESCE(source_status,'{}'::jsonb)||${patch}::jsonb,synced_at=now() WHERE imdb_id=${imdbId} RETURNING imdb_id`;if(!r)throw new Error('Título no encontrado');await markIdentityRefreshPending(imdbId,'manual_fa_ambiguity_selection');try{await sql`INSERT INTO admin_events(event_type,entity_type,entity_id,action,payload,created_at) VALUES('identity','movie',${imdbId},'fa_ambiguity_selected',${JSON.stringify({fa_id:faId})}::jsonb,now())`}catch{}refresh(imdbId)}

export async function retryFaSearchAction(formData){const sql=db(),imdbId=validImdb(formData.get('imdbId'));await sql`UPDATE movies SET source_status=COALESCE(source_status,'{}'::jsonb)-'fa_search',synced_at=now() WHERE imdb_id=${imdbId} AND fa_id IS NULL`;try{await sql`INSERT INTO admin_events(event_type,entity_type,entity_id,action,payload,created_at) VALUES('identity','movie',${imdbId},'fa_search_reset',${JSON.stringify({reason:'manual_retry'})}::jsonb,now())`}catch{}refresh(imdbId)}

'use server';
import {revalidatePath} from 'next/cache';
import {db} from '@/lib/db';
import {resolveIdentityUnitary} from '@/lib/identity-unitary';
import {validateTmdbIdentity} from '@/lib/identity-resolver';
import {saveIdentity} from '@/lib/identity';
import {markIdentityRefreshPending,refreshKnownIdentity} from '@/lib/identity-refresh';
import {recomputeLifecycleForIds} from '@/lib/lifecycle';

function refresh(imdbId){revalidatePath('/calidad/identidad');revalidatePath('/calidad');revalidatePath('/admin');if(imdbId){revalidatePath('/catalogo');revalidatePath(`/catalogo/${imdbId}`)}}
function imdb(formData,name='imdbId'){const id=String(formData.get(name)||'').trim();if(!/^tt\d+$/.test(id))throw new Error('IMDb ID inválido');return id}
function tmdb(formData){const id=String(formData.get('tmdbId')||'').trim();if(id&&!/^\d+$/.test(id))throw new Error('TMDb ID inválido');return id}

export async function obtainIdentityAction(_prev,formData){
  try{
    const id=imdb(formData),r=await resolveIdentityUnitary(id);refresh(id);
    if(r.complete)return{ok:true,status:'resolved',imdbId:id,message:`Identidad completa · TMDb ${r.tmdbId}`};
    return{ok:false,status:'not_found',imdbId:id,message:'TMDb respondió correctamente, pero no encontró una coincidencia. Puedes corregir el ID manualmente.'};
  }catch(e){return{ok:false,status:'error',message:e?.message||'No se pudo obtener la identidad'}}
}

export async function saveIdentityPageAction(_prev,formData){
  try{
    const old=imdb(formData),newId=imdb(formData,'newImdbId'),tmdbId=tmdb(formData),sql=db();
    const[row]=await sql`SELECT type,COALESCE(title_es,title,original_title) display_title FROM movies WHERE imdb_id=${old}`;
    if(!row)throw new Error('Título no encontrado');
    let validationWarning='';
    if(tmdbId){
      try{
        const check=await validateTmdbIdentity(tmdbId,row.type,newId);
        if(!check.ok)return{ok:false,status:'mismatch',message:`El TMDb ${tmdbId} corresponde a ${check.actualImdbId||'otro IMDb'}${check.title?` · ${check.title}${check.year?` (${check.year})`:''}`:''}. No se ha guardado.`};
      }catch(e){validationWarning=' No se pudo contrastar TMDb en ese momento; se guardó tras validar el formato.'}
    }
    const saved=await saveIdentity(old,{imdbId:newId,tmdbId});
    await markIdentityRefreshPending(saved,'manual_identity_edit');
    await recomputeLifecycleForIds([saved]);
    refresh(old);refresh(saved);
    return{ok:true,status:'saved',imdbId:saved,message:`Identidad guardada${tmdbId?` · TMDb ${tmdbId}`:''}.${validationWarning}`};
  }catch(e){return{ok:false,status:'error',message:e?.message||'No se pudo guardar la identidad'}}
}

export async function refreshIdentityDataAction(_prev,formData){try{const id=imdb(formData),r=await refreshKnownIdentity(id);refresh(id);return{ok:true,message:`Datos refrescados: ${r?.title||id}`}}catch(e){return{ok:false,message:e?.message||'No se pudieron refrescar los datos'}}}

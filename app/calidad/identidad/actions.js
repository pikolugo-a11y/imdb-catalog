'use server';
import {revalidatePath} from 'next/cache';
import {resolveIdentityUnitary} from '@/lib/identity-unitary';
import {saveIdentity} from '@/lib/identity';
import {markIdentityRefreshPending,refreshKnownIdentity} from '@/lib/identity-refresh';

function refresh(imdbId){revalidatePath('/calidad/identidad');revalidatePath('/calidad');revalidatePath('/admin');if(imdbId){revalidatePath('/catalogo');revalidatePath(`/catalogo/${imdbId}`)}}
function imdb(formData,name='imdbId'){const id=String(formData.get(name)||'').trim();if(!/^tt\d+$/.test(id))throw new Error('IMDb ID inválido');return id}
export async function obtainIdentityAction(_prev,formData){try{const id=imdb(formData),r=await resolveIdentityUnitary(id);refresh(id);if(r.complete)return{ok:true,imdbId:id,message:`Identidad completa · TMDb ${r.tmdbId}`};return{ok:false,imdbId:id,message:'No se pudo resolver TMDb automáticamente. Puedes corregir el ID manualmente.'}}catch(e){return{ok:false,message:e?.message||'No se pudo obtener la identidad'}}}
export async function saveIdentityPageAction(formData){const old=imdb(formData),newId=await saveIdentity(old,{imdbId:formData.get('newImdbId'),tmdbId:formData.get('tmdbId'),faId:formData.get('faId')});await markIdentityRefreshPending(newId,'manual_identity_edit');refresh(old);refresh(newId)}
export async function refreshIdentityDataAction(_prev,formData){try{const id=imdb(formData),r=await refreshKnownIdentity(id);refresh(id);return{ok:true,message:`Datos refrescados: ${r?.title||id}`}}catch(e){return{ok:false,message:e?.message||'No se pudieron refrescar los datos'}}}

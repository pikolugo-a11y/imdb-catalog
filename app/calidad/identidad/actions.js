'use server';
import {revalidatePath} from 'next/cache';
import {dispatchIdentityRefresh,cancelIdentityRefresh} from '@/lib/identity-run-control';
import {saveIdentity} from '@/lib/identity';
import {markIdentityRefreshPending,refreshKnownIdentity} from '@/lib/identity-refresh';

function refresh(imdbId){revalidatePath('/calidad/identidad');revalidatePath('/calidad');revalidatePath('/admin');if(imdbId){revalidatePath('/catalogo');revalidatePath(`/catalogo/${imdbId}`)}}
function imdb(formData,name='imdbId'){const id=String(formData.get(name)||'').trim();if(!/^tt\d+$/.test(id))throw new Error('IMDb ID inválido');return id}
export async function startIdentityRefreshAction(){const r=await dispatchIdentityRefresh('identity_page');refresh();if(!r.ok)return r;if(r.alreadyRunning)return{ok:true,message:`Ya hay una reevaluación en curso: ${Number(r.processed||0).toLocaleString('es-ES')} / ${Number(r.total||0).toLocaleString('es-ES')}`};return{ok:true,message:`Reevaluación lanzada para ${Number(r.total||0).toLocaleString('es-ES')} títulos. El progreso aparecerá aquí.`}}
export async function stopIdentityRefreshAction(_prev,formData){const r=await cancelIdentityRefresh(formData.get('runId'));refresh();return r}
export async function saveIdentityPageAction(formData){const old=imdb(formData),newId=await saveIdentity(old,{imdbId:formData.get('newImdbId'),tmdbId:formData.get('tmdbId'),faId:formData.get('faId')});await markIdentityRefreshPending(newId,'manual_identity_edit');refresh(old);refresh(newId)}
export async function refreshIdentityDataAction(_prev,formData){try{const id=imdb(formData),r=await refreshKnownIdentity(id);refresh(id);return{ok:true,message:`Datos refrescados: ${r?.title||id}`}}catch(e){return{ok:false,message:e?.message||'No se pudieron refrescar los datos'}}}

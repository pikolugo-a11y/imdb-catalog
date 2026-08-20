'use server';
import {revalidatePath} from 'next/cache';
import {dispatchIdentityRefresh,cancelIdentityRefresh} from '@/lib/identity-run-control';

function refresh(){revalidatePath('/calidad/identidad');revalidatePath('/calidad');revalidatePath('/admin')}
export async function startIdentityRefreshAction(){const r=await dispatchIdentityRefresh('identity_page');refresh();if(!r.ok)return r;if(r.alreadyRunning)return{ok:true,message:`Ya hay una reevaluación en curso: ${Number(r.processed||0).toLocaleString('es-ES')} / ${Number(r.total||0).toLocaleString('es-ES')}`};return{ok:true,message:`Reevaluación lanzada para ${Number(r.total||0).toLocaleString('es-ES')} títulos. El progreso aparecerá aquí.`}}
export async function stopIdentityRefreshAction(_prev,formData){const r=await cancelIdentityRefresh(formData.get('runId'));refresh();return r}

'use server';
import {revalidatePath} from 'next/cache';
import {pauseAllGenericBatches,resumeAllGenericBatches} from '@/lib/batch-engine';

function refresh(){revalidatePath('/admin');revalidatePath('/calidad/datos');}
export async function pauseAllGenericBatchesAction(){try{await pauseAllGenericBatches({reason:'manual_global'});refresh();return{ok:true,message:'Pausa global activada. Los Batch genéricos terminarán sus items en curso y no reclamarán nuevos.'}}catch(error){refresh();return{ok:false,message:error?.message||'No se pudo pausar los Batch'}}}
export async function resumeAllGenericBatchesAction(){try{await resumeAllGenericBatches();refresh();return{ok:true,message:'Pausa global retirada. Los Batch que individualmente estén en curso pueden continuar.'}}catch(error){refresh();return{ok:false,message:error?.message||'No se pudo reactivar el motor Batch'}}}

'use server';
import {db} from '@/lib/db';
import {getTechnicalControl} from '@/lib/plex-technical-control.mjs';
import {startTechnicalSnapshotAction as startCanonicalTechnicalSnapshotAction} from '@/app/calidad/pikoquality/actions';

const WORKER_FRESH_MS=90000;

export async function startTechnicalSnapshotFromOperationsAction(){
  const sql=db();
  const control=await getTechnicalControl(sql);
  const heartbeatMs=control?.heartbeat_at?new Date(control.heartbeat_at).getTime():0;
  const workerFresh=heartbeatMs>0&&Date.now()-heartbeatMs<WORKER_FRESH_MS;
  if(!workerFresh)throw new Error('El worker técnico de Railway no está disponible. No se ha creado ninguna ejecución.');
  return startCanonicalTechnicalSnapshotAction();
}

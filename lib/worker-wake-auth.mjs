import {createHash,createHmac,timingSafeEqual} from 'node:crypto';

export const WORKER_WAKE_WINDOW_MS=2*60*1000;

function wakeKey(databaseUrl){
  const value=String(databaseUrl||'').trim();
  if(!value)throw new Error('DATABASE_URL obligatorio para autenticar wake de workers');
  return createHash('sha256').update(`pikofilm-worker-wake-v1|${value}`).digest();
}
export function workerWakeSignature(databaseUrl,pool,timestamp){
  return createHmac('sha256',wakeKey(databaseUrl)).update(`${String(pool)}|${String(timestamp)}`).digest('hex');
}
export function buildWorkerWakeAuth(databaseUrl,pool,now=Date.now()){
  const timestamp=String(Math.trunc(Number(now)));
  return{timestamp,signature:workerWakeSignature(databaseUrl,pool,timestamp)};
}
export function verifyWorkerWakeAuth(databaseUrl,pool,{timestamp,signature,now=Date.now(),windowMs=WORKER_WAKE_WINDOW_MS}={}){
  const ts=Number(timestamp);
  if(!Number.isFinite(ts)||Math.abs(Number(now)-ts)>Number(windowMs))return false;
  const expected=Buffer.from(workerWakeSignature(databaseUrl,pool,String(Math.trunc(ts))),'hex');
  let actual;try{actual=Buffer.from(String(signature||''),'hex')}catch{return false}
  return actual.length===expected.length&&timingSafeEqual(actual,expected);
}

export function isPlexTimeoutError(error){
  return error?.name==='TimeoutError'||error?.name==='AbortError'||error?.code===23;
}

export function createPlexTimeoutError(error,{path,attempt=0}={}){
  const attempts=Number(attempt||0)+1;
  const normalized=new Error(`Plex no respondió a tiempo en ${path} tras ${attempts} intento${attempts===1?'':'s'}`,{cause:error});
  normalized.name='PlexTimeoutError';
  normalized.source='plex';
  normalized.retryable=true;
  normalized.plexPath=path;
  normalized.attempts=attempts;
  if(error?.code!==undefined)normalized.code=error.code;
  return normalized;
}

const defaultSleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const defaultSignal=ms=>AbortSignal.timeout(ms);

export async function fetchPlexJsonWithRetry({
  url,
  path,
  headers,
  trace=null,
  timeouts=[45000,60000,90000],
  fetchImpl=globalThis.fetch,
  sleepImpl=defaultSleep,
  signalFactory=defaultSignal
}={}){
  if(!url||!path)throw new Error('Plex request inválida');
  const attempts=(Array.isArray(timeouts)?timeouts:[]).map(Number).filter(x=>Number.isFinite(x)&&x>0);
  if(!attempts.length)throw new Error('Plex request sin timeouts válidos');

  for(let attempt=0;attempt<attempts.length;attempt++){
    trace?.externalCall?.(1);
    try{
      const response=await fetchImpl(url,{
        headers,
        cache:'no-store',
        signal:signalFactory(attempts[attempt])
      });
      if(!response.ok){
        const error=new Error(`Plex ${path} respondió ${response.status}`);
        error.source='plex';
        error.status=response.status;
        error.retryable=response.status===429||response.status>=500;
        throw error;
      }
      return response.json();
    }catch(original){
      const timeout=isPlexTimeoutError(original);
      const error=timeout?createPlexTimeoutError(original,{path,attempt}):original;
      if(error&&typeof error==='object'&&!error.source)error.source='plex';
      if(error&&typeof error==='object'&&error.retryable==null&&original?.name==='TypeError')error.retryable=true;
      const retryable=error?.retryable===true;
      const last=attempt===attempts.length-1;
      if(!retryable||last)throw error;

      await trace?.event?.({
        eventType:'step_warning',
        step:'plex_request_retry',
        message:`Plex no respondió correctamente en ${path}; reintento ${attempt+2}/${attempts.length}`,
        data:{path,attempt:attempt+1,next_timeout_ms:attempts[attempt+1]}
      });
      await trace?.heartbeat?.({step:'plex_request_retry',path,attempt:attempt+1});
      await sleepImpl(Math.min(1000,250*(attempt+1)));
    }
  }

  throw new Error('Plex request agotó los intentos sin resultado');
}

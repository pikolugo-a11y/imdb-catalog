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

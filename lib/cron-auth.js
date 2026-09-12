import 'server-only';

export function getCronAuthState(request){
  const secret=String(process.env.CRON_SECRET||'').trim();
  const authorization=String(request?.headers?.get?.('authorization')||'');
  return{
    authorized:Boolean(secret)&&authorization===`Bearer ${secret}`,
    secretConfigured:Boolean(secret),
    authorizationPresent:Boolean(authorization),
  };
}

export function isCronAuthorized(request){
  return getCronAuthState(request).authorized;
}

export function logCronAuthFailure(route,state){
  console.error('[cron-auth] request rejected',{
    route,
    secretConfigured:Boolean(state?.secretConfigured),
    authorizationPresent:Boolean(state?.authorizationPresent),
  });
}

import 'server-only';

export function isCronAuthorized(request){
  const secret=String(process.env.CRON_SECRET||'').trim();
  if(!secret)return false;
  return request.headers.get('authorization')===`Bearer ${secret}`;
}

import 'server-only';
import {db} from './db';
import {syncPlexFastCore} from './plex-sync-core.mjs';

export async function syncPlexFast(){
  const token=process.env.PLEX_TOKEN;if(!token)throw new Error('PLEX_TOKEN no está configurado en Vercel');
  const baseUrl=process.env.PLEX_URL||process.env.PLEX_BASE_URL||'';
  return syncPlexFastCore({sql:db(),token,baseUrl});
}

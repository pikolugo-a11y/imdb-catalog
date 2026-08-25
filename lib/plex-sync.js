import 'server-only';
import {db} from './db';
import {syncPlexFastCore} from './plex-sync-core.mjs';

export async function syncPlexFast(){
  const token=process.env.PLEX_TOKEN;if(!token)throw new Error('PLEX_TOKEN no está configurado en Vercel');
  const baseUrl=process.env.PLEX_URL||process.env.PLEX_BASE_URL||'';
  const sql=db();
  // Recovery safety: an interrupted section may already have persisted the new
  // updatedAt before its deep GUID/media refresh finished. Force that section
  // through the normal deep-refresh path on the next run.
  await sql`UPDATE plex_items p SET plex_updated_at=NULL WHERE p.active AND EXISTS (SELECT 1 FROM plex_sync_runs r WHERE r.library_section_id=p.library_section_id AND r.status='error' AND r.finished_at>COALESCE((SELECT max(ok.finished_at) FROM plex_sync_runs ok WHERE ok.library_section_id=r.library_section_id AND ok.status='success'),'-infinity'::timestamptz))`;
  // Historical safety net: incomplete identity must not stay frozen merely
  // because the Plex list item itself is otherwise unchanged.
  await sql`UPDATE plex_items p SET plex_updated_at=NULL WHERE p.active AND p.item_type IN('movie','show') AND NOT EXISTS(SELECT 1 FROM plex_external_ids x WHERE x.rating_key=p.rating_key AND x.provider='imdb')`;
  return syncPlexFastCore({sql,token,baseUrl});
}

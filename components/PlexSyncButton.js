import {db} from '@/lib/db';
import PlexSyncButtonClient from './PlexSyncButtonClient';

export default async function PlexSyncButton(){
  const sql=db();
  const [lastComplete]=await sql`SELECT started_at FROM process_runs WHERE process_code='PROC-NOV-008' AND technical_status IN('succeeded','partial') AND finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1`;
  const fallback='2026-08-01';
  const value=lastComplete?.started_at?new Date(lastComplete.started_at).toISOString().slice(0,10):fallback;
  return <PlexSyncButtonClient defaultReviewFrom={value}/>;
}

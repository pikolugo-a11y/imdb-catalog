import {db} from '@/lib/db';
import PlexSyncButtonClient from './PlexSyncButtonClient';

export default async function PlexSyncButton(){
  const sql=db();
  const [lastComplete]=await sql`SELECT started_at FROM pipeline_runs WHERE job_type='plex_fast_sync' AND status='success' AND finished_at IS NOT NULL AND COALESCE((summary->>'identity_review_complete')::boolean,false)=true ORDER BY finished_at DESC LIMIT 1`;
  const fallback='2026-08-01';
  const value=lastComplete?.started_at?new Date(lastComplete.started_at).toISOString().slice(0,10):fallback;
  return <PlexSyncButtonClient defaultReviewFrom={value}/>;
}

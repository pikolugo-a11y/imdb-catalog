import 'server-only';
import {db} from './db';
import {startPikoRelevanceBatch} from './pikorelevancia-batch';

export async function startPikoRelevanceAssessment(imdbId,{origin='calidad_relevancia_manual'}={}){
  const id=String(imdbId||'').trim();
  if(!/^tt\d+$/.test(id))throw new Error('IMDb ID no válido');
  const result=await startPikoRelevanceBatch({entityIds:[id],triggerSource:origin});
  return{runId:result?.run?.run_id||null,reused:Boolean(result?.reused),appended:Number(result?.appended||0)};
}

export async function getPikoRelevanceAssessment(imdbId){
  const id=String(imdbId||'').trim(),sql=db();
  const[row]=await sql`SELECT imdb_id,formula_version,score,confidence,recommendation,title_snapshot,evidence,factors,source_health,assessed_at,next_review_at FROM series_relevance_assessments WHERE imdb_id=${id} LIMIT 1`;
  return row||null;
}

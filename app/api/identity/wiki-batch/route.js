import crypto from 'node:crypto';
import {db} from '@/lib/db';
import {wikidataFaBatch,wikidataFaByTmdbBatch,wikidataFaRetryBatch,saveIdentity} from '@/lib/identity-resolver';
export const dynamic='force-dynamic';
export const maxDuration=60;
const token=()=>crypto.createHash('sha256').update(String(process.env.DATABASE_URL||'')).digest('hex');
export async function POST(req){
  if(!process.env.DATABASE_URL||req.headers.get('x-pikofilm-worker')!==token())return Response.json({ok:false,error:'unauthorized'},{status:401});
  const body=await req.json().catch(()=>({})),runId=Number(body.runId||0),ids=Array.isArray(body.ids)?body.ids.map(String).filter(x=>/^tt\d+$/.test(x)).slice(0,10):[];
  if(!runId||!ids.length)return Response.json({ok:false,error:'invalid_batch'},{status:400});
  const sql=db(),[run]=await sql`SELECT status,summary FROM pipeline_runs WHERE id=${runId} AND job_type='identity_scan'`;
  if(!run||run.status!=='running'||run.summary?.cancel_requested)return Response.json({ok:false,cancelled:true},{status:409});
  const rows=await sql`SELECT imdb_id,type,title,title_es,original_title,year,tmdb_id,fa_id FROM movies WHERE imdb_id=ANY(${ids})`;
  const pending=rows.filter(x=>!x.fa_id),wi=await wikidataFaBatch(pending.map(x=>x.imdb_id));
  const afterImdb=pending.filter(x=>!wi.map[x.imdb_id]&&x.tmdb_id),wt=await wikidataFaByTmdbBatch(afterImdb);
  const afterTmdb=afterImdb.filter(x=>!wt.map[String(x.tmdb_id)]),wr=afterTmdb.length&&!(wi.error||wt.error)?.includes?.('429')?await wikidataFaRetryBatch(afterTmdb.map(x=>x.imdb_id)):{map:{},error:null,ms:0};
  const results=[];
  for(const row of rows){
    let faId=row.fa_id||wi.map[row.imdb_id]||null,method=row.fa_id?'already_complete':faId?'wikidata_imdb':null;
    if(!faId&&row.tmdb_id&&wt.map[String(row.tmdb_id)]){faId=wt.map[String(row.tmdb_id)];method='wikidata_tmdb'}
    if(!faId&&wr.map[row.imdb_id]){faId=wr.map[row.imdb_id];method='wikidata_retry'}
    if(faId&&!row.fa_id)await saveIdentity(row.imdb_id,{faId:String(faId),method});
    results.push({imdbId:row.imdb_id,faId:faId?String(faId):null,updated:Boolean(faId&&!row.fa_id),method:method||'wikidata_not_found',row:{imdb_id:row.imdb_id,type:row.type,title:row.title,title_es:row.title_es,original_title:row.original_title,year:row.year,tmdb_id:row.tmdb_id}})
  }
  return Response.json({ok:true,results,stats:{wikidata_imdb:Object.keys(wi.map).length,wikidata_tmdb:Object.keys(wt.map).length,wikidata_retry:Object.keys(wr.map).length},wikidata:{imdb_error:wi.error,tmdb_error:wt.error,retry_error:wr.error}})
}

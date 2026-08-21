import crypto from 'node:crypto';
import {db} from '@/lib/db';
import {validateOne} from '@/lib/identity-validation';
export const dynamic='force-dynamic';
export const maxDuration=60;
const workerToken=()=>crypto.createHash('sha256').update(String(process.env.DATABASE_URL||'')).digest('hex');
export async function POST(req){
 if(!process.env.DATABASE_URL||req.headers.get('x-pikofilm-worker')!==workerToken())return Response.json({ok:false,error:'unauthorized'},{status:401});
 const body=await req.json().catch(()=>({})),runId=Number(body.runId||0),items=Array.isArray(body.items)?body.items.slice(0,10):[];if(!runId||!items.length)return Response.json({ok:false,error:'invalid_batch'},{status:400});const sql=db(),[run]=await sql`SELECT status,summary FROM pipeline_runs WHERE id=${runId} AND job_type='identity_validation'`;if(!run||run.status!=='running'||run.summary?.cancel_requested)return Response.json({ok:false,cancelled:true},{status:409});const out=[];
 for(const item of items){const imdbId=String(item?.imdbId||'');if(!/^tt\d+$/.test(imdbId)){out.push({imdbId,ok:false,error:'IMDb inválido'});continue}const[state]=await sql`SELECT status,summary FROM pipeline_runs WHERE id=${runId}`;if(!state||state.status!=='running'||state.summary?.cancel_requested)return Response.json({ok:true,cancelled:true,results:out});try{const v=await validateOne(imdbId,{imdbEvidence:{imdb_title:item.imdbTitle||null,imdb_original_title:item.imdbOriginalTitle||null,imdb_year:Number(item.imdbYear)||null}});out.push({imdbId,ok:true,status:v.status,score:v.score,suspected:v.suspected})}catch(e){out.push({imdbId,ok:false,error:e?.message||String(e)})}}
 return Response.json({ok:true,results:out});
}

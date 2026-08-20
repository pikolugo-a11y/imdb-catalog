import crypto from 'node:crypto';
import {db} from '@/lib/db';
import {enrichTitle} from '@/lib/enrich-title';
export const dynamic='force-dynamic';
export const maxDuration=60;

const workerToken=()=>crypto.createHash('sha256').update(String(process.env.DATABASE_URL||'')).digest('hex');
export async function POST(req){
  if(!process.env.DATABASE_URL||req.headers.get('x-pikofilm-worker')!==workerToken())return Response.json({ok:false,error:'unauthorized'},{status:401});
  const body=await req.json().catch(()=>({})),runId=Number(body.runId||0),ids=Array.isArray(body.ids)?body.ids.map(String).filter(x=>/^tt\d+$/.test(x)).slice(0,8):[];
  if(!runId||!ids.length)return Response.json({ok:false,error:'invalid_batch'},{status:400});
  const sql=db(),[run]=await sql`SELECT status,summary FROM pipeline_runs WHERE id=${runId} AND job_type='identity_scan'`;
  if(!run||run.status!=='running'||run.summary?.cancel_requested)return Response.json({ok:false,cancelled:true},{status:409});
  const out=[];
  for(const imdbId of ids){
    const [state]=await sql`SELECT status,summary FROM pipeline_runs WHERE id=${runId}`;
    if(!state||state.status!=='running'||state.summary?.cancel_requested)return Response.json({ok:true,cancelled:true,results:out});
    try{const r=await enrichTitle(imdbId);out.push({imdbId,ok:true,title:r?.title||null})}catch(e){out.push({imdbId,ok:false,error:e?.message||String(e)})}
  }
  return Response.json({ok:true,results:out});
}

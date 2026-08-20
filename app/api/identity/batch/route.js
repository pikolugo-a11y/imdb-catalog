import crypto from 'node:crypto';
import {db} from '@/lib/db';
import {resolveTmdbOnly,wikidataFaBatch,searchFaDirect,saveIdentity} from '@/lib/identity-resolver';
export const dynamic='force-dynamic';
export const maxDuration=60;
const workerToken=()=>crypto.createHash('sha256').update(String(process.env.DATABASE_URL||'')).digest('hex');
export async function POST(req){
 if(!process.env.DATABASE_URL||req.headers.get('x-pikofilm-worker')!==workerToken())return Response.json({ok:false,error:'unauthorized'},{status:401});
 const body=await req.json().catch(()=>({})),runId=Number(body.runId||0),ids=Array.isArray(body.ids)?body.ids.map(String).filter(x=>/^tt\d+$/.test(x)).slice(0,8):[],mode=String(body.mode||'auto');
 if(!runId||!ids.length)return Response.json({ok:false,error:'invalid_batch'},{status:400});const sql=db(),[run]=await sql`SELECT status,summary FROM pipeline_runs WHERE id=${runId} AND job_type='identity_scan'`;
 if(!run||run.status!=='running'||run.summary?.cancel_requested)return Response.json({ok:false,cancelled:true},{status:409});
 const rows=await sql`SELECT imdb_id,type,title,title_es,original_title,year,tmdb_id,fa_id FROM movies WHERE imdb_id=ANY(${ids})`,by=new Map(rows.map(x=>[x.imdb_id,x])),out=[];
 let wiki={map:{},error:null,ms:0};if(mode==='fa')wiki=await wikidataFaBatch(rows.filter(x=>!x.fa_id).map(x=>x.imdb_id));
 for(const imdbId of ids){const [state]=await sql`SELECT status,summary FROM pipeline_runs WHERE id=${runId}`;if(!state||state.status!=='running'||state.summary?.cancel_requested)return Response.json({ok:true,cancelled:true,results:out,wikidata:wiki});const row=by.get(imdbId);if(!row){out.push({imdbId,ok:false,error:'Título no encontrado'});continue}try{let tmdbId=null,faId=null,method=[];
   if(mode==='tmdb'&&!row.tmdb_id){tmdbId=await resolveTmdbOnly(imdbId,row.type);if(tmdbId)method.push('tmdb_imdb')}
   if(mode==='fa'&&!row.fa_id){faId=wiki.map[imdbId]||null;if(faId)method.push('wikidata_imdb');else{const r=await searchFaDirect(row);faId=r.faId;if(faId)method.push(r.method);else method.push(r.method||'fa_missing')}}
   if(tmdbId||faId)await saveIdentity(imdbId,{tmdbId,faId,method:method.join('+')});out.push({imdbId,ok:true,updated:Boolean(tmdbId||faId),tmdbId,faId,method:method.join('+')||'already_complete'});
 }catch(e){out.push({imdbId,ok:false,error:e?.message||String(e)})}}
 return Response.json({ok:true,results:out,wikidata:{error:wiki.error,ms:wiki.ms,hits:Object.keys(wiki.map).length}});
}

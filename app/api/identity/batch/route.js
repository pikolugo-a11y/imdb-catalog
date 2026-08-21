import crypto from 'node:crypto';
import {db} from '@/lib/db';
import {resolveTmdbOnly,wikidataFaBatch,wikidataFaByTmdbBatch,wikidataFaRetryBatch,searchFaBrave,saveIdentity} from '@/lib/identity-resolver';
export const dynamic='force-dynamic';
export const maxDuration=60;
const workerToken=()=>crypto.createHash('sha256').update(String(process.env.DATABASE_URL||'')).digest('hex');
export async function POST(req){
 if(!process.env.DATABASE_URL||req.headers.get('x-pikofilm-worker')!==workerToken())return Response.json({ok:false,error:'unauthorized'},{status:401});
 const body=await req.json().catch(()=>({})),runId=Number(body.runId||0),ids=Array.isArray(body.ids)?body.ids.map(String).filter(x=>/^tt\d+$/.test(x)).slice(0,8):[],mode=String(body.mode||'auto');
 if(!runId||!ids.length)return Response.json({ok:false,error:'invalid_batch'},{status:400});const sql=db(),[run]=await sql`SELECT status,summary FROM pipeline_runs WHERE id=${runId} AND job_type='identity_scan'`;
 if(!run||run.status!=='running'||run.summary?.cancel_requested)return Response.json({ok:false,cancelled:true},{status:409});
 const rows=await sql`SELECT imdb_id,type,title,title_es,original_title,year,tmdb_id,fa_id FROM movies WHERE imdb_id=ANY(${ids})`,by=new Map(rows.map(x=>[x.imdb_id,x])),out=[];
 let wi={map:{},error:null,ms:0},wt={map:{},error:null,ms:0,requests:0},wr={map:{},error:null,ms:0};
 if(mode==='fa'){
   const pending=rows.filter(x=>!x.fa_id);wi=await wikidataFaBatch(pending.map(x=>x.imdb_id));
   const afterImdb=pending.filter(x=>!wi.map[x.imdb_id]&&x.tmdb_id);wt=await wikidataFaByTmdbBatch(afterImdb);
   const afterTmdb=afterImdb.filter(x=>!wt.map[String(x.tmdb_id)]);if(afterTmdb.length&&!(wi.error||wt.error)?.includes?.('429'))wr=await wikidataFaRetryBatch(afterTmdb.map(x=>x.imdb_id));
 }
 let braveHits=0,braveBlocked=0,notFound=0;
 for(const imdbId of ids){const [state]=await sql`SELECT status,summary FROM pipeline_runs WHERE id=${runId}`;if(!state||state.status!=='running'||state.summary?.cancel_requested)return Response.json({ok:true,cancelled:true,results:out});const row=by.get(imdbId);if(!row){out.push({imdbId,ok:false,error:'Título no encontrado'});continue}try{let tmdbId=null,faId=null,method=[],brave=null;
   if(mode==='tmdb'&&!row.tmdb_id){tmdbId=await resolveTmdbOnly(imdbId,row.type);if(tmdbId)method.push('tmdb_imdb')}
   if(mode==='fa'&&!row.fa_id){faId=wi.map[imdbId]||null;if(faId)method.push('wikidata_imdb');if(!faId&&row.tmdb_id){faId=wt.map[String(row.tmdb_id)]||null;if(faId)method.push('wikidata_tmdb')}if(!faId){faId=wr.map[imdbId]||null;if(faId)method.push('wikidata_retry')}if(!faId){brave=await searchFaBrave(row);faId=brave.faId;if(faId){method.push('fa_brave');braveHits++}else{method.push(brave.method||'fa_brave_not_found');notFound++;if(brave.blocked)braveBlocked++}}}
   if(tmdbId||faId)await saveIdentity(imdbId,{tmdbId,faId,method:method.join('+')});out.push({imdbId,ok:true,updated:Boolean(tmdbId||faId),tmdbId,faId,method:method.join('+')||'already_complete',brave:brave?{blocked:Boolean(brave.blocked),status:brave.status||null,error:brave.error||null,requests:Number(brave.requests||0)}:null});
 }catch(e){out.push({imdbId,ok:false,error:e?.message||String(e)})}}
 return Response.json({ok:true,results:out,stats:{wikidata_imdb:Object.keys(wi.map).length,wikidata_tmdb:Object.keys(wt.map).length,wikidata_retry:Object.keys(wr.map).length,brave_fa:braveHits,brave_blocked:braveBlocked,not_found:notFound},wikidata:{imdb_error:wi.error,tmdb_error:wt.error,retry_error:wr.error,ms:Number(wi.ms||0)+Number(wt.ms||0)+Number(wr.ms||0)}});
}

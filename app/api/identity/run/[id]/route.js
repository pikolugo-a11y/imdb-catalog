import {NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {recomputeLifecycleForIds} from '@/lib/lifecycle';

export const dynamic='force-dynamic';
export async function GET(_request,{params}){
  const {id}=await params,runId=Number(id);if(!Number.isFinite(runId))return NextResponse.json({done:true,ok:false,message:'Ejecución inválida'},{status:400});
  const sql=db(),[run]=await sql`SELECT id,status,summary,error_count FROM pipeline_runs WHERE id=${runId} AND job_type='identity_scan' LIMIT 1`;
  if(!run)return NextResponse.json({done:true,ok:false,message:'Ejecución no encontrada'},{status:404});
  if(run.status==='running')return NextResponse.json({done:false,ok:true,message:'Obteniendo identidad…',progress:Number(run.summary?.progress_pct||0),stage:run.summary?.current_block||run.summary?.stage||'Preparando'});
  const s=run.summary||{},imdbId=String(s.imdb_id||'');
  if(run.status!=='success')return NextResponse.json({done:true,ok:false,message:s.error?.message||s.message||'No se pudo obtener la identidad'});
  if(imdbId)await recomputeLifecycleForIds([imdbId]);
  const [movie]=imdbId?await sql`SELECT tmdb_id,fa_id FROM movies WHERE imdb_id=${imdbId}`:[];
  const complete=Boolean(movie?.tmdb_id&&movie?.fa_id);
  if(complete)return NextResponse.json({done:true,ok:true,message:`Identidad completa · TMDb ${movie.tmdb_id} · FilmAffinity ${movie.fa_id}. Pasa a Validación de identidad.`,nextState:'IDENTITY_VALIDATION',nextUrl:'/calidad/validacion-identidad'});
  const missing=[!movie?.tmdb_id?'TMDb':null,!movie?.fa_id?'FilmAffinity':null].filter(Boolean);
  return NextResponse.json({done:true,ok:false,message:`Identidad incompleta. Falta: ${missing.join(', ')||'datos de identidad'}. Permanece en Identidad.`,nextState:'IDENTITY_PENDING'});
}

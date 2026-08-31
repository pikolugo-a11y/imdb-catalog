'use server';
import {revalidatePath} from 'next/cache';
import {db} from '@/lib/db';
import {saveMovieQualitySettings} from '@/lib/movie-quality-settings';
import {audit} from '@/lib/runlog';
import {validateMovieFile,getMovieFileValidationSnapshot} from '@/lib/movie-file-validation';
import {setMovieQualityFindingAction,getMovieQualityFinding} from '@/lib/movie-quality-actions';
import {recomputeLifecycleForIds,getLifecycleForIds} from '@/lib/lifecycle';
import {executeObservedProcess} from '@/lib/process-runtime';

const n=(fd,key,fallback)=>{const v=Number(fd.get(key));return Number.isFinite(v)?v:fallback};
function refresh(imdbId){revalidatePath('/calidad/peliculas');revalidatePath('/calidad');revalidatePath('/calidad/pikoquality');revalidatePath('/admin');if(imdbId)revalidatePath(`/catalogo/${imdbId}`)}
export async function validateMovieFileAction(formData){const imdbId=String(formData.get('imdbId')||'').trim();if(!/^tt\d+$/.test(imdbId))throw new Error('IMDb ID inválido');const r=await validateMovieFile(imdbId);refresh(imdbId);return r.reused?{ok:true,status:'duplicate',runId:r.runId,message:'Esta película ya se está analizando o acaba de analizarse.'}:{ok:true,status:r.functionalResult||'updated',runId:r.runId,message:r.message||'Película analizada'}}

export async function qualityAction(formData){
 const id=Number(formData.get('id')),action=String(formData.get('action')||''),note=String(formData.get('note')||'');if(!Number.isFinite(id)||!['exception','waiting_sync','reopen'].includes(action))throw new Error('Acción inválida');
 const finding=await getMovieQualityFinding(id);if(!finding)throw new Error('Incidencia no encontrada');const imdbId=finding.imdb_id;
 if(action!=='exception'){await setMovieQualityFindingAction(id,action,note);await audit('quality','finding',String(id),action,{note});if(imdbId)await recomputeLifecycleForIds([imdbId]);refresh(imdbId);return}
 const requestKey=`PROC-MOV-002:manual:${id}:${Math.floor(Date.now()/5000)}`;
 const observed=await executeObservedProcess({processCode:'PROC-MOV-002',runKind:'individual',triggerSource:'calidad_peliculas_manual',executor:'vercel',entityType:'movie',entityId:imdbId,correlationKey:requestKey,idempotencyKey:requestKey,context:{surface:'/calidad/peliculas',operation:'accept_movie_file_exception',finding_id:id}},async trace=>{
   const beforeLifecycle=(await getLifecycleForIds([imdbId])).get(imdbId),before={finding_id:id,finding_type:finding.finding_type,status:finding.status,fingerprint:finding.fingerprint,details:finding.details||{},lifecycle:beforeLifecycle?.state||null};
   await trace.event({eventType:'step_started',step:'validate_exception_current',message:'Comprobando que la incidencia pertenece al archivo físico vigente',data:{finding_id:id,finding_type:finding.finding_type,fingerprint:finding.fingerprint}});
   const changed=await setMovieQualityFindingAction(id,'exception',note);
   await trace.event({eventType:'manual_decision',step:'accept_exception',message:'Incidencia aceptada como excepción para el fingerprint físico vigente',data:{decision:'accepted_exception',finding_id:id,finding_type:finding.finding_type,fingerprint:finding.fingerprint,physical_files:changed.current?.physicalFiles||null,note:note||null}});
   const lifecycle=(await recomputeLifecycleForIds([imdbId])).get(imdbId),afterFinding=await getMovieQualityFinding(id),after={finding_id:id,status:afterFinding?.status||'exception',fingerprint:afterFinding?.fingerprint||finding.fingerprint,lifecycle:lifecycle?.state||null};
   await audit('quality','finding',String(id),'exception',{note,imdb_id:imdbId,finding_type:finding.finding_type,fingerprint:finding.fingerprint});
   return{technicalStatus:'succeeded',functionalResult:finding.status==='exception'?'no_change':'updated',before,after,metrics:{finding_id:id,physical_files:changed.current?.physicalFiles||0},message:'Incidencia aceptada como excepción para el archivo físico actual'};
 });
 refresh(imdbId);return observed.reused?{ok:true,status:'duplicate',runId:observed.runId,message:'Esta decisión ya se está procesando o acaba de procesarse.'}:{ok:true,status:observed.result?.functionalResult||'updated',runId:observed.runId,message:observed.result?.message};
}

export async function saveMovieQualitySettingsAction(formData){const value=await saveMovieQualitySettings({duration:{minMinutes:n(formData,'durationMinMinutes',10),minPercent:n(formData,'durationMinPercent',15)},filename:{minSimilarity:n(formData,'filenameMinSimilarityPct',55)/100},pikoQuality:{minScore:n(formData,'pikoQualityMinScore',60)},duplicates:{verySimilarPercent:n(formData,'duplicateVerySimilarPercent',2),differentCutPercent:n(formData,'duplicateDifferentCutPercent',10)}});await audit('quality','movie_quality','settings','update_criteria',{value});refresh()}
export async function correctedMovieResetAction(formData){const id=Number(formData.get('id'));if(!Number.isFinite(id))throw new Error('Incidencia inválida');const sql=db();const[f]=await sql`SELECT id,imdb_id,rating_key,finding_type FROM movie_quality_findings WHERE id=${id}`;if(!f?.imdb_id||!['duration','filename','duplicate'].includes(String(f.finding_type||'')))throw new Error('La incidencia no pertenece a la validación de película');const imdbId=f.imdb_id,ratingKey=f.rating_key;await audit('movie_file_validation','title',imdbId,'corrected_reset_started',{finding_id:id,rating_key:ratingKey,finding_type:f.finding_type});await sql.transaction([sql`DELETE FROM movie_quality_findings WHERE imdb_id=${imdbId}`,sql`DELETE FROM movie_file_validation WHERE imdb_id=${imdbId}`,sql`DELETE FROM piko_quality WHERE rating_key=${ratingKey}`,sql`DELETE FROM catalog_candidates WHERE imdb_id=${imdbId}`,sql`DELETE FROM plex_catalog_status WHERE imdb_id=${imdbId}`,sql`DELETE FROM movies WHERE imdb_id=${imdbId}`]);await audit('movie_file_validation','title',imdbId,'corrected_reset_completed',{rating_key:ratingKey,next:'plex_sync_to_news'});revalidatePath('/calidad/peliculas');revalidatePath('/calidad');revalidatePath('/catalogo');revalidatePath('/novedades');revalidatePath('/plex');revalidatePath('/admin')}

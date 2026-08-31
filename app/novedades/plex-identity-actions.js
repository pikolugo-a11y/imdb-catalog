'use server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {db} from '@/lib/db';
import {setPlexIdentity} from '@/lib/identity';
import {audit} from '@/lib/runlog';
import {executeObservedProcess} from '@/lib/process-runtime';
import {recomputeLifecycleForIds} from '@/lib/lifecycle';

const imdbOk=value=>/^tt\d+$/.test(String(value||''));
const typeOf=itemType=>itemType==='movie'?'movie':itemType==='show'?'tvSeries':null;

function refresh(imdbId){
  revalidatePath('/novedades');
  revalidatePath('/plex');
  revalidatePath('/calidad/identidad');
  revalidatePath('/admin');
  if(imdbId)revalidatePath(`/catalogo/${imdbId}`);
}

export async function savePlexIdentityFromNewsAction(formData){
  const ratingKey=String(formData.get('ratingKey')||'').trim();
  const imdbId=String(formData.get('imdbId')||'').trim();
  if(!ratingKey)throw new Error('ratingKey vacío');
  if(!imdbOk(imdbId))throw new Error('IMDb ID inválido');
  const bucket=Math.floor(Date.now()/3000);
  const observed=await executeObservedProcess({
    processCode:'PROC-NOV-010',runKind:'individual',triggerSource:'novedades_manual',executor:'vercel',
    entityType:'title',entityId:imdbId,correlationKey:`PROC-NOV-010:${ratingKey}:${imdbId}:${bucket}`,
    idempotencyKey:`PROC-NOV-010:${ratingKey}:${imdbId}:${bucket}`,
    context:{surface:'/novedades',operation:'save_manual_plex_imdb',rating_key:ratingKey}
  },async trace=>{
    const sql=db();
    const [plex]=await sql`SELECT rating_key,plex_title,plex_year,item_type FROM plex_items WHERE rating_key=${ratingKey} AND active AND item_type IN('movie','show') LIMIT 1`;
    if(!plex)return{technicalStatus:'succeeded',functionalResult:'not_found',message:'Ítem Plex no encontrado',metrics:{rating_key:ratingKey}};
    const title=String(plex.plex_title||'').trim();
    const candidateType=typeOf(plex.item_type);
    if(!title||!candidateType)return{technicalStatus:'succeeded',functionalResult:'invalid',message:'Plex no aporta título/tipo mínimo',metrics:{rating_key:ratingKey}};
    await trace.event({eventType:'step',step:'protect_manual_imdb',message:'Guardando y protegiendo IMDb manual'});
    await setPlexIdentity(ratingKey,{imdbId});
    const [existing]=await sql`SELECT imdb_id FROM movies WHERE imdb_id=${imdbId} LIMIT 1`;
    if(existing){
      await recomputeLifecycleForIds([imdbId]);
      await audit('identity','plex',ratingKey,'manual_imdb_catalogued',{imdb_id:imdbId});
      return{technicalStatus:'succeeded',functionalResult:'updated',message:'IMDb manual guardado; el título ya estaba en catálogo',metrics:{catalogued:1,candidate_created:0}};
    }
    await trace.event({eventType:'step',step:'route_to_news',message:'Creando candidato Plex mínimo en Novedades'});
    const snapshot={origin:'plex',matchedRule:'plex_manual_identity',manualPlexIdentity:true,manualPlexIdentityAt:new Date().toISOString(),ratingKey,title,discoveryVersion:'novedades-v1'};
    await sql`INSERT INTO catalog_candidates(imdb_id,candidate_type,year,eligibility_status,first_seen_at,last_seen_at,last_evaluated_at,source_snapshot,created_at,updated_at) VALUES(${imdbId},${candidateType},${plex.plex_year||null},'eligible',now(),now(),now(),${JSON.stringify(snapshot)}::jsonb,now(),now()) ON CONFLICT(imdb_id) DO UPDATE SET candidate_type=EXCLUDED.candidate_type,year=COALESCE(catalog_candidates.year,EXCLUDED.year),eligibility_status='eligible',last_seen_at=now(),last_evaluated_at=now(),source_snapshot=COALESCE(catalog_candidates.source_snapshot,'{}'::jsonb)||EXCLUDED.source_snapshot,updated_at=now()`;
    await audit('identity','plex',ratingKey,'routed_to_news',{imdb_id:imdbId,direct_minimum:true,no_enrichment:true});
    return{technicalStatus:'succeeded',functionalResult:'updated',message:'IMDb manual guardado y candidato Plex listo en Novedades',metrics:{catalogued:0,candidate_created:1,external_calls:0}};
  });
  refresh(imdbId);
  const result=observed.result;
  if(result?.functionalResult==='not_found')redirect('/novedades?notice=plex_identity_missing');
  if(result?.functionalResult==='invalid')redirect('/novedades?notice=plex_identity_incomplete');
  redirect(`/novedades?q=${encodeURIComponent(imdbId)}&notice=plex_identity_saved`);
}

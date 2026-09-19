import {seedPlexNewsCandidates} from './plex-news-seed.js';

export async function executeNov008(sql,id,{trace}={}){
  if(String(id)!=='global')throw Object.assign(new Error('NOV-008 sólo admite la unidad global'),{permanent:true,retryable:false,processStep:'validate_global_unit'});
  await trace?.event?.({eventType:'step_started',step:'seed_news',message:'Sembrando candidatos Plex en Novedades'});
  const news=await seedPlexNewsCandidates({sql,trace});
  await trace?.event?.({eventType:'step_completed',step:'seed_news',message:'Siembra Plex completada',data:news});
  return{technicalStatus:'succeeded',functionalResult:(news.seeded||news.resolved)?'updated':'no_change',metrics:{candidates_seeded:news.seeded||0,candidates_ready:news.resolved||0,candidates_pending:news.pending||0,seed_failures:news.failed||0},after:{news},message:news.failed?`Candidatos Plex sembrados en Novedades con ${news.failed} incidencias`:'Candidatos Plex sembrados en Novedades'};
}

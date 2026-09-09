export const QUALITY_STATE_STAGE=Object.freeze({IDENTITY_PENDING:'identity',IDENTITY_VALIDATION:'validation',IDENTITY_REVIEW_REQUIRED:'validation',DATA_INCOMPLETE:'data',PIKOSCORE_PENDING:'data',MOVIE_FILE_PENDING:'movies',MOVIE_FILE_REVIEW:'movies',SERIES_SYNC_PENDING:'series',SERIES_REVIEW:'series',TECH_PENDING:'pikoquality',COMPLETE:'complete',EXCLUDED:'excluded'});

export const QUALITY_STAGE_META=Object.freeze([
{id:'recovery',label:'Integridad Lifecycle',href:'/calidad/sin-estado',description:'Títulos del catálogo sin estado Lifecycle o con incoherencias estructurales',cta:'Revisar integridad',group:'center'},
{id:'identity',label:'Identidad',href:'/calidad/identidad',description:'IMDb/TMDb pendientes de completar',cta:'Abrir identidad',group:'center'},
{id:'validation',label:'Validación',href:'/calidad/validacion-identidad',description:'Identidades pendientes de validar o revisar',cta:'Abrir validación',group:'center'},
{id:'data',label:'Datos / PikoScore',href:'/calidad/datos',description:'Datos, ratings o PikoScore en seguimiento',cta:'Abrir datos',group:'center'},
{id:'movies',label:'Películas',href:'/calidad/peliculas',description:'Validación y revisión del archivo físico de películas',cta:'Abrir películas',group:'specialized'},
{id:'series',label:'Series',href:'/calidad/series',description:'Episodios, Plex, TMDb y disponibilidad España',cta:'Abrir series',group:'specialized'},
{id:'pikoquality',label:'PikoQuality',href:'/calidad/pikoquality',description:'Calidad técnica y vigencia del archivo físico',cta:'Abrir PikoQuality',group:'center'},
{id:'people',label:'Personas',href:'/calidad/personas',description:'Vigencia de perfiles y filmografías',cta:'Abrir personas',group:'center'}
]);

export const QUALITY_CENTER_STAGE_IDS=Object.freeze(['identity','validation','data','people','pikoquality','recovery']);
export const QUALITY_SPECIALIZED_STAGE_IDS=Object.freeze(['movies','series']);

const sum=(counts,states)=>states.reduce((n,s)=>n+Number(counts?.[s]||0),0);
function statusFor(id,count,counts){
  if(id==='recovery')return count>0?{key:'blocked',label:'Requiere atención',icon:'!'}:{key:'healthy',label:'Al día',icon:'✓'};
  if(id==='validation'&&Number(counts.IDENTITY_REVIEW_REQUIRED||0)>0)return{key:'attention',label:'Requiere atención',icon:'!'};
  if(id==='movies'&&Number(counts.MOVIE_FILE_REVIEW||0)>0)return{key:'attention',label:'Requiere atención',icon:'!'};
  if(id==='series'&&count>0)return{key:'attention',label:'Requiere atención',icon:'!'};
  if(count>0)return{key:'pending',label:'En seguimiento',icon:'•'};
  return{key:'healthy',label:'Al día',icon:'✓'};
}

export function buildQualityHome(snapshot={}){
  const counts=snapshot.counts||{};
  const integrity={orphaned:Number(snapshot.integrity?.orphaned||0),unknown:Number(snapshot.integrity?.unknown||0),incompatible:Number(snapshot.integrity?.incompatible||0)};
  integrity.total=integrity.orphaned+integrity.unknown+integrity.incompatible;
  integrity.ok=integrity.total===0;
  const missing=Number(snapshot.missing||0);
  const lifecycleStageCounts={
    recovery:missing,
    identity:sum(counts,['IDENTITY_PENDING']),
    validation:sum(counts,['IDENTITY_VALIDATION','IDENTITY_REVIEW_REQUIRED']),
    data:sum(counts,['DATA_INCOMPLETE','PIKOSCORE_PENDING']),
    movies:sum(counts,['MOVIE_FILE_PENDING','MOVIE_FILE_REVIEW']),
    series:sum(counts,['SERIES_SYNC_PENDING','SERIES_REVIEW']),
    pikoquality:sum(counts,['TECH_PENDING']),
    people:0
  };
  const stageCounts={...lifecycleStageCounts,...Object.fromEntries(Object.entries(snapshot.stageCounts||{}).map(([k,v])=>[k,Number(v||0)]))};
  const stages=QUALITY_STAGE_META.map(meta=>{const count=stageCounts[meta.id]||0;return{...meta,count,status:statusFor(meta.id,count,counts)}});
  const total=Number(snapshot.total||0),excluded=Number(counts.EXCLUDED||0),activeTotal=Math.max(0,total-excluded),complete=Math.min(activeTotal,Number(counts.COMPLETE||0)),progressPct=activeTotal?Math.max(0,Math.min(100,(complete/activeTotal)*100)):100,pending=Math.max(0,activeTotal-complete),areasPending=stages.filter(s=>s.count>0).length;
  const attentionStages=stages.filter(s=>s.status.key==='attention'||s.status.key==='blocked');
  const trackingStages=stages.filter(s=>s.status.key==='pending');
  const priorityItems=[];
  if(missing>0)priorityItems.push({id:'recovery',label:'Integridad Lifecycle',count:missing,href:'/calidad/sin-estado',severity:'blocked'});
  if(integrity.total>0)priorityItems.push({id:'integrity',label:'Integridad estructural',count:integrity.total,href:'/calidad/sin-estado',severity:'blocked'});
  for(const s of attentionStages.filter(s=>s.id!=='recovery'))priorityItems.push({id:s.id,label:s.label,count:s.count,href:s.href,severity:'attention'});
  const attentionCount=attentionStages.reduce((n,s)=>n+s.count,0)+integrity.total;
  const trackingCount=trackingStages.reduce((n,s)=>n+s.count,0);
  const healthyAreas=stages.filter(s=>s.status.key==='healthy').length;
  const globalStatus=attentionCount>0?{key:missing>0||integrity.total>0?'blocked':'attention',label:'Requiere atención',icon:'!'}:trackingCount>0?{key:'pending',label:'En seguimiento automático',icon:'•'}:{key:'healthy',label:'Todo al día',icon:'✓'};
  const centerStages=stages.filter(s=>QUALITY_CENTER_STAGE_IDS.includes(s.id));
  const specializedStages=stages.filter(s=>QUALITY_SPECIALIZED_STAGE_IDS.includes(s.id));
  return{total,activeTotal,excluded,complete,pending,progressPct,materialized:Number(snapshot.materialized||0),missing,integrity,stages,centerStages,specializedStages,stageCounts,areasPending,attentionCount,trackingCount,healthyAreas,priorityItems,globalStatus};
}

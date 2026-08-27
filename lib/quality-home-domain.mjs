export const QUALITY_STATE_STAGE=Object.freeze({
  IDENTITY_PENDING:'identity',
  IDENTITY_VALIDATION:'validation',
  IDENTITY_REVIEW_REQUIRED:'validation',
  DATA_INCOMPLETE:'data',
  PIKOSCORE_PENDING:'data',
  MOVIE_FILE_PENDING:'movies',
  MOVIE_FILE_REVIEW:'movies',
  SERIES_SYNC_PENDING:'series',
  SERIES_REVIEW:'series',
  TECH_PENDING:'pikoquality',
  COMPLETE:'complete',
  EXCLUDED:'excluded'
});

export const QUALITY_STAGE_META=Object.freeze([
  {id:'recovery',label:'Recuperación Lifecycle',href:'/calidad/sin-estado',description:'Títulos del catálogo sin estado Lifecycle',cta:'Revisar Lifecycle'},
  {id:'identity',label:'Identidad',href:'/calidad/identidad',description:'IMDb/TMDb pendientes de completar',cta:'Abrir pendientes'},
  {id:'validation',label:'Validación de identidad',href:'/calidad/validacion-identidad',description:'Identidades pendientes de validar o revisar',cta:'Revisar identidad'},
  {id:'data',label:'Datos / PikoScore',href:'/calidad/datos',description:'Datos, ratings o PikoScore con acción pendiente',cta:'Completar datos'},
  {id:'movies',label:'Películas',href:'/calidad/peliculas',description:'Casos abiertos en validación del archivo físico',cta:'Revisar películas',branch:'physical'},
  {id:'series',label:'Series',href:'/calidad/series',description:'Series que requieren una acción o revisión',cta:'Revisar series',branch:'physical'},
  {id:'pikoquality',label:'PikoQuality',href:'/calidad/pikoquality',description:'Archivos técnicos sin PikoQuality C6 vigente',cta:'Ver cobertura',branch:'physical'}
]);

const sum=(counts,states)=>states.reduce((n,s)=>n+Number(counts?.[s]||0),0);

function statusFor(id,count,counts){
  if(id==='recovery')return count>0?{key:'blocked',label:'Bloqueado',icon:'!'}:{key:'healthy',label:'Sin incidencias',icon:'✓'};
  if(id==='validation'&&Number(counts.IDENTITY_REVIEW_REQUIRED||0)>0)return{key:'attention',label:'Requiere atención',icon:'!'};
  if(id==='movies'&&Number(counts.MOVIE_FILE_REVIEW||0)>0)return{key:'attention',label:'Requiere atención',icon:'!'};
  if(id==='series'&&count>0)return{key:'attention',label:'Requiere atención',icon:'!'};
  if(id==='pikoquality')return count>0?{key:'pending',label:'Cálculo pendiente',icon:'•'}:{key:'healthy',label:'C6 al día',icon:'✓'};
  if(count>0)return{key:'pending',label:'Pendiente',icon:'•'};
  return{key:'healthy',label:'Sin incidencias',icon:'✓'};
}

export function buildQualityHome(snapshot={}){
  const counts=snapshot.counts||{};
  const integrity={
    orphaned:Number(snapshot.integrity?.orphaned||0),
    unknown:Number(snapshot.integrity?.unknown||0),
    incompatible:Number(snapshot.integrity?.incompatible||0)
  };
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
    pikoquality:sum(counts,['TECH_PENDING'])
  };
  const stageCounts={...lifecycleStageCounts,...Object.fromEntries(Object.entries(snapshot.stageCounts||{}).map(([k,v])=>[k,Number(v||0)]))};

  const stages=QUALITY_STAGE_META.map(meta=>{
    const count=stageCounts[meta.id]||0;
    return{...meta,count,status:statusFor(meta.id,count,counts)};
  });

  const total=Number(snapshot.total||0);
  const excluded=Number(counts.EXCLUDED||0);
  const activeTotal=Math.max(0,total-excluded);
  const complete=Math.min(activeTotal,Number(counts.COMPLETE||0));
  const progressPct=activeTotal?Math.max(0,Math.min(100,(complete/activeTotal)*100)):100;
  const pending=Math.max(0,activeTotal-complete);
  const areasPending=stages.filter(s=>s.count>0).length;

  const globalStatus=missing>0||integrity.total>0
    ?{key:'blocked',label:'Requiere intervención',icon:'!'}
    :areasPending>0
      ?{key:'attention',label:'Hay áreas por revisar',icon:'!'}
      :{key:'healthy',label:'Todo al día',icon:'✓'};

  return{
    total,activeTotal,excluded,complete,pending,progressPct,
    materialized:Number(snapshot.materialized||0),missing,integrity,
    stages,stageCounts,areasPending,globalStatus
  };
}

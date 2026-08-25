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
  {id:'validation',label:'Validación de identidad',href:'/calidad/validacion-identidad',description:'Identidad pendiente de validar o revisar',cta:'Revisar identidad'},
  {id:'data',label:'Datos / PikoScore',href:'/calidad/datos',description:'Datos principales o PikoScore pendientes',cta:'Completar datos'},
  {id:'movies',label:'Películas',href:'/calidad/peliculas',description:'Validación del archivo físico',cta:'Revisar películas',branch:'physical'},
  {id:'series',label:'Series',href:'/calidad/series',description:'Referencia, episodios y disponibilidad',cta:'Revisar series',branch:'physical'},
  {id:'pikoquality',label:'PikoQuality',href:'/calidad/pikoquality',description:'Calidad técnica pendiente',cta:'Analizar calidad'}
]);

const sum=(counts,states)=>states.reduce((n,s)=>n+Number(counts?.[s]||0),0);

function statusFor(id,count,counts,integrity){
  if(id==='recovery')return count>0?{key:'blocked',label:'Bloqueado',icon:'!'}:{key:'healthy',label:'Sin incidencias',icon:'✓'};
  if(id==='validation'&&Number(counts.IDENTITY_REVIEW_REQUIRED||0)>0)return{key:'attention',label:'Requiere atención',icon:'!'};
  if(id==='movies'&&Number(counts.MOVIE_FILE_REVIEW||0)>0)return{key:'attention',label:'Requiere atención',icon:'!'};
  if(id==='series'&&Number(counts.SERIES_REVIEW||0)>0)return{key:'attention',label:'Requiere atención',icon:'!'};
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
  const stageCounts={
    recovery:missing,
    identity:sum(counts,['IDENTITY_PENDING']),
    validation:sum(counts,['IDENTITY_VALIDATION','IDENTITY_REVIEW_REQUIRED']),
    data:sum(counts,['DATA_INCOMPLETE','PIKOSCORE_PENDING']),
    movies:sum(counts,['MOVIE_FILE_PENDING','MOVIE_FILE_REVIEW']),
    series:sum(counts,['SERIES_SYNC_PENDING','SERIES_REVIEW']),
    pikoquality:sum(counts,['TECH_PENDING'])
  };

  const stages=QUALITY_STAGE_META.map(meta=>{
    const count=stageCounts[meta.id]||0;
    return{...meta,count,status:statusFor(meta.id,count,counts,integrity)};
  });

  const total=Number(snapshot.total||0);
  const excluded=Number(counts.EXCLUDED||0);
  const activeTotal=Math.max(0,total-excluded);
  const complete=Math.min(activeTotal,Number(counts.COMPLETE||0));
  const progressPct=activeTotal?Math.max(0,Math.min(100,(complete/activeTotal)*100)):100;
  const pending=Math.max(0,activeTotal-complete);
  const intervention=missing+sum(counts,['IDENTITY_REVIEW_REQUIRED','MOVIE_FILE_REVIEW','SERIES_REVIEW'])+integrity.total;

  const priorityItems=stages
    .filter(s=>['blocked','attention'].includes(s.status.key))
    .map(s=>({id:s.id,label:s.label,count:s.count,href:s.href,status:s.status}));
  if(!integrity.ok)priorityItems.unshift({id:'integrity',label:'Integridad Lifecycle',count:integrity.total,href:'/calidad/sin-estado',status:{key:'blocked',label:'Bloqueado',icon:'!'}});

  const globalStatus=missing>0||integrity.total>0
    ?{key:'blocked',label:'Requiere intervención',icon:'!'}
    :priorityItems.length
      ?{key:'attention',label:'Requiere atención',icon:'!'}
      :pending>0
        ?{key:'pending',label:'Trabajo pendiente',icon:'•'}
        :{key:'healthy',label:'Todo al día',icon:'✓'};

  return{
    total,activeTotal,excluded,complete,pending,progressPct,
    materialized:Number(snapshot.materialized||0),missing,intervention,integrity,
    stages,priorityItems,globalStatus
  };
}

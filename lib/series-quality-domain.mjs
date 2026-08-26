const DAY=86400000;
const n=v=>Number(v||0);
const date=v=>v?new Date(v):null;

export function getReferenceFreshness(row,now=new Date()){
  if(!row?.has_reference)return{status:'missing',label:'Sin referencia',isTrusted:false,requiresRefresh:true,lastCheckedAt:null,nextCheckAt:null,reason:'Referencia TMDb todavía no creada'};
  const last=date(row.refreshed_at),next=date(row.next_check_at);
  if(row.reference_invalidated)return{status:'stale',label:'Actualización necesaria',isTrusted:false,requiresRefresh:true,lastCheckedAt:last,nextCheckAt:next,reason:row.reference_invalid_reason||'Plex cambió desde la última referencia'};
  if(!row.tmdb_status)return{status:'metadata_missing',label:'Datos TMDb pendientes',isTrusted:false,requiresRefresh:true,lastCheckedAt:last,nextCheckAt:next,reason:'La referencia es anterior al control de estado y fechas TMDb; debe refrescarse para certificar su vigencia'};
  if(next&&next<=now)return{status:'expired',label:'Referencia vencida',isTrusted:false,requiresRefresh:true,lastCheckedAt:last,nextCheckAt:next,reason:'Ha llegado la próxima comprobación programada'};
  if(!last)return{status:'unknown',label:'Referencia sin verificar',isTrusted:false,requiresRefresh:true,lastCheckedAt:null,nextCheckAt:next,reason:'No consta una actualización TMDb correcta'};
  return{status:'fresh',label:'Referencia vigente',isTrusted:true,requiresRefresh:false,lastCheckedAt:last,nextCheckAt:next,reason:null};
}

export function classifySeries(row,now=new Date()){
  const plexTrusted=Boolean(row.plex_detail_trusted);
  const freshness=getReferenceFreshness(row,now);
  const missing=n(row.actionable_missing),unknown=n(row.availability_unknown),extra=n(row.unmapped_plex_episodes??row.extra_episodes);
  const flags=[];
  if(missing)flags.push('missing');if(unknown)flags.push('unknown');if(extra)flags.push('unmapped');
  let primaryState,diagnosis,nextAction,severity;
  if(row.pre_quality_pending){primaryState='pre_quality';severity='warn';diagnosis={code:'PRE_QUALITY',label:'Pendiente de fase previa',detail:row.blocking_reason||`Lifecycle: ${row.lifecycle_state||'pendiente'}`,severity};nextAction={code:'VIEW_CATALOG',label:'Ver ficha'};}
  else if(!plexTrusted){primaryState='plex_sync';severity='warn';diagnosis={code:'PLEX_STALE',label:'Inventario Plex pendiente',detail:row.plex_changed?'Plex cambió · detalle pendiente':'Falta comprobar el inventario de episodios',severity};nextAction={code:'SYNC_PLEX_DETAIL',label:'Actualizar Plex'};}
  else if(!freshness.isTrusted){primaryState='tmdb_refresh';severity='warn';diagnosis={code:'TMDB_STALE',label:freshness.label,detail:freshness.reason,severity};nextAction={code:'REFRESH_TMDB',label:'Actualizar TMDb'};}
  else if(missing){primaryState='missing';severity='bad';diagnosis={code:'MISSING',label:`${missing} episodio${missing===1?'':'s'} pendiente${missing===1?'':'s'}`,detail:'Faltan episodios exigibles disponibles en España',severity};nextAction={code:'REVIEW_MISSING',label:'Ver faltantes'};}
  else if(extra){primaryState='unmapped';severity='warn';diagnosis={code:'UNMAPPED',label:`${extra} episodio${extra===1?'':'s'} por revisar`,detail:'Plex contiene episodios que no encajan con la referencia',severity};nextAction={code:'REVIEW_UNMAPPED',label:'Revisar episodios'};}
  else if(unknown){primaryState='unknown';severity='warn';diagnosis={code:'UNKNOWN',label:`${unknown} por confirmar`,detail:'Disponibilidad en España todavía no confirmada',severity};nextAction={code:'REVIEW_AVAILABILITY',label:'Revisar disponibilidad'};}
  else{primaryState='uptodate';severity='ok';diagnosis={code:'UP_TO_DATE',label:'Al día',detail:'Inventario Plex y referencia TMDb fiables, sin incidencias',severity};nextAction={code:'VIEW_DETAIL',label:'Ver detalle'};}
  return{primaryState,secondaryFlags:flags,diagnosis,nextAction,referenceFreshness:freshness};
}

export function nextReferenceCheck({status,lastAirDate,nextAirDate,refreshedAt}={}){
  const base=date(refreshedAt)||new Date();
  if(nextAirDate){const d=date(nextAirDate);if(d)return new Date(Math.max(base.getTime()+DAY,d.getTime()+DAY));}
  const normalized=String(status||'').toLowerCase();
  const days=['ended','canceled','cancelled'].includes(normalized)?180:normalized?14:30;
  return new Date(base.getTime()+days*DAY);
}

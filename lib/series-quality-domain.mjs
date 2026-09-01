const DAY=86400000;
export const SER004_RECHECK_DAYS=14;
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

export function deriveSeriesQualityState(row,now=new Date()){
  const freshness=getReferenceFreshness(row,now);
  const plexTrusted=Boolean(row?.plex_detail_trusted);
  const missing=n(row?.actionable_missing);
  const unknown=n(row?.availability_unknown);
  const availabilityDue=n(row?.availability_due??unknown);
  const extra=n(row?.unmapped_plex_episodes??row?.extra_episodes);
  const internal=n(row?.internal_inconsistencies);
  const criticalError=Boolean(row?.critical_sync_error);
  const attentionCount=missing+extra+internal;
  const pendingCount=availabilityDue;
  const evaluatedAt=date(row?.evaluated_at||row?.updated_at||row?.refreshed_at||row?.plex_detail_refreshed_at);
  if(!row?.has_reference||!plexTrusted||!freshness.isTrusted||criticalError||internal){
    const reason=!row?.has_reference?'Falta la referencia oficial TMDb':!plexTrusted?'El inventario detallado de Plex no es fiable todavía':!freshness.isTrusted?freshness.reason:criticalError?'La última actualización crítica falló':'Se detectó una inconsistencia interna';
    return{state:'DIAGNOSTICO_NO_FIABLE',label:'Diagnóstico no fiable',severity:'bad',reason,attention_count:attentionCount,pending_count:pendingCount,is_reliable:false,evaluated_at:evaluatedAt,referenceFreshness:freshness};
  }
  if(attentionCount>0){
    const parts=[];if(missing)parts.push(`${missing} faltante${missing===1?'':'s'}`);if(extra)parts.push(`${extra} anomalía${extra===1?'':'s'}`);if(internal)parts.push(`${internal} inconsistencia${internal===1?'':'s'}`);
    return{state:'REQUIERE_ATENCION',label:'Requiere atención',severity:'bad',reason:parts.join(' · '),attention_count:attentionCount,pending_count:pendingCount,is_reliable:true,evaluated_at:evaluatedAt,referenceFreshness:freshness};
  }
  if(pendingCount>0)return{state:'REVISION_PENDIENTE',label:'Revisión pendiente',severity:'warn',reason:`${pendingCount} episodio${pendingCount===1?'':'s'} por confirmar`,attention_count:0,pending_count:pendingCount,is_reliable:true,evaluated_at:evaluatedAt,referenceFreshness:freshness};
  return{state:'AL_DIA',label:'Al día',severity:'ok',reason:'Plex y TMDb reconciliados, sin incidencias ni incertidumbres pendientes',attention_count:0,pending_count:0,is_reliable:true,evaluated_at:evaluatedAt,referenceFreshness:freshness};
}

export function classifySeries(row,now=new Date()){
  const plexTrusted=Boolean(row.plex_detail_trusted);
  const freshness=getReferenceFreshness(row,now);
  const missing=n(row.actionable_missing),unknown=n(row.availability_unknown),availabilityDue=n(row.availability_due??unknown),extra=n(row.unmapped_plex_episodes??row.extra_episodes);
  const flags=[];
  if(missing)flags.push('missing');if(availabilityDue)flags.push('unknown');if(extra)flags.push('unmapped');
  let primaryState,diagnosis,nextAction,severity;
  if(!row.has_reference){primaryState='pre_quality';severity='warn';diagnosis={code:'PRE_QUALITY',label:'Pendiente de referencia de serie',detail:'Todavía no existe la referencia oficial TMDb de episodios para esta serie',severity};nextAction={code:'VIEW_CATALOG',label:'Ver ficha'};}
  else if(!plexTrusted){primaryState='plex_sync';severity='warn';diagnosis={code:'PLEX_STALE',label:'Inventario Plex pendiente',detail:row.plex_changed?'Plex cambió · detalle pendiente':'Falta comprobar el inventario de episodios',severity};nextAction={code:'SYNC_PLEX_DETAIL',label:'Actualizar Plex'};}
  else if(!freshness.isTrusted){primaryState='tmdb_refresh';severity='warn';diagnosis={code:'TMDB_STALE',label:freshness.label,detail:freshness.reason,severity};nextAction={code:'REFRESH_TMDB',label:'Actualizar TMDb'};}
  else if(missing){primaryState='missing';severity='bad';diagnosis={code:'MISSING',label:`${missing} episodio${missing===1?'':'s'} pendiente${missing===1?'':'s'}`,detail:'Faltan episodios exigibles disponibles en España',severity};nextAction={code:'REVIEW_MISSING',label:'Ver faltantes'};}
  else if(extra){primaryState='unmapped';severity='warn';diagnosis={code:'UNMAPPED',label:`${extra} episodio${extra===1?'':'s'} por revisar`,detail:'Plex contiene episodios que no encajan con la referencia',severity};nextAction={code:'REVIEW_UNMAPPED',label:'Revisar episodios'};}
  else if(availabilityDue){primaryState='unknown';severity='warn';diagnosis={code:'UNKNOWN',label:`${availabilityDue} por confirmar`,detail:'Disponibilidad en España pendiente de una comprobación vencida',severity};nextAction={code:'REVIEW_AVAILABILITY',label:'Revisar disponibilidad'};}
  else if(unknown){primaryState='uptodate';severity='ok';diagnosis={code:'UNKNOWN_COOLDOWN',label:'Comprobado recientemente',detail:`${unknown} episodio${unknown===1?'':'s'} siguen sin evidencia positiva, pero la revisión todavía no ha vencido`,severity};nextAction={code:'VIEW_DETAIL',label:'Ver detalle'};}
  else{primaryState='uptodate';severity='ok';diagnosis={code:'UP_TO_DATE',label:'Al día',detail:'Inventario Plex y referencia TMDb fiables, sin incidencias',severity};nextAction={code:'VIEW_DETAIL',label:'Ver detalle'};}
  const quality=deriveSeriesQualityState(row,now);
  return{primaryState,secondaryFlags:flags,diagnosis,nextAction,referenceFreshness:freshness,qualityState:quality.state,quality};
}

export function nextReferenceCheck({status,lastAirDate,nextAirDate,refreshedAt}={}){
  const base=date(refreshedAt)||new Date();
  if(nextAirDate){const d=date(nextAirDate);if(d)return new Date(Math.max(base.getTime()+DAY,d.getTime()+DAY));}
  const normalized=String(status||'').toLowerCase();
  const days=['ended','canceled','cancelled'].includes(normalized)?180:normalized?14:30;
  return new Date(base.getTime()+days*DAY);
}

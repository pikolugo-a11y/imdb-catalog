const MADRID_TIME_ZONE='Europe/Madrid';

function asDate(value){
  if(value instanceof Date)return Number.isNaN(value.getTime())?null:value;
  if(value===null||value===undefined||value==='')return null;
  const date=new Date(value);
  return Number.isNaN(date.getTime())?null:date;
}

function format(value,defaults,options){
  const date=asDate(value),fallback=options?.fallback??'—';
  if(!date)return fallback;
  const{fallback:_fallback,...intlOptions}=options||{};
  try{
    return new Intl.DateTimeFormat('es-ES',{timeZone:MADRID_TIME_ZONE,...defaults,...intlOptions}).format(date);
  }catch{
    return fallback;
  }
}

export function formatMadridDateTime(value,options={}){
  return format(value,{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'},options);
}

export function formatMadridDate(value,options={}){
  return format(value,{day:'2-digit',month:'2-digit',year:'numeric'},options);
}

export function formatMadridShortDay(value,options={}){
  return format(value,{day:'2-digit',month:'short'},options);
}

export const PIKOFILM_TIME_ZONE=MADRID_TIME_ZONE;

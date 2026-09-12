const MADRID_TIME_ZONE='Europe/Madrid';

function asDate(value){
  if(value instanceof Date)return Number.isNaN(value.getTime())?null:value;
  if(value===null||value===undefined||value==='')return null;
  const date=new Date(value);
  return Number.isNaN(date.getTime())?null:date;
}

export function formatMadridDateTime(value,options={}){
  const date=asDate(value);
  if(!date)return options.fallback??'—';
  const{fallback:_,...intlOptions}=options;
  try{
    return new Intl.DateTimeFormat('es-ES',{timeZone:MADRID_TIME_ZONE,dateStyle:'short',timeStyle:'short',...intlOptions}).format(date);
  }catch{
    return fallback??'—';
  }
}

export function formatMadridDate(value,options={}){
  const date=asDate(value);
  if(!date)return options.fallback??'—';
  const{fallback:_,...intlOptions}=options;
  try{
    return new Intl.DateTimeFormat('es-ES',{timeZone:MADRID_TIME_ZONE,day:'2-digit',month:'2-digit',year:'numeric',...intlOptions}).format(date);
  }catch{
    return fallback??'—';
  }
}

export function formatMadridShortDay(value,options={}){
  return formatMadridDate(value,{day:'2-digit',month:'short',year:undefined,...options});
}

export const PIKOFILM_TIME_ZONE=MADRID_TIME_ZONE;

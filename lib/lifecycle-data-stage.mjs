const present=v=>v!==null&&v!==undefined&&v!=='';
const positive=v=>v!=null&&Number(v)>0;
const isSeries=r=>['Serie','Miniserie'].includes(String(r?.type||''));

export function dataComplete(r){
  return [
    present(r.title_es),
    present(r.original_title),
    Number(r.year)>1800,
    present(r.type),
    isSeries(r)?true:positive(r.runtime),
    present(r.country),
    Boolean(r.has_genres),
    present(r.overview),
    Boolean(r.poster_path||r.external_poster_url)
  ].every(Boolean);
}

export function lifecycleAfterDataRefresh(r){
  if(!dataComplete(r))return{state:'DATA_INCOMPLETE',reason:'Ficha de datos incompleta'};
  return{state:'PIKOSCORE_PENDING',reason:'Datos estructurales completos; ratings/PikoScore pendientes'};
}

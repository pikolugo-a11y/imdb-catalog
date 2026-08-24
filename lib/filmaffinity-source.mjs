const HEADERS={
  'User-Agent':'Mozilla/5.0 (compatible; PikoFilm/3.0; personal non-commercial)',
  'Accept-Language':'es-ES,es;q=0.9'
};

function htmlText(html){
  return String(html||'')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&#39;/gi,"'")
    .replace(/&quot;/gi,'"')
    .replace(/\s+/g,' ')
    .trim();
}

export function parseFilmAffinityRating(html){
  for(const m of String(html||'').matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
    try{
      const d=JSON.parse(m[1].trim());
      for(const n of (Array.isArray(d)?d:[d])){
        const a=n?.aggregateRating;
        const rating=a?.ratingValue!=null?Number(String(a.ratingValue).replace(',','.')):null;
        const votes=a?.ratingCount!=null?Number(String(a.ratingCount).replace(/[^0-9]/g,'')):null;
        if(Number.isFinite(rating)&&rating>0&&rating<=10&&Number.isInteger(votes)&&votes>0){
          return{rating,votes,title:n?.name||null,parser:'json-ld'};
        }
      }
    }catch{}
  }
  const text=htmlText(html);
  for(const p of [/\b([0-9],[0-9])\s+([0-9][0-9\.]{0,12})\s+votos\b/i,/\b([0-9],[0-9])\s+([0-9][0-9\.]{1,12})\b/i]){
    const m=text.match(p);
    if(m){
      const rating=Number(m[1].replace(',','.'));
      const votes=Number(m[2].replace(/[^0-9]/g,''));
      if(Number.isFinite(rating)&&rating>0&&rating<=10&&Number.isInteger(votes)&&votes>0){
        return{rating,votes,title:null,parser:'visible-text'};
      }
    }
  }
  return null;
}

async function fetchText(url){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),15000);
  try{
    const r=await fetch(url,{headers:HEADERS,signal:controller.signal});
    if(!r.ok){
      const e=new Error(`FilmAffinity HTTP ${r.status}`);
      e.status=r.status;
      throw e;
    }
    return await r.text();
  }finally{clearTimeout(timer)}
}

export async function fetchFilmAffinityRating(faId){
  const id=String(faId||'').trim();
  if(!/^\d+$/.test(id))throw Object.assign(new Error('FilmAffinity ID no válido'),{permanent:true});
  const primary=`https://www.filmaffinity.com/es/film${id}.html`;
  const attempts=[[primary,'film'],[`https://www.filmaffinity.com/es/reviews/1/${id}.html`,'reviews']];
  let lastError=null;
  for(const [url,method] of attempts){
    try{
      const parsed=parseFilmAffinityRating(await fetchText(url));
      if(parsed)return{...parsed,method,url:primary,id};
    }catch(e){lastError=e;if([403,429].includes(Number(e?.status||0)))throw e;}
  }
  if(lastError)throw lastError;
  throw Object.assign(new Error('FilmAffinity no devolvió nota/votos válidos'),{permanent:true});
}

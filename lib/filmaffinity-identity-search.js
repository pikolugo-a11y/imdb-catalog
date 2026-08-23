import 'server-only';

const HEADERS={
  'User-Agent':'Mozilla/5.0 (compatible; PikoFilm/1.0; personal non-commercial)',
  'Accept-Language':'es-ES,es;q=0.9',
  'Accept':'text/html,application/xhtml+xml'
};

const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&[a-z]+;/g,' ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
const strip=s=>String(s||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&#39;/gi,"'").replace(/&quot;/gi,'"').replace(/\s+/g,' ').trim();

async function fetchSearch(query){
  const c=new AbortController(),t=setTimeout(()=>c.abort(),8000);
  try{
    const url=`https://www.filmaffinity.com/es/search.php?stext=${encodeURIComponent(query)}&stype=title`;
    const r=await fetch(url,{headers:HEADERS,signal:c.signal,cache:'no-store',redirect:'follow'});
    if(!r.ok)throw new Error(`FilmAffinity búsqueda HTTP ${r.status}`);
    return await r.text();
  }finally{clearTimeout(t)}
}

function candidates(html){
  const src=String(html||''),out=[];
  const re=/(?:https?:\/\/(?:www\.)?filmaffinity\.com)?\/es\/film(\d{4,9})\.html/gi;
  for(const m of src.matchAll(re)){
    const id=String(m[1]);
    if(out.some(x=>x.id===id))continue;
    const pos=m.index||0,start=Math.max(0,pos-900),end=Math.min(src.length,pos+1700);
    out.push({id,context:strip(src.slice(start,end))});
  }
  return out;
}

function scoreCandidate(c,row){
  const ctx=norm(c.context),titles=[row.title_es,row.original_title,row.title].map(norm).filter(x=>x.length>2);
  let score=0;
  for(const t of titles){if(ctx.includes(t)){score=Math.max(score,70);break}}
  const year=Number(row.year||0);
  if(year&&ctx.includes(String(year)))score+=25;
  const type=String(row.type||'');
  if((type==='Serie'||type==='Miniserie')&&/\bserie\b/.test(ctx))score+=5;
  return score;
}

export async function searchFilmAffinityIdentity(row){
  const queries=[row.title_es,row.original_title,row.title].map(x=>String(x||'').trim()).filter((x,i,a)=>x&&a.indexOf(x)===i).slice(0,2);
  let best=null,requests=0;
  for(const q of queries){
    const html=await fetchSearch(q);requests++;
    const ranked=candidates(html).map(c=>({...c,score:scoreCandidate(c,row)})).sort((a,b)=>b.score-a.score);
    if(ranked[0]&&(!best||ranked[0].score>best.score))best={...ranked[0],query:q};
    if(best?.score>=95)break;
  }
  if(!best||best.score<70)return{faId:null,method:'fa_direct_not_found',confidence:best?.score||0,requests};
  return{faId:best.id,method:'fa_direct_search',confidence:best.score,requests,query:best.query};
}

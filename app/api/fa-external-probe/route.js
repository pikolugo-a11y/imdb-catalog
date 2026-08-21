export const dynamic='force-dynamic';
export const maxDuration=60;

const IDS=['363136','915417','891614','469437','446167'];

export async function GET(){
  const key=process.env.ZYLA_FILMAFFINITY_API_KEY;
  if(!key)return Response.json({ok:false,reason:'missing_api_key',message:'Set ZYLA_FILMAFFINITY_API_KEY to run the external FilmAffinity API probe.'},{status:503});
  const results=[];
  for(const id of IDS){
    const started=Date.now();
    try{
      const url=`https://zylalabs.com/api/12716/filmaffinity+api+data/24815/item-by-id?item_id=${encodeURIComponent(id)}&lang=es&cache_bd=true`;
      const r=await fetch(url,{headers:{Authorization:`Bearer ${key}`},cache:'no-store'});
      const text=await r.text();
      let data;try{data=JSON.parse(text)}catch{data=text.slice(0,1000)}
      results.push({fa_id:id,ok:r.ok,status:r.status,elapsed_ms:Date.now()-started,data});
    }catch(e){results.push({fa_id:id,ok:false,error:e?.message||String(e),elapsed_ms:Date.now()-started});}
  }
  return Response.json({ok_count:results.filter(x=>x.ok).length,results});
}

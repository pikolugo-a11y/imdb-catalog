import {searchFaBrave} from '@/lib/identity-resolver';

export const dynamic='force-dynamic';
export const maxDuration=20;

export async function GET(){
  const row={
    imdb_id:'tt0088484',
    type:'Serie',
    title:'Blackadder II',
    title_es:'Blackadder II',
    original_title:'Blackadder II',
    year:1986,
    tmdb_id:null,
  };
  const started=Date.now();
  const result=await searchFaBrave(row,{singleQuery:true});
  return Response.json({
    ok:true,
    probe:'brave_single_query',
    imdb_id:row.imdb_id,
    title:row.title,
    result:{
      fa_id:result.faId||null,
      method:result.method||null,
      blocked:Boolean(result.blocked),
      blocked_reason:result.blockedReason||null,
      status:result.status??null,
      error:result.error||null,
      requests:Number(result.requests||0),
      query:result.query||null,
      elapsed_ms:Number(result.elapsedMs||0),
      candidates:Number(result.candidates||0),
    },
    total_elapsed_ms:Date.now()-started,
  },{headers:{'Cache-Control':'no-store'}});
}

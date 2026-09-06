const api='https://api.themoviedb.org/3';

async function tmdb(path,{trace,apiGate}={}){
  const token=process.env.TMDB_API_TOKEN;
  if(!token)throw new Error('TMDB_API_TOKEN no está configurado');
  const permit=apiGate?await apiGate.acquire('tmdb',{lane:'batch',owner:'saga-refresh'}):null;
  try{
    await trace?.externalCall?.(1);
    const r=await fetch(`${api}${path}`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},cache:'no-store'});
    if(!r.ok){
      const error=new Error(`TMDb ${r.status}: ${path}`);
      error.source='tmdb';
      error.status=r.status;
      error.retryable=r.status===429||r.status>=500;
      throw error;
    }
    await apiGate?.success?.('tmdb');
    return r.json();
  }catch(error){
    await apiGate?.failure?.('tmdb',error,{lane:'batch'}).catch(()=>{});
    throw error;
  }finally{
    await apiGate?.release?.(permit).catch(()=>{});
  }
}

function uniqueMovieParts(parts){
  const seen=new Set();
  return [...(parts||[])].filter(part=>{
    const id=String(part?.id||'');
    if(!id||seen.has(id))return false;
    seen.add(id);
    return true;
  }).sort((a,b)=>String(a.release_date||'9999').localeCompare(String(b.release_date||'9999')));
}

async function imdbForTmdb(sql,tmdbId,{trace,apiGate}={}){
  const [known]=await sql`SELECT imdb_id FROM saga_collection_members WHERE tmdb_movie_id=${String(tmdbId)} AND imdb_id LIKE 'tt%' LIMIT 1`;
  let ext;
  try{ext=await tmdb(`/movie/${tmdbId}/external_ids`,{trace,apiGate});}
  catch(error){if(Number(error?.status)===404)return{imdbId:null,corrected:false};throw error;}
  const imdb=String(ext?.imdb_id||'');
  const canonical=/^tt\d+$/.test(imdb)?imdb:null;
  const corrected=Boolean(canonical&&known?.imdb_id&&known.imdb_id!==canonical);
  if(corrected)await trace?.event?.({eventType:'step_completed',step:'repair_member_identity',message:'Identidad IMDb de miembro de saga corregida desde TMDb',data:{tmdb_movie_id:String(tmdbId),previous_imdb_id:known.imdb_id,canonical_imdb_id:canonical}}).catch(()=>{});
  return{imdbId:canonical,corrected};
}

export async function refreshSagaCollectionCanonical(sql,collectionId,{trace,apiGate}={}){
  const id=String(collectionId||'').trim();
  if(!/^\d+$/.test(id))throw Object.assign(new Error('TMDb collection ID inválido'),{permanent:true});
  let d;
  try{d=await tmdb(`/collection/${id}?language=es-ES`,{trace,apiGate});}
  catch(error){
    if(Number(error?.status)!==404)throw error;
    await sql.transaction([
      sql`DELETE FROM saga_collection_members WHERE tmdb_collection_id=${id}`,
      sql`DELETE FROM saga_collections WHERE tmdb_collection_id=${id}`
    ]);
    return{technicalStatus:'succeeded',functionalResult:'updated',after:{tmdb_collection_id:id,not_found:true,members:0},metrics:{members:0,outside_catalog:0,identity_corrections:0,not_found:1},message:'Colección inexistente en TMDb eliminada de la caché local'};
  }
  const rawParts=[...(d.parts||[])],parts=uniqueMovieParts(rawParts),resolved=[];
  let outsideCatalog=0,identityCorrections=0,pos=0;
  for(const p of parts){
    pos++;
    const identity=await imdbForTmdb(sql,p.id,{trace,apiGate});
    if(identity.corrected)identityCorrections++;
    const [m]=identity.imdbId?await sql`SELECT m.imdb_id FROM movies m LEFT JOIN catalog_exclusions ex USING(imdb_id) WHERE ex.imdb_id IS NULL AND m.imdb_id=${identity.imdbId} LIMIT 1`:[];
    if(!m)outsideCatalog++;
    resolved.push({tmdbMovieId:String(p.id),imdbId:identity.imdbId,title:p.title||p.name||null,originalTitle:p.original_title||p.original_name||null,year:Number(String(p.release_date||'').slice(0,4))||null,posterPath:p.poster_path||null,position:pos});
  }
  const ops=[
    sql`INSERT INTO saga_collections(tmdb_collection_id,name,poster_path,backdrop_path,member_count,refreshed_at) VALUES(${id},${d.name||'Colección'},${d.poster_path||null},${d.backdrop_path||null},${parts.length},now()) ON CONFLICT(tmdb_collection_id) DO UPDATE SET name=EXCLUDED.name,poster_path=EXCLUDED.poster_path,backdrop_path=EXCLUDED.backdrop_path,member_count=EXCLUDED.member_count,refreshed_at=now()`,
    sql`DELETE FROM saga_collection_members WHERE tmdb_collection_id=${id}`
  ];
  for(const member of resolved)ops.push(sql`INSERT INTO saga_collection_members(tmdb_collection_id,tmdb_movie_id,imdb_id,title,original_title,year,poster_path,position,updated_at) VALUES(${id},${member.tmdbMovieId},${member.imdbId},${member.title},${member.originalTitle},${member.year},${member.posterPath},${member.position},now())`);
  await sql.transaction(ops);
  return{technicalStatus:'succeeded',functionalResult:'updated',after:{tmdb_collection_id:id,members:resolved.length,outside_catalog:outsideCatalog,identity_corrections:identityCorrections},metrics:{members:resolved.length,outside_catalog:outsideCatalog,identity_corrections:identityCorrections,duplicate_members_ignored:rawParts.length-parts.length},message:identityCorrections?`Saga actualizada y ${identityCorrections} identidades corregidas`:'Saga actualizada desde TMDb'};
}

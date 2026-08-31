import 'server-only';
import {db} from './db';
import {executeObservedProcess,recordProcessError} from './process-runtime';

const api='https://api.themoviedb.org/3';

async function tmdb(path,trace){
  const token=process.env.TMDB_API_TOKEN;
  if(!token)throw new Error('TMDB_API_TOKEN no está configurado');
  await trace?.externalCall?.(1);
  const r=await fetch(`${api}${path}`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},cache:'no-store'});
  if(!r.ok){
    const error=new Error(`TMDb ${r.status}: ${path}`);
    error.source='tmdb';
    error.status=r.status;
    error.retryable=r.status===429||r.status>=500;
    throw error;
  }
  return r.json();
}

async function pool(items,n,fn){
  let i=0;
  const out=[];
  await Promise.all(Array.from({length:Math.min(n,items.length)},async()=>{
    while(i<items.length){
      const x=items[i++];
      try{out.push(await fn(x))}catch(error){out.push({error,item:x})}
    }
  }));
  return out;
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

async function imdbForTmdb(sql,tmdbId,trace,issues){
  const [known]=await sql`SELECT imdb_id FROM saga_collection_members WHERE tmdb_movie_id=${String(tmdbId)} AND imdb_id LIKE 'tt%' LIMIT 1`;
  if(known?.imdb_id)return known.imdb_id;
  try{
    const ext=await tmdb(`/movie/${tmdbId}/external_ids`,trace);
    const imdb=String(ext?.imdb_id||'');
    return /^tt\d+$/.test(imdb)?imdb:null;
  }catch(error){
    issues.externalIdErrors++;
    await recordProcessError(trace.runId,{error,step:'resolve_imdb',entityType:'tmdb_movie',entityId:String(tmdbId),source:'tmdb',retryable:Boolean(error?.retryable),detail:{tmdb_movie_id:String(tmdbId)}}).catch(()=>{});
    return null;
  }
}

export async function refreshSagas({limit=120,requestKey}={}){
  const safeLimit=Math.min(120,Math.max(1,Number(limit)||120));
  const key=requestKey||`saga-refresh:${Math.floor(Date.now()/3000)}`;
  const observed=await executeObservedProcess({
    processCode:'PROC-SAGA-001',
    runKind:'system',
    triggerSource:'sagas_manual',
    executor:'vercel',
    entityType:'saga_universe',
    entityId:'tmdb',
    correlationKey:key,
    idempotencyKey:`PROC-SAGA-001:${key}`,
    context:{surface:'/sagas',operation:'refresh_sagas_tmdb',limit:safeLimit,concurrency:6}
  },async trace=>{
    const sql=db();
    const issues={externalIdErrors:0,duplicateMembers:0};
    await trace.event({eventType:'step_started',step:'select_collections',message:'Seleccionando colecciones TMDb a refrescar'});
    const ids=await sql`
      SELECT x.tmdb_collection_id
      FROM (
        SELECT DISTINCT mc.tmdb_collection_id
        FROM movie_collections mc
        LEFT JOIN catalog_exclusions ex ON ex.imdb_id=mc.imdb_id
        WHERE ex.imdb_id IS NULL AND mc.tmdb_collection_id IS NOT NULL
        UNION
        SELECT sc.tmdb_collection_id FROM saga_collections sc
      ) x
      LEFT JOIN saga_collections sc ON sc.tmdb_collection_id=x.tmdb_collection_id
      LEFT JOIN (
        SELECT tmdb_collection_id,count(*)::int actual_member_count
        FROM saga_collection_members
        GROUP BY tmdb_collection_id
      ) sm ON sm.tmdb_collection_id=x.tmdb_collection_id
      ORDER BY
        CASE WHEN sc.tmdb_collection_id IS NOT NULL AND COALESCE(sm.actual_member_count,0)<>COALESCE(sc.member_count,0) THEN 0 ELSE 1 END,
        sc.refreshed_at ASC NULLS FIRST,
        x.tmdb_collection_id
      LIMIT ${safeLimit}`;
    await trace.event({eventType:'step_completed',step:'select_collections',message:'Colecciones seleccionadas',data:{selected:ids.length,limit:safeLimit}});

    let added=0,updated=0,members=0,outsideCatalog=0;
    await trace.event({eventType:'step_started',step:'refresh_collections',message:'Refrescando colecciones y miembros desde TMDb',data:{selected:ids.length,concurrency:6}});
    const results=await pool(ids,6,async row=>{
      const collectionId=String(row.tmdb_collection_id);
      let d;
      try{
        d=await tmdb(`/collection/${collectionId}?language=es-ES`,trace);
      }catch(error){
        if(error?.status===404){
          await sql.transaction([
            sql`DELETE FROM saga_collection_members WHERE tmdb_collection_id=${row.tmdb_collection_id}`,
            sql`DELETE FROM saga_collections WHERE tmdb_collection_id=${row.tmdb_collection_id}`
          ]);
          await trace.event({eventType:'step_completed',step:'refresh_collection',message:'Colección no encontrada en TMDb; caché local eliminada',data:{tmdb_collection_id:collectionId,result:'not_found'}});
          return{ok:true,collectionId,notFound:true};
        }
        throw error;
      }
      const rawParts=[...(d.parts||[])];
      const parts=uniqueMovieParts(rawParts);
      issues.duplicateMembers+=rawParts.length-parts.length;
      const exists=await sql`SELECT 1 FROM saga_collections WHERE tmdb_collection_id=${row.tmdb_collection_id}`;
      const resolved=[];
      let localOutside=0;
      let pos=0;
      for(const p of parts){
        pos++;
        const [m]=await sql`SELECT m.imdb_id FROM movies m LEFT JOIN catalog_exclusions ex USING(imdb_id) WHERE ex.imdb_id IS NULL AND m.tmdb_id=${String(p.id)} LIMIT 1`;
        const imdbId=m?.imdb_id||await imdbForTmdb(sql,p.id,trace,issues);
        if(!m)localOutside++;
        resolved.push({tmdbMovieId:String(p.id),imdbId,title:p.title||p.name||null,originalTitle:p.original_title||p.original_name||null,year:Number(String(p.release_date||'').slice(0,4))||null,posterPath:p.poster_path||null,position:pos});
      }

      const ops=[
        sql`INSERT INTO saga_collections(tmdb_collection_id,name,poster_path,backdrop_path,member_count,refreshed_at) VALUES(${row.tmdb_collection_id},${d.name||'Colección'},${d.poster_path||null},${d.backdrop_path||null},${parts.length},now()) ON CONFLICT(tmdb_collection_id) DO UPDATE SET name=EXCLUDED.name,poster_path=EXCLUDED.poster_path,backdrop_path=EXCLUDED.backdrop_path,member_count=EXCLUDED.member_count,refreshed_at=now()`,
        sql`DELETE FROM saga_collection_members WHERE tmdb_collection_id=${row.tmdb_collection_id}`
      ];
      for(const member of resolved){
        ops.push(sql`INSERT INTO saga_collection_members(tmdb_collection_id,tmdb_movie_id,imdb_id,title,original_title,year,poster_path,position,updated_at) VALUES(${row.tmdb_collection_id},${member.tmdbMovieId},${member.imdbId},${member.title},${member.originalTitle},${member.year},${member.posterPath},${member.position},now())`);
      }
      await sql.transaction(ops);
      if(exists.length)updated++;else added++;
      members+=resolved.length;
      outsideCatalog+=localOutside;
      return{ok:true,collectionId};
    });

    const failed=results.filter(x=>x?.error);
    const notFoundCollections=results.filter(x=>x?.notFound).length;
    for(const failure of failed){
      const collectionId=String(failure.item?.tmdb_collection_id||'unknown');
      await recordProcessError(trace.runId,{error:failure.error,step:'refresh_collection',entityType:'saga_collection',entityId:collectionId,source:failure.error?.source||'database',retryable:Boolean(failure.error?.retryable),detail:{tmdb_collection_id:collectionId}}).catch(()=>{});
    }
    const collectionErrors=failed.length;
    const refreshedCollections=ids.length-collectionErrors-notFoundCollections;
    await trace.event({eventType:'step_completed',step:'refresh_collections',message:'Refresco de colecciones finalizado',data:{selected:ids.length,refreshed:refreshedCollections,not_found:notFoundCollections,collection_errors:collectionErrors,external_id_errors:issues.externalIdErrors,duplicate_members_ignored:issues.duplicateMembers,members,outside_catalog:outsideCatalog}});

    const [stats]=await sql`SELECT count(*) FILTER(WHERE owned>0 AND missing>0)::int incomplete,count(*) FILTER(WHERE missing=1 AND owned>0)::int one_missing,count(*) FILTER(WHERE missing=0 AND actionable>0)::int complete FROM (SELECT sc.tmdb_collection_id,count(sm.*) FILTER(WHERE EXISTS(SELECT 1 FROM movies m WHERE m.imdb_id=sm.imdb_id))::int actionable,count(sm.*) FILTER(WHERE c.effective_status='in_plex')::int owned,count(sm.*) FILTER(WHERE EXISTS(SELECT 1 FROM movies m WHERE m.imdb_id=sm.imdb_id) AND c.effective_status IS DISTINCT FROM 'in_plex')::int missing FROM saga_collections sc JOIN saga_collection_members sm USING(tmdb_collection_id) LEFT JOIN catalog_read_model c ON c.imdb_id=sm.imdb_id GROUP BY sc.tmdb_collection_id)x`;
    const totalErrors=collectionErrors+issues.externalIdErrors;
    const technicalStatus=totalErrors?'partial':'succeeded';
    const functionalResult=ids.length===0?'no_change':refreshedCollections>0||notFoundCollections>0?'updated':'pending';
    return{
      technicalStatus,
      functionalResult,
      metrics:{collections_selected:ids.length,collections_refreshed:refreshedCollections,collections_not_found:notFoundCollections,collections_added:added,collections_updated:updated,members,outside_catalog:outsideCatalog,collection_errors:collectionErrors,external_id_errors:issues.externalIdErrors,duplicate_members_ignored:issues.duplicateMembers,...stats},
      after:{collections:refreshedCollections,collections_not_found:notFoundCollections,members,outside_catalog:outsideCatalog,errors:totalErrors,duplicate_members_ignored:issues.duplicateMembers,...stats},
      message:totalErrors?'Sagas refrescadas con incidencias':notFoundCollections?'Sagas refrescadas; colecciones inexistentes en TMDb depuradas':'Sagas refrescadas correctamente'
    };
  });

  if(observed.reused)return{reused:true,collections:0,members:0,outsideCatalog:0,errors:0};
  const m=observed.result?.metrics||{};
  return{reused:false,collections:m.collections_refreshed||0,members:m.members||0,outsideCatalog:m.outside_catalog||0,errors:(m.collection_errors||0)+(m.external_id_errors||0),technicalStatus:observed.result?.technicalStatus||'succeeded',...observed.result?.after};
}

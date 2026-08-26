const STOP=new Set(['el','la','los','las','de','del','un','una','unos','unas','en','que','the','one','with','where','a','an','of','and']);
function clean(s=''){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,'').replace(/\([^)]*\b(?:i|ii|1|2)\b[^)]*\)\s*$/i,'').replace(/\b(?:parte|part)\s*(?:1|2|i|ii)\b\s*$/i,'').replace(/[^a-z0-9]+/g,' ').trim()}
function tokens(s){return clean(s).split(/\s+/).filter(x=>x&&!STOP.has(x))}
function similarity(a,b){const A=new Set(tokens(a)),B=new Set(tokens(b));if(!A.size||!B.size)return clean(a)===clean(b)?1:0;let hit=0;for(const x of A)if(B.has(x))hit++;return hit/Math.max(A.size,B.size)}
function baseEqual(a,b){const A=clean(a),B=clean(b);return Boolean(A&&B&&A===B)}
function goodTitle(a,b){return baseEqual(a,b)||similarity(a,b)>=0.6}
function runtimeClose(actual,expected,tolerance=.22){actual=Number(actual||0);expected=Number(expected||0);return actual>0&&expected>0&&Math.abs(actual-expected)/expected<=tolerance}

export async function syncSeriesSeasonCoverage(sql,showRatingKey){
  const key=String(showRatingKey);
  await sql`UPDATE series_season_availability sa SET status='UNKNOWN',source='plex_coverage_changed',confidence='unknown',checked_at=now(),note='La temporada dejó de estar completa en Plex; disponibilidad ES pendiente de volver a comprobar' WHERE sa.show_rating_key=${key} AND sa.country_code='ES' AND sa.status='PLEX_COMPLETE' AND sa.manual_override=false AND EXISTS(SELECT 1 FROM series_diagnostics d WHERE d.show_rating_key=${key} AND d.season_number=sa.season_number AND d.status='missing')`;
  await sql`WITH coverage AS (SELECT season_number,count(*)::int total,count(*) FILTER(WHERE status IN('present','covered_combined'))::int covered FROM series_diagnostics WHERE show_rating_key=${key} AND season_number>0 GROUP BY season_number), complete AS (SELECT season_number FROM coverage WHERE total>0 AND covered=total) INSERT INTO series_season_availability(show_rating_key,season_number,country_code,status,available_from,source,confidence,manual_override,checked_at,note) SELECT ${key},c.season_number,'ES','PLEX_COMPLETE',NULL,'plex_complete','confirmed',false,now(),'Temporada completa en Plex; no requiere comprobar disponibilidad ES mientras siga completa' FROM complete c ON CONFLICT(show_rating_key,season_number,country_code) DO UPDATE SET status='PLEX_COMPLETE',available_from=NULL,source='plex_complete',confidence='confirmed',checked_at=now(),note='Temporada completa en Plex; no requiere comprobar disponibilidad ES mientras siga completa' WHERE series_season_availability.manual_override=false AND series_season_availability.status IN('UNKNOWN','PLEX_COMPLETE')`;
}

export async function rebuildSeriesDiagnostics(sql,showRatingKey){
  const [refs,plex]=await Promise.all([
    sql`SELECT season_number,episode_number,name,runtime_minutes FROM series_reference_episodes WHERE show_rating_key=${showRatingKey} ORDER BY season_number,episode_number`,
    sql`SELECT p.rating_key,p.parent_index season_number,p.item_index episode_number,p.plex_title,p.fingerprint,COALESCE((SELECT max(m.duration_ms) FROM plex_media m WHERE m.rating_key=p.rating_key),(SELECT sum(f.duration_ms) FROM plex_files f WHERE f.rating_key=p.rating_key))/60000.0 actual_duration_minutes FROM plex_items p WHERE p.grandparent_rating_key=${showRatingKey} AND p.active AND p.item_type='episode' ORDER BY p.parent_index,p.item_index,p.rating_key`
  ]);
  const bySeason=new Map();for(const p of plex){const k=Number(p.season_number);if(!bySeason.has(k))bySeason.set(k,[]);bySeason.get(k).push(p)}
  const rows=[];const used=new Set();const coveredOfficial=new Map();
  for(let ri=0;ri<refs.length;ri++){
    const r=refs[ri],officialKey=`${r.season_number}-${r.episode_number}`;
    if(coveredOfficial.has(officialKey)){
      const c=coveredOfficial.get(officialKey);rows.push({show_rating_key:String(showRatingKey),season_number:Number(r.season_number),episode_number:Number(r.episode_number),status:'covered_combined',confidence:'confirmed',reason:'Dos episodios oficiales consecutivos contenidos en un único archivo de Plex',covered_by_rating_key:String(c.rating_key),expected_name:r.name||null,expected_runtime_minutes:r.runtime_minutes||null,actual_duration_minutes:c.actual||null,search_hint:null,fingerprint:c.fingerprint||null});continue;
    }
    const season=bySeason.get(Number(r.season_number))||[],available=season.filter(p=>!used.has(String(p.rating_key)));
    let matched=[];
    const exact=available.find(p=>Number(p.episode_number)===Number(r.episode_number)&&goodTitle(p.plex_title,r.name));
    if(exact)matched=[exact];
    if(!matched.length){
      const titleMatches=available.filter(p=>Math.abs(Number(p.episode_number)-Number(r.episode_number))<=3&&goodTitle(p.plex_title,r.name)).sort((a,b)=>similarity(b.plex_title,r.name)-similarity(a.plex_title,r.name));
      if(titleMatches.length)matched=[titleMatches[0]];
    }
    if(!matched.length){const numbered=available.find(p=>Number(p.episode_number)===Number(r.episode_number));if(numbered)matched=[numbered]}
    if(!matched.length&&Number(r.runtime_minutes||0)>=38){
      for(let i=0;i<available.length-1;i++){
        const a=available[i],b=available[i+1];if(Number(b.episode_number)!==Number(a.episode_number)+1)continue;
        const total=Number(a.actual_duration_minutes||0)+Number(b.actual_duration_minutes||0);
        if(Math.abs(Number(a.episode_number)-Number(r.episode_number))<=3&&goodTitle(a.plex_title,r.name)&&goodTitle(b.plex_title,r.name)&&runtimeClose(total,Number(r.runtime_minutes||0),.22)){matched=[a,b];break}
      }
    }
    if(matched.length===1){
      const p=matched[0],next=refs[ri+1],actual=Number(p.actual_duration_minutes||0)||null;
      if(next&&Number(next.season_number)===Number(r.season_number)&&Number(next.episode_number)===Number(r.episode_number)+1){
        const combinedRuntime=Number(r.runtime_minutes||0)+Number(next.runtime_minutes||0);
        const titleEvidence=baseEqual(r.name,next.name)||goodTitle(p.plex_title,r.name)||goodTitle(p.plex_title,next.name);
        if(combinedRuntime>=60&&runtimeClose(actual,combinedRuntime,.22)&&titleEvidence)coveredOfficial.set(`${next.season_number}-${next.episode_number}`,{rating_key:p.rating_key,actual,fingerprint:p.fingerprint});
      }
    }
    for(const p of matched)used.add(String(p.rating_key));
    const actual=matched.length===1?(Number(matched[0].actual_duration_minutes||0)||null):matched.length>1?matched.reduce((n,p)=>n+Number(p.actual_duration_minutes||0),0)||null:null;
    const coversNext=matched.length===1&&[...coveredOfficial.values()].some(x=>String(x.rating_key)===String(matched[0].rating_key));
    rows.push({show_rating_key:String(showRatingKey),season_number:Number(r.season_number),episode_number:Number(r.episode_number),status:matched.length>1||coversNext?'covered_combined':matched.length===1?'present':'missing',confidence:matched.length?'confirmed':'medium',reason:matched.length>1?'Un episodio oficial repartido en varios archivos de Plex':coversNext?'Dos episodios oficiales consecutivos contenidos en un único archivo de Plex':matched.length===1?'Episodio presente en Plex':'No se encontró correspondencia en Plex',covered_by_rating_key:matched.length?matched.map(x=>x.rating_key).join(','):null,expected_name:r.name||null,expected_runtime_minutes:r.runtime_minutes||null,actual_duration_minutes:actual,search_hint:null,fingerprint:matched.length===1?matched[0].fingerprint||null:null});
  }
  await sql`DELETE FROM series_diagnostics WHERE show_rating_key=${showRatingKey}`;
  for(let i=0;i<rows.length;i+=200){const payload=JSON.stringify(rows.slice(i,i+200));await sql`INSERT INTO series_diagnostics(show_rating_key,season_number,episode_number,status,confidence,reason,covered_by_rating_key,expected_name,expected_runtime_minutes,actual_duration_minutes,search_hint,fingerprint,diagnosed_at) SELECT x.show_rating_key,x.season_number,x.episode_number,x.status,x.confidence,x.reason,x.covered_by_rating_key,x.expected_name,x.expected_runtime_minutes,x.actual_duration_minutes,x.search_hint,x.fingerprint,now() FROM jsonb_to_recordset(${payload}::jsonb) AS x(show_rating_key text,season_number int,episode_number int,status text,confidence text,reason text,covered_by_rating_key text,expected_name text,expected_runtime_minutes int,actual_duration_minutes numeric,search_hint text,fingerprint text)`}
  await syncSeriesSeasonCoverage(sql,showRatingKey);
  return{official:rows.length,matched:rows.filter(x=>x.status!=='missing').length,combined:rows.filter(x=>x.status==='covered_combined').length,unmatchedPlex:plex.filter(p=>!used.has(String(p.rating_key))).map(p=>({rating_key:p.rating_key,season_number:p.season_number,episode_number:p.episode_number,title:p.plex_title}))};
}

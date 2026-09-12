function manualDoubleEvidence(note){try{const x=JSON.parse(String(note||''));return x?.manual_double===1?x:null}catch{return null}}

export function buildManualDoubleCoverage({manualOverrides=[],plex=[]}={}){
  const bySeasonEpisode=new Map();
  for(const p of plex){
    const key=`${Number(p.season_number)}-${Number(p.episode_number)}`;
    if(!bySeasonEpisode.has(key))bySeasonEpisode.set(key,p);
  }
  const coverage=new Map();
  for(const o of manualOverrides){
    const ev=manualDoubleEvidence(o.note);
    if(!ev)continue;
    if(Number(o.season_number)!==Number(ev.target_season)||Number(o.episode_number)!==Number(ev.target_episode))continue;
    const sourceKey=`${Number(ev.source_season)}-${Number(ev.source_episode)}`;
    const p=bySeasonEpisode.get(sourceKey);
    if(!p)continue;
    coverage.set(`${Number(o.season_number)}-${Number(o.episode_number)}`,{p,ev});
  }
  return coverage;
}

export function matchPlexBySeasonEpisode({ref,plex=[],used=new Set()}={}){
  return plex.find(p=>Number(p.season_number)===Number(ref.season_number)&&Number(p.episode_number)===Number(ref.episode_number)&&!used.has(String(p.rating_key)))||null;
}

export async function syncSeriesSeasonCoverage(sql,showRatingKey){
  const key=String(showRatingKey);
  await sql`UPDATE series_season_availability sa SET status='UNKNOWN',source='plex_coverage_changed',confidence='unknown',checked_at=now(),note='La temporada dejó de estar completa en Plex; disponibilidad ES pendiente de volver a comprobar' WHERE sa.show_rating_key=${key} AND sa.country_code='ES' AND sa.status='PLEX_COMPLETE' AND sa.manual_override=false AND EXISTS(SELECT 1 FROM series_diagnostics d WHERE d.show_rating_key=${key} AND d.season_number=sa.season_number AND d.status='missing')`;
  await sql`UPDATE series_season_availability sa SET status='UNKNOWN',source='legacy_series_provider_reset',confidence='unknown',checked_at=now(),note='Marcaje antiguo basado solo en proveedor de la serie; requiere evidencia por temporada o episodio' WHERE sa.show_rating_key=${key} AND sa.country_code='ES' AND sa.manual_override=false AND sa.source='tmdb_watch_providers' AND sa.status IN('ES_AVAILABLE','ES_PARTIAL') AND EXISTS(SELECT 1 FROM series_diagnostics d WHERE d.show_rating_key=${key} AND d.season_number=sa.season_number AND d.status='missing')`;
  await sql`WITH coverage AS (SELECT season_number,count(*)::int total,count(*) FILTER(WHERE status IN('present','covered_combined'))::int covered FROM series_diagnostics WHERE show_rating_key=${key} AND season_number>0 GROUP BY season_number), complete AS (SELECT season_number FROM coverage WHERE total>0 AND covered=total) INSERT INTO series_season_availability(show_rating_key,season_number,country_code,status,available_from,source,confidence,manual_override,checked_at,note) SELECT ${key},c.season_number,'ES','PLEX_COMPLETE',NULL,'plex_complete','confirmed',false,now(),'Temporada completa en Plex; no requiere comprobar disponibilidad ES mientras siga completa' FROM complete c ON CONFLICT(show_rating_key,season_number,country_code) DO UPDATE SET status='PLEX_COMPLETE',available_from=NULL,source='plex_complete',confidence='confirmed',checked_at=now(),note='Temporada completa en Plex; no requiere comprobar disponibilidad ES mientras siga completa' WHERE series_season_availability.manual_override=false AND (series_season_availability.status IN('UNKNOWN','PLEX_COMPLETE') OR (series_season_availability.source='tmdb_watch_providers' AND series_season_availability.status IN('ES_AVAILABLE','ES_PARTIAL')))`;
}

export async function rebuildSeriesDiagnostics(sql,showRatingKey){
  const [refs,plex,manualOverrides]=await Promise.all([
    sql`SELECT season_number,episode_number,name,runtime_minutes FROM series_reference_episodes WHERE show_rating_key=${showRatingKey} ORDER BY season_number,episode_number`,
    sql`SELECT p.rating_key,p.parent_index season_number,p.item_index episode_number,p.plex_title,p.fingerprint,p.plex_updated_at,COALESCE((SELECT max(m.duration_ms) FROM plex_media m WHERE m.rating_key=p.rating_key),(SELECT sum(f.duration_ms) FROM plex_files f WHERE f.rating_key=p.rating_key))/60000.0 actual_duration_minutes FROM plex_items p WHERE p.grandparent_rating_key=${showRatingKey} AND p.active AND p.item_type='episode' ORDER BY p.parent_index,p.item_index,p.rating_key`,
    sql`SELECT season_number,episode_number,note FROM series_episode_overrides WHERE show_rating_key=${showRatingKey} AND decision='manual_present' ORDER BY season_number,episode_number`
  ]);

  const manualCoverage=buildManualDoubleCoverage({manualOverrides,plex});
  const used=new Set();
  const rows=[];

  for(const r of refs){
    const officialKey=`${Number(r.season_number)}-${Number(r.episode_number)}`;
    const manual=manualCoverage.get(officialKey);
    if(manual){
      const p=manual.p;
      used.add(String(p.rating_key));
      rows.push({
        show_rating_key:String(showRatingKey),
        season_number:Number(r.season_number),
        episode_number:Number(r.episode_number),
        status:'covered_combined',
        confidence:'confirmed',
        reason:`Decisión manual: capítulo doble; S${String(r.season_number).padStart(2,'0')}E${String(r.episode_number).padStart(2,'0')} está incluido en S${String(p.season_number).padStart(2,'0')}E${String(p.episode_number).padStart(2,'0')} de Plex`,
        covered_by_rating_key:String(p.rating_key),
        expected_name:r.name||null,
        expected_runtime_minutes:r.runtime_minutes||null,
        actual_duration_minutes:Number(p.actual_duration_minutes||0)||null,
        search_hint:null,
        fingerprint:p.fingerprint||null
      });
      continue;
    }

    const p=matchPlexBySeasonEpisode({ref:r,plex,used});
    if(p){
      used.add(String(p.rating_key));
      rows.push({
        show_rating_key:String(showRatingKey),
        season_number:Number(r.season_number),
        episode_number:Number(r.episode_number),
        status:'present',
        confidence:'confirmed',
        reason:'Episodio presente en Plex por coincidencia de temporada y número',
        covered_by_rating_key:String(p.rating_key),
        expected_name:r.name||null,
        expected_runtime_minutes:r.runtime_minutes||null,
        actual_duration_minutes:Number(p.actual_duration_minutes||0)||null,
        search_hint:null,
        fingerprint:p.fingerprint||null
      });
      continue;
    }

    rows.push({
      show_rating_key:String(showRatingKey),
      season_number:Number(r.season_number),
      episode_number:Number(r.episode_number),
      status:'missing',
      confidence:'medium',
      reason:'No existe en Plex un episodio con la misma temporada y número',
      covered_by_rating_key:null,
      expected_name:r.name||null,
      expected_runtime_minutes:r.runtime_minutes||null,
      actual_duration_minutes:null,
      search_hint:null,
      fingerprint:null
    });
  }

  await sql`DELETE FROM series_diagnostics WHERE show_rating_key=${showRatingKey}`;
  for(let i=0;i<rows.length;i+=200){
    const payload=JSON.stringify(rows.slice(i,i+200));
    await sql`INSERT INTO series_diagnostics(show_rating_key,season_number,episode_number,status,confidence,reason,covered_by_rating_key,expected_name,expected_runtime_minutes,actual_duration_minutes,search_hint,fingerprint,diagnosed_at) SELECT x.show_rating_key,x.season_number,x.episode_number,x.status,x.confidence,x.reason,x.covered_by_rating_key,x.expected_name,x.expected_runtime_minutes,x.actual_duration_minutes,x.search_hint,x.fingerprint,now() FROM jsonb_to_recordset(${payload}::jsonb) AS x(show_rating_key text,season_number int,episode_number int,status text,confidence text,reason text,covered_by_rating_key text,expected_name text,expected_runtime_minutes int,actual_duration_minutes numeric,search_hint text,fingerprint text)`;
  }
  await syncSeriesSeasonCoverage(sql,showRatingKey);
  return{
    official:rows.length,
    matched:rows.filter(x=>x.status!=='missing').length,
    combined:rows.filter(x=>x.status==='covered_combined').length,
    reconciled:0,
    unmatchedPlex:plex.filter(p=>!used.has(String(p.rating_key))).map(p=>({rating_key:p.rating_key,season_number:p.season_number,episode_number:p.episode_number,title:p.plex_title}))
  };
}

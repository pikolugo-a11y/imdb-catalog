function keyOf(value){return String(value??'')}
function numberOf(value){const n=Number(value);return Number.isFinite(n)?n:null}
function coveredKeys(row){return String(row?.covered_by_rating_key||'').split(',').map(x=>x.trim()).filter(Boolean)}

export function reconcileReciprocalEpisodeNumbering({rows=[],plex=[],used=new Set()}={}){
  const nextRows=rows.map(row=>({...row}));
  const nextUsed=new Set([...used].map(keyOf));
  const plexByKey=new Map(plex.map(item=>[keyOf(item.rating_key),item]));
  const seasonHasCombined=new Set(nextRows.filter(row=>row.status==='covered_combined').map(row=>numberOf(row.season_number)));
  const seasonStats=new Map();
  for(const row of nextRows){
    const season=numberOf(row.season_number);if(season===null)continue;
    const stats=seasonStats.get(season)||{missing:0,displaced:0};
    if(row.status==='missing')stats.missing++;
    if(row.status==='present'){
      const keys=coveredKeys(row),item=keys.length===1?plexByKey.get(keys[0]):null;
      if(item&&numberOf(item.season_number)===season&&numberOf(item.episode_number)!==numberOf(row.episode_number))stats.displaced++;
    }
    seasonStats.set(season,stats);
  }
  let reconciled=0;

  for(const missing of nextRows.filter(row=>row.status==='missing')){
    const season=numberOf(missing.season_number),episode=numberOf(missing.episode_number);
    const stats=seasonStats.get(season);
    if(season===null||episode===null||seasonHasCombined.has(season)||stats?.missing!==1||stats?.displaced!==1)continue;

    const plexAtMissing=plex.filter(item=>numberOf(item.season_number)===season&&numberOf(item.episode_number)===episode);
    if(plexAtMissing.length!==1)continue;
    const occupied=plexAtMissing[0],occupiedKey=keyOf(occupied.rating_key);
    if(!nextUsed.has(occupiedKey))continue;

    const displaced=nextRows.find(row=>{
      if(numberOf(row.season_number)!==season||row.status!=='present')return false;
      const keys=coveredKeys(row);
      return keys.length===1&&keys[0]===occupiedKey&&numberOf(row.episode_number)!==episode;
    });
    if(!displaced)continue;

    const displacedEpisode=numberOf(displaced.episode_number);
    if(displacedEpisode===null)continue;
    const residual=plex.filter(item=>numberOf(item.season_number)===season&&numberOf(item.episode_number)===displacedEpisode&&!nextUsed.has(keyOf(item.rating_key)));
    if(residual.length!==1)continue;

    const replacement=residual[0],replacementKey=keyOf(replacement.rating_key);
    if(!replacementKey||!plexByKey.has(replacementKey))continue;

    missing.status='present';
    missing.confidence='high';
    missing.reason=`Presente por reconciliación recíproca de numeración en Plex: S${String(season).padStart(2,'0')}E${String(displacedEpisode).padStart(2,'0')} y S${String(season).padStart(2,'0')}E${String(episode).padStart(2,'0')} están desplazados entre la referencia y Plex`;
    missing.covered_by_rating_key=replacementKey;
    missing.actual_duration_minutes=Number(replacement.actual_duration_minutes||0)||null;
    missing.fingerprint=replacement.fingerprint||null;
    nextUsed.add(replacementKey);
    reconciled++;
  }

  return{rows:nextRows,used:nextUsed,reconciled};
}

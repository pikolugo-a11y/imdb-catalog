const MAX_EXPLICIT_COMBINED_EPISODES=8;
const MAX_TITLE_INFERRED_EPISODES=3;

const n=value=>{const x=Number(value);return Number.isInteger(x)?x:null};
const key=(season,episode)=>`${Number(season)}-${Number(episode)}`;
const basename=value=>String(value||'').split(/[\\/]/).pop().replace(/\.[a-z0-9]{2,5}$/i,'');
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[ªº]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const tokens=value=>new Set(normalize(value).split(/\s+/).filter(x=>x&&(/\d/.test(x)||x.length>1)));

export function titleSimilarity(a,b){
  const left=normalize(a),right=normalize(b);
  if(!left||!right)return 0;
  if(left===right)return 1;
  if(Math.min(left.length,right.length)>=8&&(left.includes(right)||right.includes(left)))return .95;
  const aa=tokens(left),bb=tokens(right);if(!aa.size||!bb.size)return 0;
  let common=0;for(const token of aa)if(bb.has(token))common++;
  return common/Math.max(aa.size,bb.size);
}

export function extractEpisodeMarkers(value){
  const text=basename(value),regex=/\b(?:s(\d{1,2})e(\d{1,4})|(\d{1,2})x(\d{1,4}))\b/gi,out=[];
  for(const match of text.matchAll(regex)){
    const season=n(match[1]??match[3]),episode=n(match[2]??match[4]);
    if(season==null||episode==null||season<0||episode<1)continue;
    out.push({season,episode,raw:match[0],index:match.index,end:Number(match.index)+match[0].length});
  }
  return out;
}

function pathsOf(row){
  const values=Array.isArray(row?.file_paths)?row.file_paths:[row?.file_path];
  return [...new Set(values.filter(x=>x!=null).map(String).map(x=>x.trim()).filter(Boolean))];
}

function contiguousEpisodes(values,sourceEpisode,max){
  const episodes=[...new Set(values.map(Number).filter(Number.isInteger))];
  if(episodes.length<2||episodes.length>max||episodes[0]!==sourceEpisode)return null;
  for(let i=0;i<episodes.length;i++)if(episodes[i]!==sourceEpisode+i)return null;
  return episodes;
}

function explicitCandidate(row,path){
  const season=n(row?.season_number),episode=n(row?.episode_number);if(season==null||episode==null)return null;
  const markers=extractEpisodeMarkers(path);if(markers.length<2)return null;
  if(markers.some(marker=>marker.season!==season))return null;
  const episodes=contiguousEpisodes(markers.map(marker=>marker.episode),episode,MAX_EXPLICIT_COMBINED_EPISODES);if(!episodes)return null;
  return{method:'explicit_markers',season,episodes,path,confidence:'confirmed',scores:null,durationRatio:null};
}

function titleSegments(path,marker){
  const text=basename(path),tail=text.slice(marker.end).replace(/^[\s._:;\-–—]+/,'').trim();
  if(!tail)return[];
  return tail.split(/\s+_\s+|\s+\|\s+/).map(x=>x.trim()).filter(Boolean);
}

function durationRatio(row,refs){
  const actual=Number(row?.actual_duration_minutes),expected=refs.reduce((sum,ref)=>sum+(Number(ref?.runtime_minutes)||0),0);
  return actual>0&&expected>0?actual/expected:null;
}

function titleCandidate(row,path,{refsByKey,plexByKey,nextPhysicalByKey}){
  const season=n(row?.season_number),episode=n(row?.episode_number);if(season==null||episode==null)return null;
  const markers=extractEpisodeMarkers(path);if(markers.length!==1||markers[0].season!==season||markers[0].episode!==episode)return null;
  const segments=titleSegments(path,markers[0]);
  if(segments.length<2||segments.length>MAX_TITLE_INFERRED_EPISODES)return null;
  const official=[];for(let offset=0;offset<segments.length;offset++){const ref=refsByKey.get(key(season,episode+offset));if(!ref)return null;official.push(ref)}
  for(let offset=1;offset<official.length;offset++)if(plexByKey.has(key(season,episode+offset)))return null;
  const next=nextPhysicalByKey.get(key(season,episode));if(next!=null&&next<episode+official.length)return null;
  const scores=segments.map((segment,index)=>titleSimilarity(segment,official[index]?.name));
  const average=scores.reduce((sum,value)=>sum+value,0)/scores.length;
  if(scores.some(score=>score<.68)||average<.78)return null;
  const ratio=durationRatio(row,official);if(ratio!=null&&(ratio<.62||ratio>1.3))return null;
  return{method:'official_titles',season,episodes:official.map(ref=>Number(ref.episode_number)),path,confidence:'high',scores,durationRatio:ratio};
}

function chooseCandidate(candidates){
  if(!candidates.length)return null;
  const signature=candidate=>`${candidate.season}:${candidate.episodes.join(',')}`;
  const first=signature(candidates[0]);
  return candidates.every(candidate=>signature(candidate)===first)?candidates[0]:null;
}

function automaticCandidate(row,context){
  const paths=pathsOf(row);if(!paths.length)return null;
  const explicit=paths.map(path=>explicitCandidate(row,path)).filter(Boolean);
  if(explicit.length)return chooseCandidate(explicit);
  return chooseCandidate(paths.map(path=>titleCandidate(row,path,context)).filter(Boolean));
}

export function buildAutomaticCombinedCoverage({refs=[],plex=[]}={}){
  const refsByKey=new Map(refs.map(ref=>[key(ref.season_number,ref.episode_number),ref]));
  const plexByKey=new Map();
  for(const row of plex){const k=key(row.season_number,row.episode_number);if(!plexByKey.has(k))plexByKey.set(k,[]);plexByKey.get(k).push(row)}
  const nextPhysicalByKey=new Map();
  const bySeason=new Map();
  for(const row of plex){const season=n(row.season_number),episode=n(row.episode_number);if(season==null||episode==null)continue;if(!bySeason.has(season))bySeason.set(season,[]);bySeason.get(season).push(episode)}
  for(const [season,episodesRaw] of bySeason){const episodes=[...new Set(episodesRaw)].sort((a,b)=>a-b);for(let i=0;i<episodes.length-1;i++)nextPhysicalByKey.set(key(season,episodes[i]),episodes[i+1])}
  const context={refsByKey,plexByKey,nextPhysicalByKey},coverage=new Map(),conflicts=new Set(),sources=[];
  for(const row of plex){
    const candidate=automaticCandidate(row,context);if(!candidate)continue;
    const sourceEpisode=Number(row.episode_number),sourceRef=refsByKey.get(key(candidate.season,sourceEpisode));if(!sourceRef)continue;
    const targets=candidate.episodes.slice(1);
    if(!targets.length||targets.some(episode=>!refsByKey.has(key(candidate.season,episode))||plexByKey.has(key(candidate.season,episode))))continue;
    const source={p:row,evidence:candidate};let accepted=0;
    for(const episode of targets){
      const targetKey=key(candidate.season,episode);
      if(conflicts.has(targetKey))continue;
      if(coverage.has(targetKey)){coverage.delete(targetKey);conflicts.add(targetKey);continue}
      coverage.set(targetKey,source);accepted++;
    }
    if(accepted)sources.push({rating_key:String(row.rating_key),season_number:candidate.season,source_episode:sourceEpisode,target_episodes:targets,method:candidate.method,confidence:candidate.confidence});
  }
  return{coverage,sources,conflicts};
}

export function automaticCombinedReason({target,evidence}={}){
  const season=Number(target?.season_number),episode=Number(target?.episode_number),source=Number(evidence?.episodes?.[0]),last=Number(evidence?.episodes?.at(-1));
  const range=`S${String(season).padStart(2,'0')}E${String(source).padStart(2,'0')}–E${String(last).padStart(2,'0')}`;
  const method=evidence?.method==='explicit_markers'?'numeración explícita del archivo Plex':'títulos oficiales contenidos en el archivo Plex';
  return `Cobertura combinada detectada automáticamente por ${method}: ${range}; incluye S${String(season).padStart(2,'0')}E${String(episode).padStart(2,'0')}`;
}

const text=v=>v==null?'':String(v);
const integer=v=>{const n=Number(v);return Number.isFinite(n)?Math.trunc(n):null};
const instant=v=>{if(v==null||v==='')return null;const n=Date.parse(String(v));return Number.isFinite(n)?n:String(v)};

export function normalizePlexEpisode(item,{sectionId,fingerprint}={}){
  const ratingKey=text(item?.ratingKey).trim();
  const showKey=text(item?.grandparentRatingKey).trim();
  if(!ratingKey||!showKey)return null;
  const updatedAt=Number(item?.updatedAt);
  return{
    rating_key:ratingKey,
    library_section_id:integer(item?.librarySectionID)??integer(sectionId),
    plex_title:item?.title||null,
    plex_year:integer(item?.year),
    plex_updated_at:Number.isFinite(updatedAt)&&updatedAt>0?new Date(updatedAt*1000).toISOString():null,
    parent_rating_key:text(item?.parentRatingKey).trim()||null,
    grandparent_rating_key:showKey,
    parent_index:integer(item?.parentIndex)??0,
    item_index:integer(item?.index)??0,
    fingerprint:fingerprint||null
  };
}

export function episodeInventoryRowChanged(previous,next){
  if(!previous)return true;
  if(previous.active===false||previous.has_media===false)return true;
  return integer(previous.library_section_id)!==integer(next.library_section_id)
    ||text(previous.plex_title)!==text(next.plex_title)
    ||integer(previous.plex_year)!==integer(next.plex_year)
    ||instant(previous.plex_updated_at)!==instant(next.plex_updated_at)
    ||text(previous.parent_rating_key)!==text(next.parent_rating_key)
    ||text(previous.grandparent_rating_key)!==text(next.grandparent_rating_key)
    ||integer(previous.parent_index)!==integer(next.parent_index)
    ||integer(previous.item_index)!==integer(next.item_index);
}

export function planEpisodeInventoryDiff({incoming=[],existing=[],successfulSectionIds=[]}={}){
  const sectionIds=new Set(successfulSectionIds.map(integer).filter(v=>v!=null));
  const incomingByKey=new Map();
  for(const row of incoming){if(row?.rating_key)incomingByKey.set(String(row.rating_key),row)}
  const existingByKey=new Map(existing.map(row=>[String(row.rating_key),row]));
  const created=[],changed=[],missing=[];
  const affectedShowKeys=new Set();

  for(const row of incomingByKey.values()){
    const previous=existingByKey.get(String(row.rating_key));
    if(!previous){
      created.push(row);
      if(row.grandparent_rating_key)affectedShowKeys.add(String(row.grandparent_rating_key));
      continue;
    }
    if(episodeInventoryRowChanged(previous,row)){
      changed.push(row);
      if(previous.grandparent_rating_key)affectedShowKeys.add(String(previous.grandparent_rating_key));
      if(row.grandparent_rating_key)affectedShowKeys.add(String(row.grandparent_rating_key));
    }
  }

  for(const previous of existing){
    if(previous.active===false)continue;
    if(!sectionIds.has(integer(previous.library_section_id)))continue;
    if(incomingByKey.has(String(previous.rating_key)))continue;
    missing.push(previous);
    if(previous.grandparent_rating_key)affectedShowKeys.add(String(previous.grandparent_rating_key));
  }

  return{
    created,
    changed,
    missing,
    upserts:[...created,...changed],
    affectedShowKeys:[...affectedShowKeys]
  };
}

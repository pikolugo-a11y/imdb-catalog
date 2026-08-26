export async function claimTechnicalBatch(sql,{limit=25,itemType=null}={}){
  const rows=itemType
    ? await sql`
        SELECT s.rating_key,p.item_type
        FROM plex_technical_state s
        JOIN plex_items p ON p.rating_key=s.rating_key
        WHERE p.active=true AND p.item_type=${itemType}
          AND s.needs_refresh=true AND s.snapshot_status IN ('pending','stale','error','missing')
        ORDER BY CASE p.item_type WHEN 'movie' THEN 0 ELSE 1 END,p.added_at DESC NULLS LAST,s.updated_at ASC
        LIMIT ${limit}
      `
    : await sql`
        SELECT s.rating_key,p.item_type
        FROM plex_technical_state s
        JOIN plex_items p ON p.rating_key=s.rating_key
        WHERE p.active=true AND p.item_type IN ('movie','episode')
          AND s.needs_refresh=true AND s.snapshot_status IN ('pending','stale','error','missing')
        ORDER BY CASE p.item_type WHEN 'movie' THEN 0 ELSE 1 END,p.added_at DESC NULLS LAST,s.updated_at ASC
        LIMIT ${limit}
      `;
  return rows;
}

export async function markTechnicalError(sql,ratingKey,error){
  await sql`
    UPDATE plex_technical_state
    SET snapshot_status='error',needs_refresh=true,last_error=${String(error?.message||error).slice(0,1000)},updated_at=now()
    WHERE rating_key=${String(ratingKey)}
  `;
}

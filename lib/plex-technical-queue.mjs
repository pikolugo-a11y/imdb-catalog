export async function seedTechnicalQueue(sql){
  const rows=await sql`
    INSERT INTO plex_technical_state(
      rating_key,probe_fingerprint,technical_fingerprint,snapshot_status,snapshot_version,
      needs_refresh,captured_at,source_updated_at,last_probe_at,last_error,updated_at
    )
    SELECT p.rating_key,NULL,NULL,'pending','1',true,NULL,p.plex_updated_at,now(),NULL,now()
    FROM plex_items p
    WHERE p.active=true AND p.item_type IN ('movie','episode')
      AND NOT EXISTS(SELECT 1 FROM plex_technical_state s WHERE s.rating_key=p.rating_key)
    ON CONFLICT(rating_key) DO NOTHING
    RETURNING rating_key
  `;
  return rows.length;
}

export async function markTechnicalChanges(sql){
  const rows=await sql`
    UPDATE plex_technical_state s
    SET snapshot_status=CASE WHEN s.technical_fingerprint IS NULL THEN 'pending' ELSE 'stale' END,
        needs_refresh=true,
        source_updated_at=p.plex_updated_at,
        last_probe_at=now(),
        last_error=NULL,
        updated_at=now()
    FROM plex_items p
    WHERE p.rating_key=s.rating_key
      AND p.active=true
      AND p.item_type IN ('movie','episode')
      AND p.plex_updated_at IS DISTINCT FROM s.source_updated_at
    RETURNING s.rating_key
  `;
  return rows.length;
}

export async function refreshTechnicalQueue(sql){
  const seeded=await seedTechnicalQueue(sql);
  const changed=await markTechnicalChanges(sql);
  return{seeded,changed};
}

export async function claimTechnicalBatch(sql,{limit=25,itemType=null}={}){
  const rows=itemType
    ? await sql`
        SELECT s.rating_key,p.item_type,p.plex_updated_at
        FROM plex_technical_state s
        JOIN plex_items p ON p.rating_key=s.rating_key
        WHERE p.active=true AND p.item_type=${itemType}
          AND s.needs_refresh=true AND s.snapshot_status IN ('pending','stale','error','missing')
        ORDER BY CASE p.item_type WHEN 'movie' THEN 0 ELSE 1 END,p.added_at DESC NULLS LAST,s.updated_at ASC
        LIMIT ${limit}
      `
    : await sql`
        SELECT s.rating_key,p.item_type,p.plex_updated_at
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

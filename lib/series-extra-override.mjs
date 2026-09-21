export function parseSeriesExtraOverrideEvidence(note){
  try{
    const value=JSON.parse(String(note||''));
    return value?.ser005===1?value:null;
  }catch{
    return null;
  }
}

export function evaluateSeriesExtraOverride({decision,note,ratingKey,fingerprint}={}){
  const evidence=parseSeriesExtraOverrideEvidence(note);
  const accepted=['special','not_needed'].includes(String(decision||''));
  const storedRatingKey=String(evidence?.plex_rating_key||'').trim();
  const currentRatingKey=String(ratingKey||'').trim();
  const sameIdentity=Boolean(accepted&&storedRatingKey&&currentRatingKey&&storedRatingKey===currentRatingKey);
  const evidenceChanged=Boolean(
    sameIdentity&&String(evidence?.plex_fingerprint||'')!==String(fingerprint||'')
  );
  return{
    current:sameIdentity,
    stale:Boolean(accepted&&!sameIdentity),
    evidenceChanged,
    note:evidence?.note||null,
    evidence
  };
}

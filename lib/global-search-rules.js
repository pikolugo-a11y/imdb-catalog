export const GLOBAL_SEARCH_MIN_TEXT=3;

export function isGlobalSearchableTerm(value){
  const term=String(value||'').trim();
  return term.length>=GLOBAL_SEARCH_MIN_TEXT||/^tt\d+$/i.test(term)||/^\d{2,}$/.test(term);
}

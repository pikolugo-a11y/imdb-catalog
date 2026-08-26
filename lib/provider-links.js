export function providerUrl(provider,id,type='Película'){
  const value=String(id||'').trim();
  if(!value)return null;
  const series=['Serie','Miniserie'].includes(String(type||''));
  if(provider==='imdb')return /^tt\d+$/.test(value)?`https://www.imdb.com/title/${value}/`:null;
  if(provider==='tmdb'&&/^\d+$/.test(value))return `https://www.themoviedb.org/${series?'tv':'movie'}/${value}`;
  if(provider==='mdblist'&&/^tt\d+$/.test(value))return `https://mdblist.com/${series?'show':'movie'}/${value}`;
  if(provider==='trakt'&&/^tt\d+$/.test(value))return `https://trakt.tv/search/imdb/${value}`;
  return null;
}

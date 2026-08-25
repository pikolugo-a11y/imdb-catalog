export function providerUrl(provider,id,type='Película'){
  const value=String(id||'').trim();if(!value)return null;
  if(provider==='imdb')return /^tt\d+$/.test(value)?`https://www.imdb.com/title/${value}/`:null;
  if(provider==='tmdb'&&/^\d+$/.test(value))return `https://www.themoviedb.org/${type==='Película'?'movie':'tv'}/${value}`;
  return null;
}

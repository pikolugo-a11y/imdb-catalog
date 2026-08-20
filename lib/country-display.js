export function countryFlag(code){
  const c=String(code||'').trim().toUpperCase();
  if(!/^[A-Z]{2}$/.test(c))return '🌐';
  return String.fromCodePoint(...[...c].map(ch=>127397+ch.charCodeAt(0)));
}

const fallback={US:'Estados Unidos',ES:'España',GB:'Reino Unido',FR:'Francia',IT:'Italia',DE:'Alemania',CA:'Canadá',JP:'Japón',KR:'Corea del Sur',AU:'Australia',MX:'México',AR:'Argentina',BR:'Brasil',SE:'Suecia',NO:'Noruega',DK:'Dinamarca',FI:'Finlandia',IE:'Irlanda',BE:'Bélgica',NL:'Países Bajos',NZ:'Nueva Zelanda',PT:'Portugal',CH:'Suiza',AT:'Austria',PL:'Polonia',CZ:'Chequia',GR:'Grecia',TR:'Turquía',IN:'India'};

export function countryName(code){
  const c=String(code||'').trim().toUpperCase();
  if(!c)return 'País pendiente';
  try{return new Intl.DisplayNames(['es'],{type:'region'}).of(c)||fallback[c]||c}catch{return fallback[c]||c}
}

export function countryLabel(code){
  const c=String(code||'').trim().toUpperCase();
  return c?`${countryFlag(c)} ${countryName(c)}`:'🌐 País pendiente';
}

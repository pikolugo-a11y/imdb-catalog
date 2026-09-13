export const NEWS_SETTINGS_SCHEMA_VERSION=5;
export const DEFAULT_NEWS_SETTINGS={version:NEWS_SETTINGS_SCHEMA_VERSION,movie:{general:{minRating:6,minVotes:10000},spain:{minRating:6,minVotes:7500}},series:{general:{minRating:7,minVotes:7000},spain:{minRating:6.5,minVotes:1000}},excludedCountries:['Q668','IN'],excludeAdult:true};

const numberOr=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
const legacySpanishSeriesRule=raw=>{
  const rating=numberOr(raw?.series?.spain?.minRating,NaN),votes=numberOr(raw?.series?.spain?.minVotes,NaN),version=numberOr(raw?.version,1);
  return version<NEWS_SETTINGS_SCHEMA_VERSION&&((rating===6&&votes===3000)||(rating===6.5&&votes===4000));
};

export function normalizeNewsSettings(raw={}){
  const source=raw&&typeof raw==='object'?raw:{};
  const migratedSpain=legacySpanishSeriesRule(source)?DEFAULT_NEWS_SETTINGS.series.spain:{...DEFAULT_NEWS_SETTINGS.series.spain,...source?.series?.spain};
  return{
    ...DEFAULT_NEWS_SETTINGS,
    ...source,
    version:Math.max(NEWS_SETTINGS_SCHEMA_VERSION,numberOr(source.version,1)),
    movie:{
      general:{...DEFAULT_NEWS_SETTINGS.movie.general,...source?.movie?.general},
      spain:{...DEFAULT_NEWS_SETTINGS.movie.spain,...source?.movie?.spain},
    },
    series:{
      general:{...DEFAULT_NEWS_SETTINGS.series.general,...source?.series?.general},
      spain:migratedSpain,
    },
    excludedCountries:Array.isArray(source.excludedCountries)?source.excludedCountries:DEFAULT_NEWS_SETTINGS.excludedCountries,
    excludeAdult:source.excludeAdult!==false,
  };
}

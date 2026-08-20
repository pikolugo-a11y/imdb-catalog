import 'server-only';
import {db} from './db';

export const DEFAULT_MOVIE_QUALITY_SETTINGS={
  version:1,
  duration:{minMinutes:10,minPercent:15},
  filename:{minSimilarity:0.55},
  pikoQuality:{minScore:60},
  duplicates:{verySimilarPercent:2,differentCutPercent:10}
};

function num(v,fallback,min,max){const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback}
function merge(raw={}){return{
  ...DEFAULT_MOVIE_QUALITY_SETTINGS,...raw,
  duration:{minMinutes:num(raw?.duration?.minMinutes,10,1,180),minPercent:num(raw?.duration?.minPercent,15,1,100)},
  filename:{minSimilarity:num(raw?.filename?.minSimilarity,.55,.1,1)},
  pikoQuality:{minScore:num(raw?.pikoQuality?.minScore,60,0,100)},
  duplicates:{verySimilarPercent:num(raw?.duplicates?.verySimilarPercent,2,0,50),differentCutPercent:num(raw?.duplicates?.differentCutPercent,10,0,100)}
}}
export async function getMovieQualitySettings(){const sql=db();const[row]=await sql`SELECT value,updated_at FROM app_settings WHERE key='movie_quality_v3' LIMIT 1`;return{...merge(row?.value||{}),updatedAt:row?.updated_at||null}}
export async function saveMovieQualitySettings(input={}){const sql=db(),value=merge(input);await sql`INSERT INTO app_settings(key,value,updated_at) VALUES('movie_quality_v3',${JSON.stringify(value)}::jsonb,now()) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=now()`;return value}

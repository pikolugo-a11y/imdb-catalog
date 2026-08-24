export const PIKOSCORE_V3_VERSION='3.0.0-experimental.1';

const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

export const SOURCE_CONFIG=Object.freeze({
  imdb:{family:'audience',baseWeight:1.00,voteTarget:20000},
  tmdb:{family:'audience',baseWeight:0.90,voteTarget:1200},
  trakt:{family:'audience',baseWeight:0.85,voteTarget:3000},
  rt_audience:{family:'audience',baseWeight:0.80,voteTarget:5000},
  metacritic_user:{family:'audience',baseWeight:0.70,voteTarget:1200},
  letterboxd:{family:'cinephile',baseWeight:1.00,voteTarget:8000},
  rt_critics:{family:'critics',baseWeight:1.00,voteTarget:null},
  metacritic:{family:'critics',baseWeight:1.00,voteTarget:null},
  roger_ebert:{family:'critics',baseWeight:0.70,voteTarget:null},
});

export const FAMILY_WEIGHTS=Object.freeze({audience:0.50,cinephile:0.25,critics:0.25});

// El ajuste de mercado solo cambia cuántos votos hacen falta para considerar
// representativa una señal; nunca añade o resta puntos a la nota directamente.
export const MARKET_PROFILES=Object.freeze({
  spain:{voteScale:0.35,label:'España'},
  global:{voteScale:1.00,label:'Global'},
});

function marketKey(country){return /\b(spain|españa)\b/i.test(String(country||''))?'spain':'global';}

function ageYears(row){
  if(row?.release_date){const d=new Date(row.release_date);if(!Number.isNaN(d.getTime()))return Math.max(0,(Date.now()-d.getTime())/(365.25*86400000));}
  const y=Number(row?.year);return y>1800?Math.max(0,new Date().getUTCFullYear()-y):10;
}

function ageVoteScale(row){const age=ageYears(row);return age<0.25?0.25:age<1?0.40:age<3?0.65:age<10?0.85:1;}

function validRating(r){return r?.status==='available'&&Number.isFinite(Number(r?.normalized_rating))&&Number(r.normalized_rating)>0;}

function sourceConfidence(rating,row,market){
  const cfg=SOURCE_CONFIG[rating.source];
  if(!cfg)return 0;
  if(cfg.voteTarget==null)return 0.72; // señales críticas sin volumen público de votos
  const votes=Math.max(0,Number(rating.votes)||0);
  const target=Math.max(1,cfg.voteTarget*market.voteScale*ageVoteScale(row));
  if(!votes)return 0.35;
  return clamp(votes/(votes+target),0.35,0.98);
}

function std(values){if(values.length<2)return 0;const mean=values.reduce((a,b)=>a+b,0)/values.length;return Math.sqrt(values.reduce((s,x)=>s+(x-mean)**2,0)/values.length);}

function weightedMean(items){const den=items.reduce((s,x)=>s+x.weight,0);return den?items.reduce((s,x)=>s+x.value*x.weight,0)/den:null;}

function familyResult(family,ratings,row,market){
  const members=ratings.filter(r=>SOURCE_CONFIG[r.source]?.family===family).map(r=>{
    const cfg=SOURCE_CONFIG[r.source];
    const confidence=sourceConfidence(r,row,market);
    // La confianza modula de forma acotada el peso de la fuente. Un gran volumen
    // de votos no puede multiplicar indefinidamente la influencia de IMDb.
    const weight=cfg.baseWeight*(0.55+0.45*confidence);
    return{source:r.source,value:Number(r.normalized_rating),votes:r.votes==null?null:Number(r.votes),confidence,weight,provider:r.provider||null};
  });
  if(!members.length)return null;
  const value=weightedMean(members);
  const dispersion=std(members.map(x=>x.value));
  const confidenceBase=members.reduce((s,x)=>s+x.confidence*x.weight,0)/members.reduce((s,x)=>s+x.weight,0);
  const agreement=clamp(1-dispersion/3,0.60,1);
  return{family,value:Number(value.toFixed(3)),confidence:Number((confidenceBase*agreement).toFixed(3)),dispersion:Number(dispersion.toFixed(3)),members};
}

export function computePikoScoreV3({ratings=[],country=null,year=null,release_date=null}={}){
  const usable=(Array.isArray(ratings)?ratings:[]).filter(validRating).filter(r=>SOURCE_CONFIG[r.source]);
  if(usable.length<2)throw new Error('PikoScore 3.0 necesita al menos dos fuentes de rating válidas');
  const row={country,year,release_date},market=MARKET_PROFILES[marketKey(country)];
  const families=['audience','cinephile','critics'].map(f=>familyResult(f,usable,row,market)).filter(Boolean);
  if(!families.length)throw new Error('No hay familias de rating utilizables');
  const availableWeight=families.reduce((s,f)=>s+FAMILY_WEIGHTS[f.family],0);
  const contributions=families.map(f=>({
    ...f,
    normalizedFamilyWeight:FAMILY_WEIGHTS[f.family]/availableWeight,
    contribution:f.value*(FAMILY_WEIGHTS[f.family]/availableWeight),
  }));
  const score=clamp(contributions.reduce((s,f)=>s+f.contribution,0),0,10);
  const familyConfidence=contributions.reduce((s,f)=>s+f.confidence*f.normalizedFamilyWeight,0);
  const familyCoverage=availableWeight; // 1.0 cuando existen las tres familias
  const diversity=clamp(usable.length/6,0.35,1);
  const overallDispersion=std(usable.map(r=>Number(r.normalized_rating)));
  const consensus=clamp(1-overallDispersion/3.5,0.60,1);
  const confidence=100*clamp(familyConfidence*(0.65+0.35*familyCoverage)*(0.75+0.25*diversity)*consensus,0,1);
  return{
    version:PIKOSCORE_V3_VERSION,
    score:Number(score.toFixed(2)),
    confidence:Number(confidence.toFixed(1)),
    market:marketKey(country),
    marketVoteScale:market.voteScale,
    sourceCount:usable.length,
    familyCount:contributions.length,
    familyCoverage:Number(familyCoverage.toFixed(3)),
    contributions:contributions.map(f=>({
      family:f.family,
      score:f.value,
      confidence:f.confidence,
      weight:Number(f.normalizedFamilyWeight.toFixed(3)),
      contribution:Number(f.contribution.toFixed(3)),
      dispersion:f.dispersion,
      sources:f.members.map(m=>({source:m.source,rating:m.value,votes:m.votes,confidence:Number(m.confidence.toFixed(3)),effectiveWeight:Number(m.weight.toFixed(3)),provider:m.provider})),
    })),
  };
}

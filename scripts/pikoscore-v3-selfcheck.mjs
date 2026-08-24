import assert from 'node:assert/strict';
import {computePikoScoreV3} from '../lib/pikoscore-v3-core.mjs';

const baseRatings=[
  {source:'imdb',normalized_rating:8.0,votes:500000,status:'available',provider:'mdblist'},
  {source:'tmdb',normalized_rating:7.2,votes:9000,status:'available',provider:'mdblist'},
  {source:'letterboxd',normalized_rating:7.8,votes:70000,status:'available',provider:'mdblist'},
  {source:'rt_critics',normalized_rating:8.1,votes:null,status:'available',provider:'mdblist'},
  {source:'metacritic',normalized_rating:7.7,votes:null,status:'available',provider:'mdblist'},
];

const globalScore=computePikoScoreV3({ratings:baseRatings,country:'United States',year:2020});
const spanishSameRatings=computePikoScoreV3({ratings:baseRatings,country:'España',year:2020});

// El perfil de mercado cambia confianza, nunca la nota con ratings idénticos.
assert.equal(spanishSameRatings.score,globalScore.score);
assert.ok(spanishSameRatings.confidence>=globalScore.confidence);

// IMDb no puede dominar el resultado por volumen: las familias mantienen sus pesos.
const audience=globalScore.contributions.find(x=>x.family==='audience');
const cinephile=globalScore.contributions.find(x=>x.family==='cinephile');
const critics=globalScore.contributions.find(x=>x.family==='critics');
assert.equal(audience.weight,0.5);
assert.equal(cinephile.weight,0.25);
assert.equal(critics.weight,0.25);
const imdb=audience.sources.find(x=>x.source==='imdb');
const tmdb=audience.sources.find(x=>x.source==='tmdb');
assert.equal(imdb.baseWeight,1);
assert.equal(tmdb.baseWeight,0.9);

// Cambiar solo el volumen de votos no puede cambiar el PikoScore.
const hugeImdb=baseRatings.map(r=>r.source==='imdb'?{...r,votes:5000000}:r);
const tinyImdb=baseRatings.map(r=>r.source==='imdb'?{...r,votes:500}:r);
assert.equal(computePikoScoreV3({ratings:hugeImdb,country:'United States',year:2020}).score,computePikoScoreV3({ratings:tinyImdb,country:'United States',year:2020}).score);

// Una española con menos votos debe ganar confianza relativa sin recibir bonus de nota.
const lowVoteRatings=baseRatings.map(r=>r.source==='imdb'?{...r,votes:9000}:r.source==='tmdb'?{...r,votes:900}:r);
const lowGlobal=computePikoScoreV3({ratings:lowVoteRatings,country:'United States',year:2020});
const lowSpain=computePikoScoreV3({ratings:lowVoteRatings,country:'España',year:2020});
assert.equal(lowSpain.score,lowGlobal.score);
assert.ok(lowSpain.confidence>lowGlobal.confidence);

// Debe funcionar con cobertura variable y al menos dos fuentes.
const sparse=computePikoScoreV3({ratings:[
  {source:'imdb',normalized_rating:7.5,votes:12000,status:'available'},
  {source:'letterboxd',normalized_rating:8.0,votes:3000,status:'available'},
],country:'España',year:2018});
assert.equal(sparse.sourceCount,2);
assert.equal(sparse.familyCount,2);
assert.ok(sparse.score>0&&sparse.score<=10);

console.log('PikoScore 3.0 self-check OK', {global:globalScore.score,globalConfidence:globalScore.confidence,spainConfidence:spanishSameRatings.confidence,sparse:sparse.score});

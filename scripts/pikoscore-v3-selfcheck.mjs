import assert from 'node:assert/strict';
import {computePikoScoreV3} from '../lib/pikoscore-v3-core.mjs';

const baseRatings=[
  {source:'imdb',normalized_rating:8.0,votes:500000,status:'available',provider:'mdblist'},
  {source:'tmdb',normalized_rating:7.2,votes:9000,status:'available',provider:'mdblist'},
  {source:'letterboxd',normalized_rating:7.8,votes:70000,status:'available',provider:'mdblist'},
  {source:'rt_critics',normalized_rating:8.1,votes:160,status:'available',provider:'mdblist'},
  {source:'metacritic',normalized_rating:7.7,votes:80,status:'available',provider:'mdblist'},
];

const globalScore=computePikoScoreV3({ratings:baseRatings,country:'United States',year:2020});
const spanishSameRatings=computePikoScoreV3({ratings:baseRatings,country:'España',year:2020});
assert.equal(spanishSameRatings.score,globalScore.score);
assert.ok(spanishSameRatings.confidence>=globalScore.confidence);
const audience=globalScore.contributions.find(x=>x.family==='audience');
const cinephile=globalScore.contributions.find(x=>x.family==='cinephile');
const critics=globalScore.contributions.find(x=>x.family==='critics');
assert.equal(audience.weight,0.5);assert.equal(cinephile.weight,0.25);assert.equal(critics.weight,0.25);
const imdb=audience.sources.find(x=>x.source==='imdb'),tmdb=audience.sources.find(x=>x.source==='tmdb');
assert.equal(imdb.baseWeight,1);assert.equal(tmdb.baseWeight,0.9);
assert.ok(imdb.reliability>0&&imdb.reliability<=1);assert.ok(tmdb.reliability>0&&tmdb.reliability<=1);
const hugeImdb=baseRatings.map(r=>r.source==='imdb'?{...r,votes:5000000}:r),tinyImdb=baseRatings.map(r=>r.source==='imdb'?{...r,votes:500}:r);
const hugeScore=computePikoScoreV3({ratings:hugeImdb,country:'United States',year:2020}),tinyScore=computePikoScoreV3({ratings:tinyImdb,country:'United States',year:2020});
assert.ok(Math.abs(hugeScore.score-tinyScore.score)<0.25);
const lowVoteRatings=baseRatings.map(r=>r.source==='imdb'?{...r,votes:9000}:r.source==='tmdb'?{...r,votes:900}:r),lowGlobal=computePikoScoreV3({ratings:lowVoteRatings,country:'United States',year:2020}),lowSpain=computePikoScoreV3({ratings:lowVoteRatings,country:'España',year:2020});
assert.ok(Math.abs(lowSpain.score-lowGlobal.score)<0.10);assert.ok(lowSpain.confidence>lowGlobal.confidence);
const weakCritics=[
  {source:'imdb',normalized_rating:7.0,votes:8000,status:'available'},
  {source:'letterboxd',normalized_rating:6.8,votes:17000,status:'available'},
  {source:'metacritic',normalized_rating:5.5,votes:4,status:'available'},
  {source:'rt_critics',normalized_rating:7.5,votes:100,status:'available'},
];
const weakCriticsScore=computePikoScoreV3({ratings:weakCritics,country:'Spain',year:2019});
const criticSources=weakCriticsScore.contributions.find(x=>x.family==='critics').sources;
assert.ok(criticSources.find(x=>x.source==='metacritic').effectiveWeight<criticSources.find(x=>x.source==='rt_critics').effectiveWeight);
const sparse=computePikoScoreV3({ratings:[{source:'imdb',normalized_rating:7.5,votes:12000,status:'available'},{source:'letterboxd',normalized_rating:8.0,votes:3000,status:'available'}],country:'España',year:2018});
assert.equal(sparse.sourceCount,2);assert.equal(sparse.familyCount,2);assert.ok(sparse.score>0&&sparse.score<=10);
console.log('PikoScore 3.0 self-check OK',{global:globalScore.score,globalConfidence:globalScore.confidence,spainConfidence:spanishSameRatings.confidence,sparse:sparse.score});

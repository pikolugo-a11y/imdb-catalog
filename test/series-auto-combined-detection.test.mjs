import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAutomaticCombinedCoverage,extractEpisodeMarkers,titleSimilarity} from '../lib/series-combined-auto-detection.mjs';

const ref=(episode,name,runtime=8,season=1)=>({season_number:season,episode_number:episode,name,runtime_minutes:runtime});
const plex=(episode,ratingKey,filePath,{season=1,duration=20.3}={})=>({season_number:season,episode_number:episode,rating_key:String(ratingKey),file_paths:[filePath],actual_duration_minutes:duration,fingerprint:`fp-${ratingKey}`});

test('detecta un doble cuando el archivo enumera dos episodios explícitos',()=>{
  const refs=[ref(15,'El arreglo',22,3),ref(16,'El arreglo, segunda parte',22,3)];
  const rows=[plex(15,101176,'Seinfeld - 03x15 - 03x16 - El arreglo.m4v',{season:3,duration:44})];
  const result=buildAutomaticCombinedCoverage({refs,plex:rows});
  assert.equal(result.coverage.get('3-16')?.p.rating_key,'101176');
  assert.equal(result.coverage.get('3-16')?.evidence.method,'explicit_markers');
  assert.equal(result.coverage.get('3-16')?.evidence.confidence,'confirmed');
});

test('acepta combinados explícitos de más de tres episodios',()=>{
  const refs=Array.from({length:5},(_,i)=>ref(2311+i,`Segmento ${i+1}`));
  const rows=[plex(2311,157881,'Shin Chan - 01x2311 - 01x2312 - 01x2313 - 01x2314 - 01x2315.avi',{duration:35})];
  const result=buildAutomaticCombinedCoverage({refs,plex:rows});
  for(const episode of [2312,2313,2314,2315])assert.equal(result.coverage.get(`1-${episode}`)?.p.rating_key,'157881');
  assert.deepEqual(result.sources[0]?.target_episodes,[2312,2313,2314,2315]);
});

test('Shin Chan infiere un triple por tres títulos oficiales, duración y ausencia de archivos intermedios',()=>{
  const refs=[
    ref(1,'Shin-chan se va de compras'),
    ref(2,'Trabajo de madres'),
    ref(3,'Mira qué dibujo'),
    ref(4,'Quiero un triciclo')
  ];
  const rows=[
    plex(1,96483,'Shin Chan - 01x01 - Shin Chan se va de compras _ Trabajo de madres _ Mira qué dibujo.mp4'),
    plex(4,96486,'Shin Chan - 01x04 - Quiero un triciclo.mp4',{duration:8})
  ];
  const result=buildAutomaticCombinedCoverage({refs,plex:rows});
  assert.equal(result.coverage.get('1-2')?.p.rating_key,'96483');
  assert.equal(result.coverage.get('1-3')?.p.rating_key,'96483');
  assert.equal(result.coverage.get('1-2')?.evidence.method,'official_titles');
  assert.ok(result.coverage.get('1-2')?.evidence.durationRatio>.8);
});

test('tolera pequeñas diferencias editoriales entre nombre de archivo y título TMDb',()=>{
  assert.ok(titleSimilarity('Los de la clase de Girasoles somos unos héroes','Los de la clase de los girasoles somos unos héroes')>.9);
  assert.ok(titleSimilarity('Me voy de pícnic (1)','Me voy de pícnic (1ª parte)')>.75);
});

test('no confunde resolución, codecs, títulos numéricos ni marcadores de otra temporada con un combinado',()=>{
  assert.deepEqual(extractEpisodeMarkers('Good Omens 3x01 El final Web Dl 1080x264 E-AC3 5.1.mkv').map(x=>[x.season,x.episode]),[[3,1]]);
  const csi=extractEpisodeMarkers('CSI Las Vegas - 05x19 - 4x4.m4v');
  assert.deepEqual(csi.map(x=>[x.season,x.episode]),[[5,19],[4,4]]);
  const refs=[ref(19,'Título 19',45,5),ref(20,'Título 20',45,5)];
  const result=buildAutomaticCombinedCoverage({refs,plex:[plex(19,89003,'CSI Las Vegas - 05x19 - 4x4.m4v',{season:5,duration:45})]});
  assert.equal(result.coverage.size,0);
});

test('un marcador repetido del mismo episodio no crea un falso doble',()=>{
  const refs=[ref(4,'El reinicio',22,19),ref(5,'Siguiente',22,19)];
  const rows=[plex(4,82095,'19x04 Padre de familia 19x04 El reinicio.avi',{season:19,duration:22})];
  assert.equal(buildAutomaticCombinedCoverage({refs,plex:rows}).coverage.size,0);
});

test('no infiere por títulos si existe un archivo físico exacto para uno de los supuestos segmentos',()=>{
  const refs=[ref(1,'Uno'),ref(2,'Dos'),ref(3,'Tres')];
  const rows=[
    plex(1,1,'Serie - 01x01 - Uno _ Dos _ Tres.mp4'),
    plex(2,2,'Serie - 01x02 - Dos.mp4',{duration:8})
  ];
  assert.equal(buildAutomaticCombinedCoverage({refs,plex:rows}).coverage.size,0);
});

test('no infiere por títulos con evidencia textual débil o duración incompatible',()=>{
  const refs=[ref(1,'Uno correcto'),ref(2,'Dos correcto'),ref(3,'Tres correcto')];
  const badTitles=[plex(1,1,'Serie - 01x01 - Uno correcto _ Otra cosa _ Nada que ver.mp4')];
  assert.equal(buildAutomaticCombinedCoverage({refs,plex:badTitles}).coverage.size,0);
  const badDuration=[plex(1,1,'Serie - 01x01 - Uno correcto _ Dos correcto _ Tres correcto.mp4',{duration:5})];
  assert.equal(buildAutomaticCombinedCoverage({refs,plex:badDuration}).coverage.size,0);
});

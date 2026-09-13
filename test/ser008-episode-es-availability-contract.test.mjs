import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const core=read('../lib/series-episode-availability.js');
const actions=read('../app/calidad/series/actions.js');
const page=read('../app/calidad/series/[ratingKey]/page.js');
const display=read('../lib/process-display.js');

test('SER-008 gobierna correcciones España por episodio',()=>{assert.match(actions,/processCode:'PROC-SER-008'/);assert.match(actions,/setEpisodeSpainAvailabilityAction/);assert.match(actions,/markAllEpisodesSpainAvailableAction/);assert.match(actions,/eventType:'manual_decision'/);assert.match(display,/'PROC-SER-008':\{name:'Corregir disponibilidad España por episodio'\}/)});
test('marcar todo se resuelve en PostgreSQL sin cargar miles de episodios en el navegador',()=>{assert.match(core,/INSERT INTO series_episode_availability/);assert.match(core,/SELECT e\.show_rating_key,e\.season_number,e\.episode_number/);assert.match(core,/ON CONFLICT\(show_rating_key,season_number,episode_number,country_code\) DO UPDATE/);assert.match(page,/Marcar todo como emitido en España/);assert.match(page,/Esto sobrescribirá cualquier “No emitido”/)});
test('la ficha permite corregir Sí No sólo para el episodio abierto',()=>{assert.match(page,/EpisodeEsFields/);assert.match(page,/>Emitido en España</);assert.match(page,/>No emitido en España</);assert.match(page,/SERIES_EPISODE_PAGE_SIZE|episodeData\.pages/)});

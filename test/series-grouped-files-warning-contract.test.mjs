import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const query=fs.readFileSync(new URL('../lib/series-quality-query.js',import.meta.url),'utf8');
const page=fs.readFileSync(new URL('../app/calidad/series/page.js',import.meta.url),'utf8');

test('la advertencia incluye todo episodio activo con dos o más ficheros Plex',()=>{
  assert.match(query,/JOIN plex_files f ON f\.rating_key=p\.rating_key/);
  assert.match(query,/p\.active AND p\.item_type='episode'/);
  assert.match(query,/HAVING count\(\*\)>1/);
  assert.doesNotMatch(query,/copia|copy|file_size_bytes=f2|duration_ms=f2/);
});

test('la vista muestra todos los ficheros agrupados y no recomienda borrar',()=>{
  assert.match(page,/Capítulos agrupados por Plex/);
  assert.match(page,/PikoFilm muestra todos los casos y no decide cuál conservar/);
  assert.match(page,/capítulos con 2\+ archivos/);
  assert.match(page,/f\.file_name/);
  assert.match(page,/f\.size_bytes/);
  assert.match(page,/f\.duration_ms/);
  assert.doesNotMatch(page,/Eliminar duplicado|Borrar archivo|Conservar mejor/);
});

test('la zona está paginada sin ocultar casos',()=>{
  assert.match(page,/pageSize:warning\?50:1/);
  assert.match(page,/WarningPager/);
  assert.match(query,/ORDER BY series_title,season_number,episode_number,episode_rating_key/);
});

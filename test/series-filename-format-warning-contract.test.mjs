import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const query=fs.readFileSync(new URL('../lib/series-quality-query.js',import.meta.url),'utf8');
const page=fs.readFileSync(new URL('../app/calidad/series/page.js',import.meta.url),'utf8');

test('la revisión de nombres agrupa por serie y no baja al detalle de capítulos',()=>{
  assert.match(query,/p\.grandparent_rating_key show_rating_key/);
  assert.match(query,/GROUP BY p\.grandparent_rating_key/);
  assert.match(query,/fs\.bad_files>0/);
  assert.match(page,/series con nombres a revisar/);
  assert.match(page,/filenameWarnings\.rows\.map/);
  assert.doesNotMatch(page,/warning==='filename_format'[\s\S]{0,1800}episode_title/);
});

test('el formato esperado es NOMBRE SERIE - 01x01 - NOMBRE CAPÍTULO.ext',()=>{
  assert.match(query,/substring\(f\.file_path from '\^\.\+ - \[0-9\]\{1,2\}x\[0-9\]\{1,3\} - \.\+\[\.\]\[\^\.\]\+'\) IS DISTINCT FROM f\.file_path/);
  assert.match(page,/NOMBRE SERIE - 01x01 - NOMBRE CAPÍTULO\.ext/);
});

test('la lista informa cuánto trabajo queda por serie sin mostrar nombres de fichero',()=>{
  assert.match(page,/r\.bad_files/);
  assert.match(page,/r\.total_files/);
  assert.doesNotMatch(page,/warning==='filename_format'[\s\S]{0,1800}file_name/);
});

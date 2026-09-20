import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sync=fs.readFileSync(new URL('../lib/series-plex-sync.js',import.meta.url),'utf8');

test('SER-001 pide media física en el inventario masivo de episodios',()=>{
  assert.match(sync,/type=4&includeGuids=0&includeMedia=1/);
  assert.match(sync,/_media_included:Array\.isArray\(e\?\.Media\)/);
  assert.match(sync,/_media:medias\(e\)/);
});

test('los archivos físicos se comparan aunque el episodio no cambie updatedAt',()=>{
  assert.match(sync,/physicalChangedRows=incoming\.filter/);
  assert.match(sync,/physicalFileSignature\(mediaFileRows\(row\._media\)\)/);
  assert.match(sync,/physicalFileSignature\(filesByKey\.get/);
  assert.doesNotMatch(sync,/physicalChangedRows[^;]+plex_updated_at/);
});

test('los cambios físicos masivos actualizan plex_media y plex_files sin llamada individual',()=>{
  assert.match(sync,/bulkDetailed=physicalChangedRows\.map/);
  assert.match(sync,/replaceEpisodeMedia\(\{sql,detailed:bulkDetailed,removedKeys\}\)/);
  assert.match(sync,/DELETE FROM plex_media WHERE rating_key=ANY/);
  assert.match(sync,/DELETE FROM plex_files WHERE rating_key=ANY/);
  assert.match(sync,/INSERT INTO plex_files SELECT \* FROM x/);
});

test('la llamada individual queda sólo como fallback si Plex omite Media',()=>{
  assert.match(sync,/fallbackDetailKeys=diff\.upserts\.filter\(row=>!row\?\._media_included\)/);
  assert.match(sync,/refreshChangedEpisodeMedia\(\{base,token,sql,episodeKeys:fallbackDetailKeys/);
});

test('la ejecución expone cuántos episodios cambiaron físicamente',()=>{
  assert.match(sync,/episodePhysicalChanged:episode\.physicalChanged/);
  assert.match(sync,/episode_files_changed:result\.episodePhysicalChanged/);
});

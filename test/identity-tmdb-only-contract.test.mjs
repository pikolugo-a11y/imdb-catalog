import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8');

test('Identidad permite corregir tipo y habilita TMDb solo según el tipo destino',()=>{
  const ui=read('components/IdentityCorrectionPanel.js');
  assert.match(ui,/name="newType"/);
  assert.match(ui,/canUseTmdbOnly=isSeriesType\(nextType\)/);
  assert.match(ui,/TMDb solo/);
  assert.match(ui,/required=\{tmdbOnly\}/);
  assert.match(ui,/!tmdbOnly&&<label>IMDb/);
});

test('backend valida y persiste la excepción TMDb-only sin exigir coincidencia IMDb',()=>{
  const code=read('lib/identity-correction.js');
  assert.match(code,/TMDb solo únicamente está disponible para series y miniseries/);
  assert.match(code,/targetType=requestedType\|\|before\.type/);
  assert.match(code,/targetType!==before\.type&&!newTmdb/);
  assert.match(code,/validateTmdbIdentity\(newTmdb,targetType,newId\)/);
  assert.match(code,/saveIdentity\(oldId,\{imdbId:newId,tmdbId:newTmdb,type:targetType\}/);
  assert.match(code,/if\(!useTmdbOnly&&!verification\.actualImdbId\)/);
  assert.match(code,/identity_mode:'tmdb_only'/);
  assert.match(code,/imdb:'not_applicable'/);
});

test('refresco de una serie TMDb-only no consulta IMDb y usa enriquecimiento exclusivo TMDb',()=>{
  const refresh=read('lib/identity-refresh.js');
  const enrich=read('lib/enrich-title-tmdb-only.js');
  assert.match(refresh,/tmdbOnly\?await enrichTitleTmdbOnly\(imdbId\):await enrichTitle\(imdbId\)/);
  assert.match(refresh,/if\(!tmdbOnly\)await ensureImdbRating/);
  assert.match(enrich,/\/3\/tv\/\$\{tmdbId\}/);
  assert.match(enrich,/imdb_url=NULL/);
  assert.doesNotMatch(enrich,/imdb_rating|imdb_votes|fa_rating|fa_votes|tmdb_rating|tmdb_votes/);
  assert.match(enrich,/metadata_source='tmdb'/);
  assert.match(enrich,/row\.type==='Miniserie'\?'Miniserie':'Serie'/);
});

test('Identidad re-enlaza Plex por la identidad canónica aunque los IDs no cambien',()=>{
  const action=read('app/calidad/identidad/actions.js');
  const identity=read('lib/identity.js');
  assert.match(action,/relinkCatalogTitleFromPlex\(savedId\)/);
  assert.match(action,/if\(!r\.changed\)\{/);
  assert.match(action,/Identidad sin cambios; Plex enlazado correctamente/);
  assert.match(identity,/const provider=tmdbOnly\?'tmdb':'imdb'/);
  assert.match(identity,/matches\.length!==1/);
  assert.match(identity,/linkCatalogTitleToPlex\(id,matches\[0\]\.rating_key\)/);
});

test('Identidad permite buscar series ya resueltas y corregirlas a TMDb solo',()=>{
  const query=read('lib/identity-page.js');
  const page=read('app/calidad/identidad/page.js');
  assert.match(query,/searching=Boolean\(p\.q\)/);
  assert.match(query,/identity_mode/);
  assert.match(query,/m\.tmdb_id IS NOT NULL/);
  assert.match(page,/identityMode=\{r\.identity_mode\}/);
  assert.match(page,/type=\{r\.type\}/);
  assert.match(page,/IMDb — No aplica/);
});

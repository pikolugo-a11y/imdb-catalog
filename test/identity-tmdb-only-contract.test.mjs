import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8');

test('Identidad ofrece TMDb solo únicamente a series',()=>{
  const ui=read('components/IdentityCorrectionPanel.js');
  assert.match(ui,/isSeries=type==='Serie'\|\|type==='Miniserie'/);
  assert.match(ui,/TMDb solo/);
  assert.match(ui,/required=\{tmdbOnly\}/);
  assert.match(ui,/!tmdbOnly&&<label>IMDb/);
});

test('backend valida y persiste la excepción TMDb-only sin exigir coincidencia IMDb',()=>{
  const code=read('lib/identity-correction.js');
  assert.match(code,/TMDb solo únicamente está disponible para series y miniseries/);
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
  assert.match(enrich,/imdb_rating=NULL,imdb_votes=NULL,imdb_url=NULL/);
  assert.match(enrich,/fa_id=NULL,fa_rating=NULL,fa_votes=NULL,fa_url=NULL/);
  assert.match(enrich,/metadata_source='tmdb'/);
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

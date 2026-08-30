import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../lib/plex-sync.js',import.meta.url),'utf8');

test('Plex IMDb reassignment recalculates the old title lifecycle immediately',()=>{
  assert.match(source,/import \{recomputeLifecycleForIds\} from '\.\/lifecycle'/);
  assert.match(source,/UPDATE plex_catalog_status SET status='missing',rating_key=NULL/);
  assert.match(source,/if\(c\.imdb_before\)oldImdbIds\.push\(c\.imdb_before\)/);
  assert.match(source,/if\(oldImdbIds\.length\)await recomputeLifecycleForIds\(oldImdbIds\)/);
  assert.match(source,/old_lifecycle_recomputed/);
});

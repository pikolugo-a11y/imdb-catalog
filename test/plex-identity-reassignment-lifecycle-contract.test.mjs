import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../lib/plex-sync.js',import.meta.url),'utf8');

test('Plex IMDb reassignment recalculates the old title after sync',()=>{
  assert.match(source,/import \{recomputeLifecycleForIds\} from '\.\/lifecycle'/);
  assert.match(source,/old_imdb_ids/);
  assert.match(source,/await recomputeLifecycleForIds\(identityReview\.old_imdb_ids\)/);
});

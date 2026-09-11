import test from 'node:test';
import assert from 'node:assert/strict';

// Railway Technical ejecuta Node directamente, fuera del runtime de Next.
// Importar el core que usa el worker protege contra dependencias `server-only`
// u otras fronteras exclusivas de Server Components que CI/build no detecta.
test('el runtime PikoQuality usado por Railway se importa bajo Node puro',async()=>{
  const runtime=await import('../lib/pikoquality-c6-runtime.mjs');
  assert.equal(typeof runtime.scorePikoQualityRatingKeys,'function');
});

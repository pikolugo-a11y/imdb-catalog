const kind=String(process.env.PIKOFILM_WORKER_KIND||'lifecycle').trim().toLowerCase();

// The legacy `fast` and `api` batch workers belonged to the pre-Lifecycle
// architecture (PikoScore v2 / direct source jobs). They must never start
// against the current schema. Keep an explicit guard so an old Railway
// variable cannot silently reactivate them.
if(kind==='fast'||kind==='api'){
  throw new Error(`PIKOFILM_WORKER_KIND=${kind} is retired. Use lifecycle.`);
}

const targets={
  lifecycle:'./lifecycle-worker.mjs',
  people:'./people-worker.mjs',
  technical:'./technical-snapshot-worker.mjs',
};

if(!targets[kind])throw new Error(`Worker kind no soportado: ${kind}`);
console.log(`[worker-entrypoint] kind=${kind}`);
if(kind==='lifecycle')await Promise.all([import('./lifecycle-worker.mjs'),import('./people-worker.mjs')]);
else await import(targets[kind]);

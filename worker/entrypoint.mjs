const kind=String(process.env.PIKOFILM_WORKER_KIND||'fast').trim().toLowerCase();
const targets={fast:'./batch-fast.mjs',api:'./batch-api.mjs',lifecycle:'./lifecycle-worker.mjs',people:'./people-worker.mjs'};
console.log(`[worker-entrypoint] kind=${kind}`);
if(kind==='lifecycle')await Promise.all([import('./lifecycle-worker.mjs'),import('./people-worker.mjs')]);
else await import(targets[kind]||targets.fast);

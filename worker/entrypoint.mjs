const kind=String(process.env.PIKOFILM_WORKER_KIND||'fast').trim().toLowerCase();
const targets={fast:'./batch-fast.mjs',api:'./batch-api.mjs',lifecycle:'./lifecycle-worker.mjs'};
const target=targets[kind]||targets.fast;
console.log(`[worker-entrypoint] kind=${kind} target=${target}`);
await import(target);

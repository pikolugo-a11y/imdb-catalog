const kind=String(process.env.PIKOFILM_WORKER_KIND||'fast').trim().toLowerCase();
const target=kind==='api'?'./batch-api.mjs':'./batch-fast.mjs';
console.log(`[worker-entrypoint] kind=${kind} target=${target}`);
await import(target);

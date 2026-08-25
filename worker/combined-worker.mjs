import {spawn} from 'node:child_process';

const children=new Set();
let stopping=false;

function start(name,file){
  const child=spawn(process.execPath,[file],{stdio:'inherit',env:process.env});
  children.add(child);
  child.on('exit',(code,signal)=>{
    children.delete(child);
    if(stopping)return;
    console.error(`[combined-worker] ${name} terminó inesperadamente code=${code} signal=${signal||'—'}`);
    process.exitCode=code||1;
    shutdown('SIGTERM');
  });
  return child;
}

function shutdown(signal='SIGTERM'){
  if(stopping)return;
  stopping=true;
  console.log(`[combined-worker] apagando (${signal})`);
  for(const child of children){
    try{child.kill(signal)}catch{}
  }
  const timer=setTimeout(()=>{
    for(const child of children){try{child.kill('SIGKILL')}catch{}}
  },15000);
  timer.unref();
}

process.on('SIGTERM',()=>shutdown('SIGTERM'));
process.on('SIGINT',()=>shutdown('SIGINT'));

console.log('[combined-worker] iniciando Lifecycle + Personas');
start('lifecycle','worker/lifecycle-worker.mjs');
start('people','worker/people-worker.mjs');

while(children.size){
  await new Promise(resolve=>setTimeout(resolve,1000));
}
process.exit(process.exitCode||0);

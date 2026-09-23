import http from 'node:http';
import {verifyWorkerWakeAuth} from './worker-wake-auth.mjs';

export function startWakeServer({pool,databaseUrl=process.env.DATABASE_URL||process.env.NEON_DATABASE_URL,onWake,port=Number(process.env.PORT)||8080}={}){
  if(!pool)throw new Error('pool obligatorio');
  if(typeof onWake!=='function')throw new Error('onWake obligatorio');
  let busy=false,pending=false,lastWakeAt=null,lastDrainAt=null,wakeCount=0,server=null,stopping=false;

  const drain=async(reason)=>{
    pending=true;lastWakeAt=new Date().toISOString();wakeCount++;
    if(busy||stopping)return;
    busy=true;
    try{
      while(pending&&!stopping){
        pending=false;
        console.log(JSON.stringify({type:'worker_drain_started',pool,reason,wake_count:wakeCount}));
        await onWake({reason});
        lastDrainAt=new Date().toISOString();
        console.log(JSON.stringify({type:'worker_drain_idle',pool,last_drain_at:lastDrainAt}));
      }
    }catch(error){
      console.error(JSON.stringify({type:'worker_drain_error',pool,error:String(error?.stack||error)}));
    }finally{busy=false}
  };

  server=http.createServer((req,res)=>{
    const url=new URL(req.url||'/',`http://127.0.0.1:${port}`);
    if(req.method==='GET'&&url.pathname==='/health'){
      res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
      res.end(JSON.stringify({ok:true,pool,busy,pending,lastWakeAt,lastDrainAt,wakeCount}));
      return;
    }
    if(req.method==='POST'&&url.pathname==='/wake'){
      const ok=verifyWorkerWakeAuth(databaseUrl,pool,{timestamp:req.headers['x-pikofilm-wake-ts'],signature:req.headers['x-pikofilm-wake-signature']});
      if(!ok){res.writeHead(401,{'content-type':'application/json'});res.end(JSON.stringify({ok:false,error:'unauthorized'}));return}
      let raw='';req.on('data',chunk=>{if(raw.length<2048)raw+=chunk});req.on('end',()=>{
        let reason='wake';try{reason=JSON.parse(raw||'{}')?.reason||'wake'}catch{}
        console.log(JSON.stringify({type:'worker_wake_received',pool,reason}));
        drain(String(reason).slice(0,120)).catch(()=>{});
        res.writeHead(202,{'content-type':'application/json','cache-control':'no-store'});
        res.end(JSON.stringify({ok:true,pool,busy:true}));
      });
      return;
    }
    res.writeHead(404,{'content-type':'application/json'});res.end(JSON.stringify({ok:false,error:'not_found'}));
  });
  server.listen(port,'0.0.0.0',()=>{
    console.log(JSON.stringify({type:'worker_wake_server_ready',pool,port}));
    drain('startup_recovery').catch(()=>{});
  });
  return{
    close:()=>{stopping=true;server?.close()},
    state:()=>({pool,busy,pending,lastWakeAt,lastDrainAt,wakeCount})
  };
}

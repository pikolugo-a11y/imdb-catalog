import {getDatabaseStorage} from '@/lib/database-storage';

const fmtBytes=value=>{const n=Number(value||0);if(n<1024)return`${n} B`;if(n<1024**2)return`${(n/1024).toFixed(1).replace('.',',')} KB`;if(n<1024**3)return`${(n/1024**2).toFixed(1).replace('.',',')} MB`;return`${(n/1024**3).toFixed(2).replace('.',',')} GB`};
const fmtRows=value=>Number(value||0).toLocaleString('es-ES');
const delta=(rows,key)=>{const usable=(rows||[]).filter(x=>x?.metrics?.[key]!=null).map(x=>Number(x.metrics[key]));if(usable.length<2)return null;return usable.at(-1)-usable[0]};

export default async function DatabaseStoragePanel({history=[]}){
  const storage=await getDatabaseStorage();
  const totalDelta=delta(history,'db_total_bytes'),opsDelta=delta(history,'db_operations_bytes');
  return <section className="dashboard-panel control-panel" style={{marginTop:18}}>
    <div className="section-head home-section-head"><div><div className="eyebrow">Control</div><h2>Base de datos</h2><p>Tamaño real de PostgreSQL y crecimiento de la observabilidad.</p></div></div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:10,marginBottom:14}}>
      <article style={{padding:'14px 16px',border:'1px solid rgba(255,255,255,.06)',borderRadius:12,background:'#11161b'}}><span style={{display:'block',fontSize:10,color:'var(--muted)'}}>Base completa</span><b style={{display:'block',fontSize:24,marginTop:4}}>{fmtBytes(storage.totalBytes)}</b><small style={{color:'var(--muted)'}}>{totalDelta==null?'Histórico desde hoy':`${totalDelta>=0?'+':''}${fmtBytes(totalDelta)} en el periodo`}</small></article>
      <article style={{padding:'14px 16px',border:'1px solid rgba(255,255,255,.06)',borderRadius:12,background:'#11161b'}}><span style={{display:'block',fontSize:10,color:'var(--muted)'}}>Operaciones</span><b style={{display:'block',fontSize:24,marginTop:4}}>{fmtBytes(storage.operationsBytes)}</b><small style={{color:'var(--muted)'}}>{opsDelta==null?'Runs + eventos + errores':`${opsDelta>=0?'+':''}${fmtBytes(opsDelta)} en el periodo`}</small></article>
      <article style={{padding:'14px 16px',border:'1px solid rgba(255,255,255,.06)',borderRadius:12,background:'#11161b'}}><span style={{display:'block',fontSize:10,color:'var(--muted)'}}>Mayor tabla</span><b style={{display:'block',fontSize:18,marginTop:7,overflow:'hidden',textOverflow:'ellipsis'}}>{storage.topTables[0]?.tableName||'—'}</b><small style={{color:'var(--muted)'}}>{storage.topTables[0]?`${fmtBytes(storage.topTables[0].totalBytes)} · ~${fmtRows(storage.topTables[0].approxRows)} filas`:'Sin datos'}</small></article>
    </div>
    <details><summary style={{cursor:'pointer',fontSize:11,fontWeight:800}}>Ver tablas más grandes</summary><div style={{display:'grid',gap:6,marginTop:10}}>{storage.topTables.map(t=><div key={t.tableName} style={{display:'grid',gridTemplateColumns:'minmax(150px,1.4fr) .7fr .7fr',gap:10,padding:'8px 10px',borderBottom:'1px solid rgba(255,255,255,.05)',fontSize:10}}><code>{t.tableName}</code><span>{fmtBytes(t.totalBytes)}</span><span style={{color:'var(--muted)',textAlign:'right'}}>~{fmtRows(t.approxRows)} filas</span></div>)}</div></details>
    <small style={{display:'block',marginTop:10,color:'var(--muted)'}}>Actualización de tamaño cacheada durante 5 minutos.</small>
  </section>;
}

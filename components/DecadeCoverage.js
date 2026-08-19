export default function DecadeCoverage({rows=[]}){
  const pct=(a,b)=>b?Math.round(Number(a||0)/Number(b)*1000)/10:0;
  const clean=rows.filter(x=>Number(x.total)>0).map(x=>({...x,total:Number(x.total||0),owned:Number(x.owned||0)}));
  const max=Math.max(...clean.map(x=>x.total),1);
  const total=clean.reduce((a,x)=>a+x.total,0),owned=clean.reduce((a,x)=>a+x.owned,0);
  const best=clean.reduce((a,x)=>!a||pct(x.owned,x.total)>pct(a.owned,a.total)?x:a,null);
  const pending=clean.reduce((a,x)=>!a||(x.total-x.owned)>(a.total-a.owned)?x:a,null);
  return <section className="dashboard-panel decade-v2"><div className="section-head"><div><div className="eyebrow">Cobertura histórica</div><h2>Evolución del catálogo por décadas</h2><p>Volumen del catálogo y proporción disponible actualmente en Plex.</p></div></div>
    <div className="decade-summary"><div><span>Cobertura global</span><b>{pct(owned,total)}%</b><small>{owned.toLocaleString('es-ES')} de {total.toLocaleString('es-ES')}</small></div><div><span>Mejor cobertura</span><b>{best?`${best.bucket}s`:'—'}</b><small>{best?`${pct(best.owned,best.total)}% en Plex`:'Sin datos'}</small></div><div><span>Más pendientes</span><b>{pending?`${pending.bucket}s`:'—'}</b><small>{pending?`${(pending.total-pending.owned).toLocaleString('es-ES')} títulos`:'Sin datos'}</small></div></div>
    <div className="decade-scroll"><div className="decade-bars-v2">{clean.map(x=>{const coverage=pct(x.owned,x.total),pendingCount=x.total-x.owned;return <div className="decade-col-v2" key={x.bucket} title={`${x.bucket}s · ${x.total.toLocaleString('es-ES')} títulos · ${x.owned.toLocaleString('es-ES')} en Plex · ${pendingCount.toLocaleString('es-ES')} pendientes · ${coverage}% cobertura`}><div className="decade-value">{x.total.toLocaleString('es-ES')}</div><div className="decade-track" style={{height:`${Math.max(14,Math.round(x.total/max*100))}%`}}><i style={{height:`${coverage}%`}}/></div><b>{x.bucket}</b><small>{coverage}%</small></div>})}</div></div>
    <div className="decade-legend"><span><i className="legend-owned"/>En Plex</span><span><i className="legend-pending"/>Pendiente</span><span>Altura = títulos totales</span></div>
  </section>
}
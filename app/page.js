import Link from 'next/link';
import Segmented from '@/components/Segmented';
import StatisticsExplorer from '@/components/home/StatisticsExplorer';
import HistoryChart from '@/components/home/HistoryChart';
import {getDashboardV2} from '@/lib/dashboard-v2';
import {nf,pct,statusLabel} from '@/lib/home-format';
import {mostCovered,leastCovered,bestScore} from '@/lib/home-statistics';

export const dynamic='force-dynamic';

function Pulse({d}){
  const integrityHelp=d.pulse.integrity_anomalies===0?'Sin huérfanos, estados desconocidos ni incompatibilidades estructurales':`${nf(d.pulse.integrity_anomalies)} anomalías estructurales`;
  return <section className="home-command"><div className="command-copy"><div className="eyebrow">Centro de control</div><h1>PikoFilm</h1><p>Estado global, evolución y estadísticas de tu filmoteca. El detalle operativo vive en cada módulo.</p><div className="command-status"><span className="live-dot"/> Datos canónicos del catálogo y Calidad</div></div><div className="pulse-wrap"><div className="pulse-ring" style={{'--pulse':Math.round(d.pulse.score)}}><div><strong>{pct(d.pulse.score).replace(' %','')}</strong><span>{statusLabel(d.pulse.score)}</span><small>salud del sistema</small></div></div><div className="pulse-legend"><div><span>Calidad</span><b>{pct(d.pulse.quality)}</b><small>avance canónico del flujo de Calidad</small></div><div title={integrityHelp}><span>Integridad</span><b>{pct(d.pulse.integrity)}</b><small>{integrityHelp}</small></div></div></div></section>;
}

function Universe({d}){
  const k=d.kpi,owned=Math.max(0,Number(k.coverage||0)),missing=Math.max(0,100-owned);
  return <section className="dashboard-panel universe-panel"><div className="section-head home-section-head"><div><div className="eyebrow">Ahora</div><h2>Tu universo PikoFilm</h2><p>Foto descriptiva del catálogo objetivo y su presencia actual en Plex.</p></div></div><Link href="/catalogo" className="universe-total-v4"><span>Catálogo objetivo</span><strong>{nf(k.catalog_total)}</strong><small>{nf(k.movies)} películas · {nf(k.series)} series/miniseries</small></Link><div className="universe-progress" aria-label={`${pct(owned)} en Plex y ${pct(missing)} pendientes`}><Link href="/catalogo?status=in_plex" style={{width:`${owned}%`}} className="owned"/><Link href="/catalogo?status=missing" style={{width:`${missing}%`}} className="missing"/></div><div className="universe-legend-v4"><Link href="/catalogo?status=in_plex"><span>En Plex</span><b>{nf(k.in_plex)}</b><small>{pct(owned)}</small></Link><Link href="/catalogo?status=missing"><span>Pendientes</span><b>{nf(k.missing)}</b><small>{pct(missing)}</small></Link></div></section>;
}

function Radar({d}){
  const stages=(d.quality?.stages||[]).filter(s=>Number(s.count||0)>0).map(s=>({type:['recovery','identity','validation'].includes(s.id)?'critical':'attention',label:s.id==='data'?'Títulos con datos o PikoScore pendientes':s.id==='movies'?'Películas que requieren revisión':s.id==='series'?'Series que requieren revisión':s.id==='pikoquality'?'Archivos pendientes de PikoQuality':s.label,count:Number(s.count||0),href:s.href,severity:s.id==='recovery'?100:['identity','validation'].includes(s.id)?90:70}));
  const opportunities=[Number(d.sagas?.one||0)>0&&{type:'opportunity',label:'Sagas a una película de completarse',count:Number(d.sagas.one),href:'/sagas?state=one',severity:40}].filter(Boolean);
  const items=[...stages,...opportunities].sort((a,b)=>b.severity-a.severity||b.count-a.count).slice(0,5);
  const groups={critical:items.filter(x=>x.type==='critical'),attention:items.filter(x=>x.type==='attention'),opportunity:items.filter(x=>x.type==='opportunity')};
  return <section className="dashboard-panel radar-panel"><div className="section-head home-section-head"><div><div className="eyebrow">Prioridades</div><h2>Radar PikoFilm</h2><p>Lo más relevante ahora, con los mismos contadores que sus pantallas de detalle.</p></div><Link href="/calidad">Abrir Calidad →</Link></div>{items.length===0?<div className="all-good"><b>✓ Sin asuntos relevantes</b><span>Las áreas canónicas no requieren atención.</span></div>:<div className="radar-columns">{[['critical','Crítico'],['attention','Atención'],['opportunity','Oportunidades']].map(([id,title])=><div key={id} className={`radar-group ${id}`}><span>{title}</span>{groups[id].length?groups[id].map(x=><Link key={`${x.href}-${x.label}`} href={x.href}><b>{nf(x.count)}</b><em>{x.label}</em></Link>):<small>Sin elementos en este nivel</small>}</div>)}</div>}</section>;
}

function QualityMap({d}){
  const stages=(d.quality?.stages||[]).filter(s=>s.id!=='recovery');
  return <section className="dashboard-panel quality-map-panel"><div className="section-head home-section-head"><div><div className="eyebrow">Calidad</div><h2>Mapa de Calidad</h2><p>Espejo de los agregados canónicos de cada subpágina.</p></div><Link href="/calidad">Ver detalle →</Link></div><div className="quality-map">{stages.map(s=>{const healthy=Number(s.count||0)===0;return <Link key={s.id} href={s.href} className={healthy?'ok':'needs'}><span>{s.label}</span><strong>{healthy?'✓':nf(s.count)}</strong><small>{healthy?'Completa / sin casos activos':'requieren acción'}</small></Link>})}</div></section>;
}

function History({d,period}){
  const rows=(d.history||[]).filter(x=>Number(x.metrics?.schema_version)===Number(d.snapshotSchemaVersion)).map(x=>({date:new Date(x.snapshot_date).toLocaleDateString('es-ES',{day:'2-digit',month:'short'}),catalog:x.metrics?.catalog_total==null?null:Number(x.metrics.catalog_total),plex:x.metrics?.in_plex==null?null:Number(x.metrics.in_plex),missing:x.metrics?.missing==null?null:Number(x.metrics.missing),quality:x.metrics?.quality_progress==null?(x.metrics?.pulse_quality==null?null:Number(x.metrics.pulse_quality)):Number(x.metrics.quality_progress)}));
  return <section className="dashboard-panel history-panel"><div className="section-head home-section-head"><div><div className="eyebrow">Evolución</div><h2>Historia de PikoFilm</h2><p>Sólo snapshots comparables del esquema actual. Ausencia de histórico nunca se interpreta como cero.</p></div><Segmented value={period} items={['7','30','90','365','3650'].map(v=>({value:v,label:v==='3650'?'Todo':v==='365'?'1 año':`${v} días`,href:`/?period=${v}`}))}/></div><HistoryChart rows={rows}/></section>;
}

function Highlights({d}){
  const best=mostCovered(d.genres||[],'genre'),gap=leastCovered(d.genres||[],'genre'),bestS=bestScore(d.genres||[],'genre');
  return <section className="dashboard-panel highlights-panel"><div className="section-head home-section-head"><div><div className="eyebrow">Síntesis</div><h2>Lo que más destaca</h2><p>Sólo segmentos con muestra suficiente para evitar conclusiones engañosas.</p></div></div><div className="highlights-grid"><article className="strength"><span>Fortaleza</span><b>{best?.label||'—'}</b><small>{best?`${pct(best.coverage)} · ${nf(best.owned)}/${nf(best.total)}`:'Sin muestra suficiente'}</small></article><article className="strength"><span>Mejor PikoScore</span><b>{bestS?.label||'—'}</b><small>{bestS?`${bestS.avg_score.toLocaleString('es-ES',{minimumFractionDigits:1,maximumFractionDigits:1})} de media`:'Sin muestra suficiente'}</small></article><article className="gap"><span>Mayor hueco</span><b>{gap?.label||'—'}</b><small>{gap?`${pct(gap.coverage)} · ${nf(gap.owned)}/${nf(gap.total)}`:'Sin muestra suficiente'}</small></article><article className="gap"><span>Victorias rápidas</span><b>{nf(d.sagas?.one)}</b><small>sagas a exactamente una película</small></article></div></section>;
}

export default async function Home({searchParams}){
  const p=await searchParams,period=p.period||'30',d=await getDashboardV2(period);
  return <div className="home-v3"><Pulse d={d}/><div className="home-now"><Universe d={d}/><Radar d={d}/></div><QualityMap d={d}/><History d={d} period={period}/><Highlights d={d}/><StatisticsExplorer data={{kpi:d.kpi,genres:d.genres,decades:d.decades,countries:d.countries,scoreBands:d.scoreBands,sagas:d.sagas,profile:d.profile,balance:d.balance}}/><p className="footnote">Última sincronización Plex: {d.kpi.last_plex_sync?new Date(d.kpi.last_plex_sync).toLocaleString('es-ES'):'sin registrar'}.</p></div>;
}

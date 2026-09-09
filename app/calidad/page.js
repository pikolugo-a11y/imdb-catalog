import Link from '@/components/NoPrefetchLink';
import {getQualityHomeSnapshot} from '@/lib/quality-home';
import './calidad-v4.css';
export const dynamic='force-dynamic';

const nf=n=>Number(n||0).toLocaleString('es-ES');
const pct=n=>`${Number(n||0).toLocaleString('es-ES',{maximumFractionDigits:1})}%`;
const statusText=s=>s?.key==='healthy'?'Al día':s?.key==='pending'?'Seguimiento':s?.key==='blocked'?'Atención':'Atención';

function AreaRow({stage}){return <div className="qv4-area-row"><span>{stage.label}</span><b className={stage.status.key}>{stage.count?`${nf(stage.count)} · ${statusText(stage.status)}`:'Al día'}</b></div>}

function SpecializedCard({stage,kind,icon,description}){return <Link href={stage.href} className={`qv4-surface ${kind}`}><div className="qv4-surface-head"><span className="qv4-surface-icon">{icon}</span><span className="qv4-surface-badge">Página especializada</span></div><h3>{stage.label}</h3><p>{description}</p><div className="qv4-area-list"><AreaRow stage={stage}/><div className="qv4-area-row"><span>{kind==='series'?'Plex · TMDb · España':'Archivo físico · PikoQuality'}</span><b>{kind==='series'?'Detalle por serie':'Flujo físico'}</b></div></div><div className="qv4-surface-cta"><span>{stage.cta}</span><b>→</b></div></Link>}

export default async function Calidad(){
  const home=await getQualityHomeSnapshot();
  const byId=Object.fromEntries(home.stages.map(stage=>[stage.id,stage]));
  const attention=home.priorityItems.slice(0,5);
  const tracking=home.stages.filter(s=>s.status.key==='pending').slice(0,4);
  return <div className="qv4-page">
    <header className="qv4-hero"><div><div className="qv4-eyebrow">Calidad V4 · salud funcional</div><h1>Calidad</h1><p>Una vista para saber qué necesita tu decisión, qué está resolviendo PikoFilm y qué está al día. El detalle técnico sigue en Operaciones.</p></div><div className={`qv4-global qv4-${home.globalStatus.key}`}>{home.globalStatus.label}</div></header>

    <section className="qv4-summary" aria-label="Resumen de calidad"><div className="qv4-summary-card attention"><span>Requieren atención</span><strong>{nf(home.attentionCount)}</strong><small>decisiones o anomalías funcionales</small></div><div className="qv4-summary-card tracking"><span>En seguimiento automático</span><strong>{nf(home.trackingCount)}</strong><small>PikoFilm está trabajando o esperando su próxima revisión</small></div><div className="qv4-summary-card healthy"><span>Lifecycle completo</span><strong>{nf(home.complete)}</strong><small>{pct(home.progressPct)} de los títulos activos</small></div></section>

    <div className="qv4-section-title"><div><h2>Tu espacio de trabajo</h2><p>Especialización sólo donde aporta valor; el resto comparte un Centro de Calidad común.</p></div><Link href="/admin">Ver ejecución técnica →</Link></div>

    <section className="qv4-hybrid-grid">
      <Link href="/calidad/centro" className="qv4-surface center"><div className="qv4-surface-head"><span className="qv4-surface-icon">▦</span><span className="qv4-surface-badge">Centro común</span></div><h3>Centro de Calidad</h3><p>Identidad, validación, datos, Personas, PikoQuality e integridad Lifecycle reunidos bajo el mismo patrón.</p><div className="qv4-area-list">{home.centerStages.map(stage=><AreaRow key={stage.id} stage={stage}/>)}</div><div className="qv4-surface-cta"><span>Abrir Centro de Calidad</span><b>→</b></div></Link>
      <SpecializedCard stage={byId.movies} kind="movies" icon="▤" description="Validación del archivo actual, incidencias físicas y deuda histórica sin mezclarla con el resto de Calidad."/>
      <SpecializedCard stage={byId.series} kind="series" icon="▣" description="La superficie más viva: episodios, temporadas, cambios de Plex, referencia TMDb y disponibilidad España."/>
    </section>

    <section className="qv4-priority"><div className="qv4-priority-copy"><b>{attention.length?'Lo que merece tu atención ahora':'No hay decisiones prioritarias'}</b><span>{attention.length?'Sólo aparecen bloqueos o revisiones humanas reales.':'El mantenimiento pendiente continúa en segundo plano y no se convierte en una tarea para ti.'}</span></div><div className="qv4-priority-items">{attention.map(item=><Link key={`${item.id}-${item.href}`} href={item.href}>{item.label} · {nf(item.count)}</Link>)}{!attention.length&&tracking.map(stage=><Link className="tracking" key={stage.id} href={stage.href}>{stage.label} · {nf(stage.count)}</Link>)}</div></section>

    <section className="qv4-lifecycle"><div className="qv4-lifecycle-main"><div className="qv4-lifecycle-top"><span>Lifecycle global</span><b>{nf(home.complete)} de {nf(home.activeTotal)} · {pct(home.progressPct)}</b></div><progress max="100" value={home.progressPct}/></div><Link href="/calidad/centro">Ver integridad y áreas comunes →</Link></section>
  </div>;
}

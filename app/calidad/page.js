import Link from 'next/link';
import {getQualityHomeSnapshot} from '@/lib/quality-home';
import './quality-dashboard.css';

export const dynamic='force-dynamic';

const nf=n=>Number(n||0).toLocaleString('es-ES');
const pct=n=>`${Number(n||0).toLocaleString('es-ES',{minimumFractionDigits:1,maximumFractionDigits:1})}%`;

function StatusPill({status}){
  return <span className={`qh-status qh-${status.key}`}><b aria-hidden="true">{status.icon}</b>{status.label}</span>;
}

function StageCard({stage}){
  return <Link href={stage.href} className={`qh-stage qh-stage-${stage.id}`} aria-label={`${stage.label}: ${stage.count} pendientes. ${stage.status.label}`}>
    <div className="qh-stage-top"><span>{stage.label}</span><strong>{nf(stage.count)}</strong></div>
    <StatusPill status={stage.status}/>
    <p>{stage.count===0?'Sin casos pendientes en esta etapa.':stage.description}</p>
    <em>{stage.cta} →</em>
  </Link>;
}

function Summary({home}){
  return <section className="qh-summary" aria-label="Estado general de Calidad">
    <div className="qh-progress-block">
      <div className="qh-summary-label">Lifecycle completado</div>
      <div className="qh-progress-value"><strong>{pct(home.progressPct)}</strong><span>{nf(home.complete)} de {nf(home.activeTotal)}</span></div>
      <progress max="100" value={home.progressPct} aria-label={`Lifecycle completado al ${pct(home.progressPct)}`}/>
    </div>
    <div className="qh-summary-stat"><span>Estado</span><StatusPill status={home.globalStatus}/></div>
    <div className="qh-summary-stat"><span>Pendientes</span><strong>{nf(home.pending)}</strong></div>
    <div className="qh-summary-stat"><span>Intervención</span><strong>{nf(home.intervention)}</strong></div>
    <Link href="/calidad/sin-estado" className={`qh-summary-stat qh-integrity ${home.integrity.ok?'ok':'bad'}`}>
      <span>Integridad Lifecycle</span>
      <strong>{home.integrity.ok?'✓':`${nf(home.integrity.total)} anomalías`}</strong>
    </Link>
  </section>;
}

export default async function Calidad(){
  const home=await getQualityHomeSnapshot();
  const byId=Object.fromEntries(home.stages.map(stage=>[stage.id,stage]));
  return <main className="quality-home qh-page">
    <header className="qh-head">
      <div><div className="eyebrow">Centro de control · Lifecycle</div><h1>Calidad</h1><p>Salud, integridad y avance del catálogo audiovisual.</p></div>
      <span className="qh-materialized">{nf(home.materialized)} estados materializados</span>
    </header>

    <Summary home={home}/>

    {home.priorityItems.length>0&&<section className="qh-priority" aria-labelledby="qh-priority-title">
      <div className="qh-section-head"><div><div className="eyebrow">Intervención</div><h2 id="qh-priority-title">Atención prioritaria</h2></div><span>{home.priorityItems.length} {home.priorityItems.length===1?'área':'áreas'}</span></div>
      <div className="qh-priority-list">{home.priorityItems.map(item=><Link key={item.id} href={item.href} className={`qh-priority-item qh-${item.status.key}`}><StatusPill status={item.status}/><strong>{item.label}</strong><span>{nf(item.count)} {item.count===1?'caso':'casos'}</span><em>Abrir →</em></Link>)}</div>
    </section>}

    <section className="qh-flow" aria-labelledby="qh-flow-title">
      <div className="qh-section-head"><div><div className="eyebrow">Secuencia real</div><h2 id="qh-flow-title">Lifecycle</h2></div><span>{nf(home.pending)} pendientes</span></div>
      <div className="qh-flow-main" aria-label="Etapas previas">
        <StageCard stage={byId.recovery}/><span className="qh-arrow" aria-hidden="true">→</span>
        <StageCard stage={byId.identity}/><span className="qh-arrow" aria-hidden="true">→</span>
        <StageCard stage={byId.validation}/><span className="qh-arrow" aria-hidden="true">→</span>
        <StageCard stage={byId.data}/>
      </div>
      <div className="qh-branch-label"><span>Rama física</span></div>
      <div className="qh-flow-branch">
        <StageCard stage={byId.movies}/>
        <StageCard stage={byId.series}/>
      </div>
      <div className="qh-flow-final"><span className="qh-arrow qh-arrow-down" aria-hidden="true">↓</span><StageCard stage={byId.pikoquality}/></div>
    </section>

    <footer className="qh-foot"><span>{home.excluded>0?`${nf(home.excluded)} títulos excluidos no computan en el progreso activo.`:'El progreso se calcula sobre el catálogo activo.'}</span><Link href="/catalogo">Ver Catálogo →</Link></footer>
  </main>;
}

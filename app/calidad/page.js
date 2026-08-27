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
  return <Link href={stage.href} className={`qh-stage qh-stage-${stage.id}`} aria-label={`${stage.label}: ${stage.count}. ${stage.status.label}`}>
    <div className="qh-stage-top"><span>{stage.label}</span><strong>{nf(stage.count)}</strong></div>
    <StatusPill status={stage.status}/>
    <p>{stage.count===0?'Sin casos que requieran acción en esta área.':stage.description}</p>
    <em>{stage.cta} →</em>
  </Link>;
}

function Summary({home}){
  return <section className="qh-summary" aria-label="Estado general de Calidad">
    <div className="qh-progress-block">
      <div className="qh-summary-label">Lifecycle completado</div>
      <div className="qh-progress-value"><strong>{pct(home.progressPct)}</strong><span>{nf(home.complete)} de {nf(home.activeTotal)}</span></div>
      <progress max="100" value={home.progressPct} aria-label={`Lifecycle completado al ${pct(home.progressPct)}`}/>
      {home.excluded>0&&<small className="qh-progress-note">{nf(home.excluded)} excluidos no computan en el progreso activo</small>}
    </div>
    <div className="qh-summary-stat"><span>Estado</span><StatusPill status={home.globalStatus}/></div>
    <div className="qh-summary-stat"><span>Áreas con trabajo</span><strong>{nf(home.areasPending)}</strong><small>de 7 controles operativos</small></div>
    <Link href="/calidad/sin-estado" className={`qh-summary-stat qh-integrity ${home.integrity.ok?'ok':'bad'}`}>
      <span>Integridad Lifecycle</span>
      <strong>{home.integrity.ok?'✓':`${nf(home.integrity.total)} anomalías`}</strong>
      <small>{nf(home.materialized)} estados materializados</small>
    </Link>
  </section>;
}

export default async function Calidad(){
  const home=await getQualityHomeSnapshot();
  const byId=Object.fromEntries(home.stages.map(stage=>[stage.id,stage]));
  return <div className="quality-home qh-page">
    <header className="qh-head">
      <div><div className="eyebrow">Centro de control · Lifecycle</div><h1>Calidad</h1><p>Estado real de cada control de calidad y acceso directo a lo que requiere revisión.</p></div>
    </header>

    <Summary home={home}/>

    <section className="qh-flow" aria-labelledby="qh-flow-title">
      <div className="qh-section-head"><div><div className="eyebrow">Secuencia de control</div><h2 id="qh-flow-title">Lifecycle</h2></div><span>Los números coinciden con cada pantalla</span></div>
      <div className="qh-flow-main" aria-label="Etapas previas">
        <StageCard stage={byId.recovery}/><span className="qh-arrow" aria-hidden="true">→</span>
        <StageCard stage={byId.identity}/><span className="qh-arrow" aria-hidden="true">→</span>
        <StageCard stage={byId.validation}/><span className="qh-arrow" aria-hidden="true">→</span>
        <StageCard stage={byId.data}/>
      </div>
      <div className="qh-branch-label"><span>Biblioteca física y calidad</span></div>
      <div className="qh-flow-branch" aria-label="Control de biblioteca física y calidad">
        <StageCard stage={byId.movies}/>
        <StageCard stage={byId.series}/>
        <StageCard stage={byId.pikoquality}/>
      </div>
    </section>

    <footer className="qh-foot"><span>El porcentaje superior refleja Lifecycle; cada tarjeta usa el contador operativo real de su módulo.</span><Link href="/catalogo">Ver Catálogo →</Link></footer>
  </div>;
}

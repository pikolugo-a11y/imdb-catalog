import Link from '@/components/NoPrefetchLink';
import {db} from '@/lib/db';
import {getC6BatchState} from '@/lib/pikoquality-c6-batch';
import {getTechnicalDashboard} from '@/lib/plex-technical-control.mjs';
import TechnicalControlActions from './TechnicalControlActions';
import C6ControlPanel from './C6ControlPanel';
import styles from './pikoquality-ops.module.css';

export const dynamic='force-dynamic';

const nf=n=>Number(n||0).toLocaleString('es-ES');
const pct=(n,d)=>d?Math.round(Number(n||0)*1000/Number(d))/10:0;
const dt=v=>v?new Date(v).toLocaleString('es-ES',{dateStyle:'short',timeStyle:'short'}):'—';
const statusLabel={queued:'En cola',running:'En curso',succeeded:'Correcto',failed:'Fallido',partial:'Parcial',cancelled:'Cancelado'};
const resultLabel={updated:'Actualizado',no_change:'Sin cambios',pending:'Pendiente',blocked:'Bloqueado'};

export default async function OperationsPikoQuality(){
  const sql=db();
  const [technical,c6]=await Promise.all([getTechnicalDashboard(sql),getC6BatchState(sql)]);
  const physical=Number(technical.total?.total||0);
  const ready=Number(technical.total?.ready||0);
  const missing=Number(technical.total?.missing||0);
  const pendingState=Number(technical.total?.pending||0);
  const errors=Number(technical.total?.error||0);
  const capturePending=Math.max(0,physical-ready);
  const readyPct=pct(ready,physical);
  const c6Current=Number(c6.current||0);
  const c6Total=Number(c6.total||0);
  const c6Pending=Number(c6.pending||0);
  const active=technical.activeRun||null;
  const last=technical.lastRun||null;
  const control=technical.control||{};
  const healthyCapture=capturePending===0;
  const healthyC6=c6Pending===0;
  const overallHealthy=healthyCapture&&healthyC6&&errors===0;

  return <div className="ops-shell">
    <header className="ops-hero"><div><div className="ops-kicker">Operaciones · PikoQuality</div><h1>Estado técnico y mantenimiento</h1><p>Una sola cadena de verdad: biblioteca física → captura técnica → C6. Las ejecuciones, errores e historial se consultan en el Centro de Operaciones.</p></div><Link className="ops-refresh" href="/admin">← Centro de Operaciones</Link></header>

    <section className={`ops-health ${overallHealthy?'healthy':'attention'}`}>
      <div><span className="ops-label">Estado actual</span><h2>{overallHealthy?'PikoQuality técnicamente al día':'Hay trabajo técnico pendiente'}</h2><p>{nf(physical)} archivos físicos activos · {nf(ready)} con captura válida · {nf(c6Current)} con C6 vigente.</p></div>
      {!overallHealthy&&<div className="ops-health-items">
        {capturePending>0&&<article className="warn"><strong>Captura técnica pendiente</strong><span>{nf(capturePending)} archivo(s): {nf(missing)} sin captura, {nf(pendingState)} en preparación y {nf(errors)} con error.</span></article>}
        {c6Pending>0&&<article className="warn"><strong>C6 pendiente</strong><span>{nf(c6Pending)} archivo(s) ya capturados esperan cálculo.</span></article>}
      </div>}
    </section>

    <section className="ops-panel">
      <div className="ops-panel-head"><div><span className="ops-label">Cadena actual</span><h2>De Plex a PikoQuality</h2><p>Estas cifras describen el estado vivo de Neon, no el resultado de una ejecución histórica.</p></div><span className={`ops-count ${capturePending||c6Pending?'warn':''}`}>{capturePending+c6Pending?`${nf(capturePending+c6Pending)} paso(s) pendientes`:'Al día'}</span></div>
      <div className={styles.pipeline}>
        <article className={styles.stage}><div className={styles.stageHead}><span>1 · Biblioteca física</span><b className={styles.good}>Plex</b></div><strong>{nf(physical)}</strong><small>{nf(technical.byType?.movie?.total)} películas · {nf(technical.byType?.episode?.total)} episodios activos.</small><div className={styles.progress}><span style={{width:'100%'}}/></div></article>
        <article className={styles.stage}><div className={styles.stageHead}><span>2 · Captura técnica</span><b className={healthyCapture?styles.good:styles.attention}>{readyPct}%</b></div><strong>{nf(ready)} / {nf(physical)}</strong><small>{capturePending===0?'Todos los archivos físicos tienen evidencia técnica vigente.':`${nf(capturePending)} pendientes: ${nf(missing)} sin captura · ${nf(errors)} con error.`}</small><div className={`${styles.progress} ${healthyCapture?'':styles.warn}`}><span style={{width:`${Math.min(100,readyPct)}%`}}/></div></article>
        <article className={styles.stage}><div className={styles.stageHead}><span>3 · Cálculo C6</span><b className={healthyC6?styles.good:styles.attention}>{pct(c6Current,c6Total)}%</b></div><strong>{nf(c6Current)} / {nf(c6Total)}</strong><small>{c6Pending===0?'C6 vigente para toda la evidencia técnica calculable.':`${nf(c6Pending)} captura(s) válidas esperan C6.`} {capturePending>0?`${nf(capturePending)} archivo(s) todavía están antes de esta fase.`:''}</small><div className={`${styles.progress} ${healthyC6?'':styles.warn}`}><span style={{width:`${Math.min(100,pct(c6Current,c6Total))}%`}}/></div></article>
      </div>
    </section>

    <section className="ops-panel">
      <div className="ops-panel-head"><div><span className="ops-label">Captura técnica · PROC-PQ-002</span><h2>Comprobar biblioteca y recapturar cambios</h2><p>Cada nueva comprobación vuelve a leer la biblioteca física completa; sólo recaptura archivos nuevos, modificados o errores rearmados.</p></div><span className={`ops-count ${technical.workerOnline?'':'warn'}`}>{technical.workerOnline?'Worker disponible':'Worker no disponible'}</span></div>
      <div className={styles.controlGrid}>
        <div className={`${styles.controlCard} ${active?styles.live:''}`}>
          <h3>{active?'Ejecución activa':'Sin ejecución activa'}</h3>
          <p>{active?'El control y el detalle de esta ejecución son canónicos y viven también en Operaciones.':'Iniciar una comprobación crea una nueva ejecución canónica PROC-PQ-002 en Operaciones.'}</p>
          {active&&<div className={styles.liveRow}><div><strong>{statusLabel[active.technical_status]||active.technical_status}</strong><br/><code>{String(active.run_id)}</code></div><Link className={styles.runLink} href={`/admin/runs/${active.run_id}`}>Diagnosticar →</Link></div>}
          <TechnicalControlActions requestedState={control.requested_state||'stopped'} workerOnline={technical.workerOnline} hasActiveRun={Boolean(active)}/>
          <div className={styles.links}><Link href="/admin?process=PROC-PQ-002&period=30d">Ver ejecuciones de captura en Operaciones →</Link></div>
        </div>
        <aside className={styles.controlCard}>
          <h3>Worker técnico</h3><p>Disponibilidad del servicio y control actual. Esto no es el estado de una ejecución.</p>
          <div className={styles.facts}>
            <div className={styles.fact}><span>Servicio</span><strong className={technical.workerOnline?styles.good:styles.bad}>{technical.workerOnline?'Disponible':'Sin heartbeat'}</strong><small>{control.heartbeat_at?`Heartbeat ${dt(control.heartbeat_at)}`:'Sin heartbeat registrado'}</small></div>
            <div className={styles.fact}><span>Control solicitado</span><strong>{control.requested_state==='running'?'En marcha':control.requested_state==='paused'?'Pausado':'Detenido'}</strong><small>Estado worker: {control.actual_state||'—'}</small></div>
          </div>
          {errors>0&&<div className={styles.notice}><b>{nf(errors)} error(es) técnicos persistidos.</b> Una nueva comprobación los rearma una vez para reintento. Si vuelven a fallar, la nueva ejecución los registrará en Operaciones.</div>}
        </aside>
      </div>
      {last&&!active&&<div className={styles.notice}>Última ejecución canónica: <b>{dt(last.finished_at||last.started_at||last.requested_at)}</b> · {statusLabel[last.technical_status]||last.technical_status}{last.functional_result?` · ${resultLabel[last.functional_result]||last.functional_result}`:''}. <Link href={`/admin/runs/${last.run_id}`}>Ver detalle técnico →</Link></div>}
    </section>

    <C6ControlPanel initial={c6} capturePending={capturePending}/>
  </div>;
}

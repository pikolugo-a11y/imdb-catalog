import Link from 'next/link';
import {db} from '@/lib/db';
import {QUALITY_VERSION} from '../../../lib/pikoquality';
import {getPikoQualityState} from '../../../lib/pikoquality-state';
import {getTechnicalDashboard} from '../../../lib/plex-technical-control.mjs';
import {analyzeOnePikoQualityAction,startTechnicalSnapshotAction,pauseTechnicalSnapshotAction,stopTechnicalSnapshotAction} from './actions';
import styles from './pikoquality.module.css';

export const dynamic='force-dynamic';
const nf=n=>Number(n||0).toLocaleString('es-ES');
const dt=v=>v?new Date(v).toLocaleString('es-ES'):'—';
const labels={excellent:'Excelente',very_good:'Muy buena',correct:'Correcta',improvable:'Mejorable',deficient:'Deficiente'};
const pct=(n,total)=>total?Math.round(Number(n||0)*1000/Number(total))/10:0;
const technicalLabels={running:'Ejecutándose',pausing:'Pausando',paused:'Pausado',stopped:'Detenido',error:'Error',completed:'Completado'};
function Metric({label,value,sub}){return <div className={styles.metric}><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>}
function Progress({label,data}){const p=pct(data.ready,data.total);return <div className={styles.syncProgress}><div className={styles.syncProgressHead}><span>{label}</span><b>{nf(data.ready)} / {nf(data.total)} · {p}%</b></div><div className={styles.progressTrack}><span style={{width:`${Math.min(100,p)}%`}}/></div><small>{nf(data.pending)} pendientes · {nf(data.stale)} stale · {nf(data.error)} errores</small></div>}

export default async function Page(){
  const sql=db();
  const [s,technical,pending]=await Promise.all([
    getPikoQualityState(),
    getTechnicalDashboard(sql),
    sql`SELECT cl.imdb_id,m.title_es,m.year,pcs.rating_key,p.plex_title,p.plex_year,p.fingerprint,pm.resolution,pm.video_codec,q.score,q.source_fingerprint FROM catalog_lifecycle cl JOIN movies m USING(imdb_id) LEFT JOIN plex_catalog_status pcs USING(imdb_id) LEFT JOIN plex_items p ON p.rating_key=pcs.rating_key AND p.active LEFT JOIN LATERAL(SELECT resolution,video_codec FROM plex_media z WHERE z.rating_key=p.rating_key ORDER BY media_index LIMIT 1) pm ON true LEFT JOIN piko_quality q ON q.rating_key=pcs.rating_key WHERE cl.lifecycle_state='TECH_PENDING' AND m.type='Película' ORDER BY m.year DESC NULLS LAST,m.title_es LIMIT 500`
  ]);
  const c=technical.control||{};
  const armed=Boolean(c.armed);
  const requested=c.requested_state||'stopped';
  const actual=c.actual_state||'stopped';
  const overallPct=pct(technical.total.ready,technical.total.total);
  const distribution=[['excellent',styles.excellent,'85–100'],['very_good',styles.verygood,'75–84'],['correct',styles.correct,'60–74'],['improvable',styles.improvable,'40–59'],['deficient',styles.deficient,'< 40']];
  return <div className={styles.page}>
    <div className={styles.topline}><div className={styles.titleWrap}><div className={styles.logo}>☆</div><div><h1>PikoQuality <span className={styles.version}>v{QUALITY_VERSION}</span></h1><p className={styles.subtitle}>Evaluación técnica del archivo físico actual. Las películas se procesan una a una.</p></div></div><Link className="btn" href="/calidad">← Calidad</Link></div>

    <section className={styles.syncPanel}>
      <div className={styles.syncHeader}><div><span className={styles.kicker}>CAPTURA TÉCNICA PLEX</span><h2>Sincronización técnica</h2><p>Snapshot persistido de vídeo y audio. Es independiente de Novedades y del cálculo de PikoQuality.</p></div><div className={`${styles.syncState} ${styles[`syncState_${actual}`]||''}`}><span>{technical.workerOnline?'●':'○'}</span>{armed?(technicalLabels[actual]||actual):'Bloqueado hasta GO'}</div></div>
      <div className={styles.syncSummary}><div><span>Progreso total</span><strong>{nf(technical.total.ready)} / {nf(technical.total.total)}</strong><small>{overallPct}% capturado</small></div><div><span>Velocidad reciente</span><strong>{technical.velocity.perMinute5} / min</strong><small>15 min: {technical.velocity.perMinute15} / min</small></div><div><span>Última captura</span><strong>{dt(technical.velocity.lastCaptureAt)}</strong><small>Heartbeat: {dt(c.heartbeat_at)}</small></div><div><span>Worker</span><strong>{technical.workerOnline?'Online':'Sin actividad'}</strong><small>{c.worker_id||'—'}</small></div></div>
      <div className={styles.syncProgressGrid}><Progress label="Películas" data={technical.byType.movie}/><Progress label="Episodios" data={technical.byType.episode}/></div>
      {c.last_error?<div className={styles.syncError}>Último error: {c.last_error}</div>:null}
      <div className={styles.syncActions}>
        {!armed?<button className={styles.primaryButton} disabled title="El backfill inicial requiere autorización expresa">Iniciar</button>:requested!=='running'?<form action={startTechnicalSnapshotAction}><button className={styles.primaryButton}>{actual==='paused'?'Reanudar':'Iniciar'}</button></form>:null}
        {armed&&requested==='running'?<form action={pauseTechnicalSnapshotAction}><button className={styles.secondaryButton}>Pausar</button></form>:null}
        {armed&&requested!=='stopped'?<form action={stopTechnicalSnapshotAction}><button className={styles.secondaryButton}>Detener</button></form>:null}
        <div className={styles.syncActionNote}>{armed?'La pausa termina las capturas ya iniciadas y no reclama un lote nuevo. Reanudar continúa sobre los pendientes.':'El backfill inicial está bloqueado. Se habilitará únicamente después de tu GO expreso.'}</div>
      </div>
    </section>

    <section className={styles.hero}><div className={styles.heroStatus}><div className={styles.ring} style={{'--p':pending.length?'5%':'100%'}}><strong>{pending.length}</strong></div><div><span className={styles.muted}>Películas pendientes</span><h2>{pending.length?'PikoQuality pendiente':'Películas al día'}</h2><p>Solo aparecen archivos que ya pasaron Validación de película.</p></div></div><div className={styles.infoBox}><h3>Flujo</h3><ul><li>Analiza una película cada vez.</li><li>Usará el snapshot técnico persistido.</li><li>Guarda PikoQuality para el fingerprint técnico actual.</li><li>Al terminar recalcula lifecycle y, si todo está correcto, pasa automáticamente a COMPLETE.</li></ul></div></section>

    <section className={styles.metrics}><Metric label="Pendientes película" value={nf(pending.length)} sub="Estado TECH_PENDING"/><Metric label="Evaluados vigentes" value={nf(s.evaluated)} sub="PikoQuality actual"/><Metric label="Confianza alta" value={nf(s.high)} sub={`${pct(s.high,s.evaluated)}% de evaluados`}/><Metric label="Stale / errores" value={`${nf(s.stale)} / ${nf(s.errors)}`} sub="Archivo cambiado o error técnico"/></section>

    <section><div className={styles.panel} style={{paddingBottom:0}}><h2>Películas pendientes de PikoQuality</h2><p className={styles.subtitle}>Un único listado y un único botón. Al analizar correctamente, la película sale de aquí automáticamente.</p></div><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Película</th><th>Plex</th><th>Resolución</th><th>Códec</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{pending.length?pending.map(r=><tr key={r.imdb_id}><td><strong>{r.title_es||r.plex_title||r.imdb_id}</strong><br/><span className={styles.muted}>{r.year||r.plex_year||'—'} · {r.imdb_id}</span></td><td>{r.rating_key||'—'}</td><td>{r.resolution||'—'}</td><td>{r.video_codec||'—'}</td><td>{r.score!=null&&r.source_fingerprint===r.fingerprint?`PQ ${r.score} vigente`:'Pendiente para archivo actual'}</td><td><form action={analyzeOnePikoQualityAction}><input type="hidden" name="imdbId" value={r.imdb_id}/><button>Analizar PikoQuality</button></form></td></tr>):<tr><td colSpan="6"><b>No hay películas pendientes.</b></td></tr>}</tbody></table></div></section>

    <section className={styles.bodyGrid}><div className={styles.panel}><h2>Resumen de PikoQuality</h2><div className={styles.distribution}>{distribution.map(([key,cls,range])=><div className={`${styles.band} ${cls}`} key={key}><span>{labels[key]}</span><strong>{pct(s.distribution[key],s.evaluated)}%</strong><small>{nf(s.distribution[key])} · {range}</small></div>)}</div></div><div className={styles.panel}><h2>Estado técnico</h2><div className={styles.detailGrid}><div><span>Total elegible</span><b>{nf(s.total)}</b></div><div><span>Evaluados</span><b>{nf(s.evaluated)}</b></div><div><span>Enriquecidos</span><b>{nf(s.enriched)}</b></div><div><span>Errores</span><b>{nf(s.errors)}</b></div></div></div></section>

    <section><div className={styles.panel} style={{paddingBottom:0}}><h2>Últimos elementos evaluados</h2></div><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Título</th><th>Tipo</th><th>Resolución</th><th>Códec</th><th>PikoQuality</th><th>Banda</th><th>Confianza</th><th>Estado</th></tr></thead><tbody>{s.recent.map(x=><tr key={x.rating_key}><td><strong>{x.plex_title||x.rating_key}</strong><br/><span className={styles.muted}>{x.plex_year||'—'}</span></td><td>{x.item_type==='movie'?'Película':`Episodio T${x.parent_index??'?'}E${x.item_index??'?'}`}</td><td>{x.resolution||'—'}</td><td>{x.video_codec||'—'}</td><td><strong>{x.score??'—'}</strong></td><td>{labels[x.band]||x.band||'—'}</td><td>{x.confidence||'—'}</td><td>{x.status}</td></tr>)}</tbody></table></div></section>

    <div className={styles.adminNote}>ⓘ Captura técnica y cálculo PikoQuality son procesos independientes. El snapshot se conserva aunque cambie la fórmula.</div>
  </div>;
}

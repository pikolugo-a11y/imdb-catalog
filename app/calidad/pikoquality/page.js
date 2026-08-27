import Link from 'next/link';
import {db} from '@/lib/db';
import {QUALITY_VERSION} from '../../../lib/pikoquality';
import {getPikoQualityState,getPikoQualityPendingPage} from '../../../lib/pikoquality-state';
import {getTechnicalDashboard} from '../../../lib/plex-technical-control.mjs';
import {analyzeOnePikoQualityAction,startTechnicalSnapshotAction,pauseTechnicalSnapshotAction,stopTechnicalSnapshotAction} from './actions';
import styles from './pikoquality.module.css';

export const dynamic='force-dynamic';
const nf=n=>Number(n||0).toLocaleString('es-ES');
const dt=v=>v?new Date(v).toLocaleString('es-ES'):'—';
const labels={excellent:'Excelente',very_good:'Muy buena',correct:'Correcta',improvable:'Mejorable',deficient:'Deficiente'};
const pct=(n,total)=>total?Math.round(Number(n||0)*1000/Number(total))/10:0;
const technicalLabels={running:'Ejecutándose',pausing:'Pausando',paused:'Pausado',stopped:'Detenido',error:'Error',completed:'Completado'};
const mbps=v=>v?`${(Number(v)/1000).toLocaleString('es-ES',{maximumFractionDigits:1})} Mbps`:'—';
function Metric({label,value,sub,href}){const body=<><span>{label}</span><strong>{value}</strong><small>{sub}</small></>;return href?<Link className={`${styles.metric} ${styles.metricLink}`} href={href}>{body}</Link>:<div className={styles.metric}>{body}</div>}
function Progress({label,data}){const p=pct(data.ready,data.total);return <div className={styles.syncProgress}><div className={styles.syncProgressHead}><span>{label}</span><b>{nf(data.ready)} / {nf(data.total)} · {p}%</b></div><div className={styles.progressTrack}><span style={{width:`${Math.min(100,p)}%`}}/></div><small>{nf(data.pending)} pendientes · {nf(data.stale)} desactualizados · {nf(data.error)} errores</small></div>}
function queueStatus(r){if(r.status==='error'&&r.source_fingerprint===r.fingerprint)return['Error',styles.statusError];if(r.rating_key&&(r.status==='stale'||r.formula_version!==QUALITY_VERSION||r.source_fingerprint!==r.fingerprint))return['Desactualizado',styles.statusStale];return['Pendiente',styles.statusPending]}
function paramsHref(current,patch){const p=new URLSearchParams();for(const [k,v] of Object.entries({...current,...patch})){if(v!==''&&v!=null&&!(k==='page'&&Number(v)===1))p.set(k,String(v))}const qs=p.toString();return `/calidad/pikoquality${qs?`?${qs}`:''}`}

export default async function Page({searchParams}){
  const sp=await searchParams||{};
  const filters={page:Math.max(1,Number(sp.page)||1),q:String(sp.q||''),resolution:String(sp.resolution||''),codec:String(sp.codec||''),status:String(sp.status||''),sort:String(sp.sort||'priority')};
  const sql=db();
  const [s,technical,queue]=await Promise.all([
    getPikoQualityState(),
    getTechnicalDashboard(sql),
    getPikoQualityPendingPage({page:filters.page,pageSize:25,query:filters.q,resolution:filters.resolution,codec:filters.codec,status:filters.status,sort:filters.sort})
  ]);
  const c=technical.control||{};
  const armed=Boolean(c.armed);
  const requested=c.requested_state||'stopped';
  const actual=c.actual_state||'stopped';
  const overallPct=pct(technical.total.ready,technical.total.total);
  const firstRun=!armed&&technical.total.ready<=6&&technical.total.pending>0;
  const distribution=[['excellent',styles.excellent,'85–100'],['very_good',styles.verygood,'75–84'],['correct',styles.correct,'60–74'],['improvable',styles.improvable,'40–59'],['deficient',styles.deficient,'< 40']];
  const rangeStart=queue.total?(queue.page-1)*queue.pageSize+1:0;
  const rangeEnd=Math.min(queue.total,queue.page*queue.pageSize);
  const current={q:filters.q,resolution:filters.resolution,codec:filters.codec,status:filters.status,sort:filters.sort,page:queue.page};
  return <div className={styles.page}>
    <div className={styles.topline}><div className={styles.titleWrap}><div className={styles.logo}>☆</div><div><h1>PikoQuality <span className={styles.version}>v{QUALITY_VERSION}</span></h1><p className={styles.subtitle}>Área de trabajo para capturar datos técnicos y calcular la calidad del archivo actual.</p></div></div><Link className="btn" href="/calidad">← Calidad</Link></div>

    <section className={styles.syncPanel}>
      <div className={styles.syncHeader}><div><span className={styles.kicker}>1 · DATOS TÉCNICOS</span><h2>Captura técnica de Plex</h2><p>Persistimos vídeo, audio, tamaño, duración y fingerprint. Esta captura es independiente del cálculo de PikoQuality y de Novedades.</p></div><div className={`${styles.syncState} ${styles[`syncState_${actual}`]||''}`}><span>{technical.workerOnline?'●':'○'}</span>{technicalLabels[actual]||actual}</div></div>
      <div className={styles.syncSummary}><div><span>Progreso total</span><strong>{nf(technical.total.ready)} / {nf(technical.total.total)}</strong><small>{overallPct}% capturado</small></div><div><span>Velocidad reciente</span><strong>{technical.velocity.perMinute5} / min</strong><small>15 min: {technical.velocity.perMinute15} / min</small></div><div><span>Última captura</span><strong>{dt(technical.velocity.lastCaptureAt)}</strong><small>Heartbeat: {dt(c.heartbeat_at)}</small></div><div><span>Worker</span><strong>{technical.workerOnline?'Online':'En espera'}</strong><small>{nf(technical.total.error)} errores acumulados</small></div></div>
      <div className={styles.syncProgressGrid}><Progress label="Películas" data={technical.byType.movie}/><Progress label="Episodios" data={technical.byType.episode}/></div>
      {c.last_error?<div className={styles.syncError}>Último error del worker: {c.last_error}</div>:null}
      <div className={styles.syncActions}>
        {requested!=='running'?<form action={startTechnicalSnapshotAction}><button className={styles.primaryButton}>{actual==='paused'?'Reanudar':firstRun?'Iniciar captura inicial':'Iniciar captura técnica'}</button></form>:null}
        {requested==='running'?<form action={pauseTechnicalSnapshotAction}><button className={styles.secondaryButton}>Pausar</button></form>:null}
        {requested!=='stopped'?<form action={stopTechnicalSnapshotAction}><button className={styles.secondaryButton}>Detener</button></form>:null}
        <div className={styles.syncActionNote}>Pausar no borra el progreso. Al reanudar, el worker continúa sobre los elementos pendientes. El snapshot persistido seguirá siendo válido aunque cambie la fórmula.</div>
      </div>
    </section>

    <section className={styles.hero}>
      <div className={styles.heroStatus}><div className={styles.ring} style={{'--p':`${Math.min(100,s.progressA)}%`}}><strong>{s.progressA}%</strong></div><div><span className={styles.muted}>2 · PIKOQUALITY</span><h2>{s.pending_a?'Cálculo pendiente':'PikoQuality al día'}</h2><p>{nf(s.evaluated)} de {nf(s.total)} archivos elegibles tienen un resultado vigente para su fingerprint y fórmula actual.</p></div></div>
      <div className={styles.infoBox}><h3>Fuente de verdad</h3><ul><li>El análisis usa el snapshot técnico persistido.</li><li>Un cambio de archivo invalida el resultado anterior.</li><li>La versión de fórmula forma parte de la validez.</li><li>Individual y Batch deben producir exactamente el mismo resultado.</li></ul></div>
    </section>

    <section className={styles.metrics}>
      <Metric label="Películas en cola" value={nf(queue.total)} sub="Total real, no página cargada" href={paramsHref(current,{page:1,status:''})}/>
      <Metric label="Evaluados vigentes" value={nf(s.evaluated)} sub={`${s.progressA}% del universo elegible`}/>
      <Metric label="Desactualizados" value={nf(s.stale)} sub="Fingerprint o fórmula cambiados" href={paramsHref(current,{page:1,status:'stale'})}/>
      <Metric label="Errores" value={nf(s.errors)} sub="Requieren revisión o reintento" href={paramsHref(current,{page:1,status:'error'})}/>
    </section>

    <section className={styles.queueSection}>
      <div className={styles.panel}>
        <div className={styles.sectionHead}><div><h2>Películas pendientes de PikoQuality</h2><p className={styles.subtitle}>Herramienta operativa: busca, filtra y analiza únicamente la página necesaria.</p></div><div className={styles.range}>{rangeStart}–{rangeEnd} de {nf(queue.total)}</div></div>
        <form className={styles.filters} method="get">
          <label className={styles.searchField}><span>Buscar</span><input name="q" defaultValue={filters.q} placeholder="Título o IMDb ID"/></label>
          <label><span>Resolución</span><select name="resolution" defaultValue={filters.resolution}><option value="">Todas</option>{queue.resolutions.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
          <label><span>Códec</span><select name="codec" defaultValue={filters.codec}><option value="">Todos</option>{queue.codecs.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
          <label><span>Estado</span><select name="status" defaultValue={filters.status}><option value="">Todos</option><option value="pending">Pendiente</option><option value="stale">Desactualizado</option><option value="error">Error</option></select></label>
          <label><span>Orden</span><select name="sort" defaultValue={filters.sort}><option value="priority">Prioridad</option><option value="year">Año</option><option value="title">Título</option></select></label>
          <button className={styles.primaryButton} type="submit">Aplicar</button>
          {(filters.q||filters.resolution||filters.codec||filters.status||filters.sort!=='priority')?<Link className={styles.clearFilters} href="/calidad/pikoquality">Limpiar</Link>:null}
        </form>
      </div>
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Película</th><th>Archivo técnico</th><th>Audio</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{queue.rows.length?queue.rows.map(r=>{const [status,statusClass]=queueStatus(r);return <tr key={r.imdb_id}><td><strong>{r.title_es||r.plex_title||r.imdb_id}</strong><br/><span className={styles.muted}>{r.year||r.plex_year||'—'} · {r.imdb_id}</span></td><td><div className={styles.techMain}>{r.resolution||'—'} · {String(r.video_codec||'—').toUpperCase()} {r.bit_depth?`· ${r.bit_depth} bit`:''}</div><span className={styles.techSub}>{mbps(r.bitrate)}</span></td><td><div className={styles.techMain}>{String(r.audio_codec||'—').toUpperCase()}</div><span className={styles.techSub}>{r.audio_channels?`${r.audio_channels} canales`:'—'}</span></td><td><span className={`${styles.statusChip} ${statusClass}`}>{status}</span></td><td><form action={analyzeOnePikoQualityAction}><input type="hidden" name="imdbId" value={r.imdb_id}/><button className={styles.analyzeButton}>Analizar</button></form></td></tr>}):<tr><td colSpan="5"><div className={styles.emptyState}><b>{queue.total?'No hay elementos en esta página.':'PikoQuality al día'}</b><span>{queue.total?'Ajusta los filtros o vuelve a la primera página.':'No hay películas pendientes con los filtros actuales.'}</span></div></td></tr>}</tbody></table></div>
      {queue.pageCount>1?<nav className={styles.pagination} aria-label="Paginación"><Link className={queue.page<=1?styles.disabledPage:''} aria-disabled={queue.page<=1} href={queue.page<=1?'#':paramsHref(current,{page:queue.page-1})}>← Anterior</Link><span>Página {queue.page} de {queue.pageCount}</span><Link className={queue.page>=queue.pageCount?styles.disabledPage:''} aria-disabled={queue.page>=queue.pageCount} href={queue.page>=queue.pageCount?'#':paramsHref(current,{page:queue.page+1})}>Siguiente →</Link></nav>:null}
    </section>

    <section className={styles.bodyGrid}><div className={styles.panel}><h2>Distribución de la fórmula activa</h2><div className={styles.distribution}>{distribution.map(([key,cls,range])=><div className={`${styles.band} ${cls}`} key={key}><span>{labels[key]}</span><strong>{pct(s.distribution[key],s.evaluated)}%</strong><small>{nf(s.distribution[key])} · {range}</small></div>)}</div><p className={styles.formulaNote}>Esta distribución corresponde a la fórmula actualmente desplegada. La candidata C5 permanece en validación y no se aplica masivamente hasta cerrar la captura técnica.</p></div><div className={styles.panel}><h2>Estado del dominio</h2><div className={styles.detailGrid}><div><span>Total elegible</span><b>{nf(s.total)}</b></div><div><span>Películas</span><b>{nf(s.movies)}</b></div><div><span>Episodios</span><b>{nf(s.episodes)}</b></div><div><span>Bloqueados lifecycle</span><b>{nf(s.blocked_by_lifecycle)}</b></div></div><div className={styles.domainState}><b>{s.recommendation.label}</b><span>{s.recommendation.description}</span></div></div></section>

    <section><div className={styles.panel} style={{paddingBottom:0}}><h2>Últimos elementos evaluados</h2></div><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Título</th><th>Tipo</th><th>Archivo</th><th>PikoQuality</th><th>Banda</th><th>Confianza</th><th>Estado</th></tr></thead><tbody>{s.recent.length?s.recent.map(x=><tr key={x.rating_key}><td><strong>{x.plex_title||x.rating_key}</strong><br/><span className={styles.muted}>{x.plex_year||'—'}</span></td><td>{x.item_type==='movie'?'Película':`Episodio T${x.parent_index??'?'}E${x.item_index??'?'}`}</td><td>{x.resolution||'—'} · {String(x.video_codec||'—').toUpperCase()}</td><td><strong>{x.score??'—'}</strong></td><td>{labels[x.band]||x.band||'—'}</td><td>{x.confidence||'—'}</td><td>{x.status}</td></tr>):<tr><td colSpan="7">Todavía no hay evaluaciones vigentes.</td></tr>}</tbody></table></div></section>

    <div className={styles.adminNote}>ⓘ Captura técnica y cálculo PikoQuality son procesos distintos. Esta pantalla nunca necesita recorrer Plex completo para mostrar el estado o la cola.</div>
  </div>;
}

import Link from 'next/link';
import {db} from '@/lib/db';
import {PIKOQUALITY_ACTIVE_VERSION} from '../../../lib/pikoquality-version.mjs';
import {getPikoQualityState,getPikoQualityPendingPage} from '../../../lib/pikoquality-state';
import {getC6BatchState} from '../../../lib/pikoquality-c6-batch';
import {getTechnicalDashboard} from '../../../lib/plex-technical-control.mjs';
import AnalyzeForm from './AnalyzeForm';
import TechnicalRunFlow from './TechnicalRunFlow';
import C6BatchRunner from './C6BatchRunner';
import styles from './pikoquality.module.css';

export const dynamic='force-dynamic';
const nf=n=>Number(n||0).toLocaleString('es-ES');
const labels={fail:'Suspenso',sufficient:'Suficiente',good:'Bien',notable:'Notable',outstanding:'Sobresaliente',honors:'Matrícula'};
const pct=(n,total)=>total?Math.round(Number(n||0)*1000/Number(total))/10:0;
const mbps=v=>v?`${(Number(v)/1000).toLocaleString('es-ES',{maximumFractionDigits:1})} Mbps`:'—';
function Metric({label,value,sub,href}){const body=<><span>{label}</span><strong>{value}</strong><small>{sub}</small></>;return href?<Link className={`${styles.metric} ${styles.metricLink}`} href={href}>{body}</Link>:<div className={styles.metric}>{body}</div>}
function queueStatus(r){if(r.status==='error'&&r.formula_version===PIKOQUALITY_ACTIVE_VERSION)return['Error',styles.statusError];if(r.rating_key&&(r.formula_version===PIKOQUALITY_ACTIVE_VERSION&&r.source_fingerprint!==r.fingerprint))return['Desactualizado',styles.statusStale];return['Pendiente C6',styles.statusPending]}
function paramsHref(current,patch){const p=new URLSearchParams();for(const [k,v] of Object.entries({...current,...patch})){if(v!==''&&v!=null&&!(k==='page'&&Number(v)===1))p.set(k,String(v))}const qs=p.toString();return `/calidad/pikoquality${qs?`?${qs}`:''}`}

export default async function Page({searchParams}){
  const sp=await searchParams||{};
  const filters={page:Math.max(1,Number(sp.page)||1),q:String(sp.q||''),resolution:String(sp.resolution||''),codec:String(sp.codec||''),status:String(sp.status||''),sort:String(sp.sort||'priority')};
  const sql=db();
  const [s,technical,queue,c6]=await Promise.all([
    getPikoQualityState(),
    getTechnicalDashboard(sql),
    getPikoQualityPendingPage({page:filters.page,pageSize:25,query:filters.q,resolution:filters.resolution,codec:filters.codec,status:filters.status,sort:filters.sort}),
    getC6BatchState(sql)
  ]);
  const distribution=[['fail',styles.deficient,'< 5,0'],['sufficient',styles.improvable,'5,0–5,9'],['good',styles.correct,'6,0–6,9'],['notable',styles.verygood,'7,0–8,4'],['outstanding',styles.excellent,'8,5–9,4'],['honors',styles.honors,'≥ 9,5']];
  const rangeStart=queue.total?(queue.page-1)*queue.pageSize+1:0;
  const rangeEnd=Math.min(queue.total,queue.page*queue.pageSize);
  const current={q:filters.q,resolution:filters.resolution,codec:filters.codec,status:filters.status,sort:filters.sort,page:queue.page};
  const hasFilters=Boolean(filters.q||filters.resolution||filters.codec||filters.status||filters.sort!=='priority');
  const allDone=s.pending_a===0&&s.errors===0;
  return <div className={styles.page}>
    <div className={styles.topline}><div className={styles.titleWrap}><div className={styles.logo}>☆</div><div><h1>PikoQuality <span className={styles.version}>v{PIKOQUALITY_ACTIVE_VERSION}</span></h1><p className={styles.subtitle}>Área de trabajo para capturar datos técnicos y calcular la PikoQuality oficial del archivo físico vigente.</p></div></div><Link className="btn" href="/calidad">← Calidad</Link></div>

    <TechnicalRunFlow technical={technical}/>
    <C6BatchRunner initial={c6}/>

    <section className={styles.hero}>
      <div className={styles.heroStatus}><div className={styles.ring} style={{'--p':`${Math.min(100,s.progressA)}%`}}><strong>{s.progressA}%</strong></div><div><span className={styles.muted}>PIKOQUALITY 2.0 · C6</span><h2>{allDone?'PikoQuality al día':'Trabajo pendiente'}</h2><p>{nf(s.evaluated)} de {nf(s.total)} archivos técnicamente preparados tienen C6 vigente para su fingerprint técnico actual.</p></div></div>
      <div className={styles.infoBox}><h3>Fuente de verdad única</h3><ul><li>El valor oficial se guarda en <code>piko_quality.score</code>.</li><li>La versión activa es <code>{PIKOQUALITY_ACTIVE_VERSION}</code>.</li><li>Un cambio de technical_fingerprint invalida automáticamente el resultado.</li><li>Individual y Batch usan exactamente el mismo núcleo C6.</li></ul></div>
    </section>

    <section className={styles.metrics}>
      <Metric label="Cobertura C6" value={`${s.progressA}%`} sub={`${nf(s.evaluated)} / ${nf(s.total)} vigentes`}/>
      <Metric label="Películas pendientes" value={nf(queue.overallTotal)} sub="Archivos movie ready sin C6 vigente" href="/calidad/pikoquality"/>
      <Metric label="Archivo cambiado" value={nf(s.stale)} sub="C6 existente con fingerprint distinto" href={paramsHref(current,{page:1,status:'stale'})}/>
      <Metric label="Incidencias C6" value={nf(s.errors)} sub="Errores de cálculo C6" href={paramsHref(current,{page:1,status:'error'})}/>
    </section>

    {allDone&&!hasFilters?<section className={styles.completedState}><div className={styles.completedIcon}>✓</div><div><span className={styles.kicker}>SIN TRABAJO PENDIENTE</span><h2>PikoQuality C6 al día</h2><p>{nf(s.evaluated)} / {nf(s.total)} archivos técnicamente preparados tienen la fórmula oro vigente.</p></div></section>:<section className={styles.queueSection}>
      <div className={styles.panel}>
        <div className={styles.sectionHead}><div><h2>Películas pendientes de C6</h2><p className={styles.subtitle}>La cola se deriva de versión + technical_fingerprint. No depende del lifecycle para decidir la vigencia de PikoQuality.</p></div><div className={styles.range}>{rangeStart}–{rangeEnd} de {nf(queue.total)}{hasFilters?` · ${nf(queue.overallTotal)} totales`:''}</div></div>
        <form className={styles.filters} method="get">
          <label className={styles.searchField}><span>Buscar</span><input name="q" defaultValue={filters.q} placeholder="Título o IMDb ID"/></label>
          <label><span>Resolución</span><select name="resolution" defaultValue={filters.resolution}><option value="">Todas</option>{queue.resolutions.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
          <label><span>Códec</span><select name="codec" defaultValue={filters.codec}><option value="">Todos</option>{queue.codecs.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
          <label><span>Estado</span><select name="status" defaultValue={filters.status}><option value="">Todos</option><option value="pending">Nunca C6</option><option value="stale">Archivo cambiado</option><option value="error">Error C6</option></select></label>
          <label><span>Orden</span><select name="sort" defaultValue={filters.sort}><option value="priority">Prioridad recomendada</option><option value="year">Año</option><option value="title">Título</option></select></label>
          <button className={styles.primaryButton} type="submit">Aplicar</button>
          {hasFilters?<Link className={styles.clearFilters} href="/calidad/pikoquality">Limpiar</Link>:null}
        </form>
      </div>
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Película</th><th>Archivo técnico</th><th>Audio</th><th>Prioridad / estado</th><th>Acción</th></tr></thead><tbody>{queue.rows.length?queue.rows.map(r=>{const [status,statusClass]=queueStatus(r);return <tr key={r.rating_key}><td><strong>{r.title_es||r.title||r.original_title||r.plex_title||r.imdb_id||r.rating_key}</strong><br/><span className={styles.muted}>{r.year||r.plex_year||'—'}{r.imdb_id?` · ${r.imdb_id}`:''}</span></td><td><div className={styles.techMain}>{r.resolution||'—'} · {String(r.video_codec||'—').toUpperCase()}</div><span className={styles.techSub}>{mbps(r.bitrate)}</span></td><td><div className={styles.techMain}>{String(r.audio_codec||'—').toUpperCase()}</div><span className={styles.techSub}>{r.audio_channels?`${r.audio_channels} canales`:'—'}</span></td><td><span className={`${styles.statusChip} ${statusClass}`}>{status}</span><span className={styles.priorityReason}>{r.priority_reason||'Pendiente C6'}</span></td><td>{r.imdb_id?<AnalyzeForm imdbId={r.imdb_id}/>:<span className={styles.muted}>Batch C6</span>}</td></tr>}):<tr><td colSpan="5"><div className={styles.emptyState}><b>No hay elementos con estos filtros.</b><span>Modifica los filtros o vuelve a la cola completa.</span></div></td></tr>}</tbody></table></div>
      {queue.pageCount>1?<nav className={styles.pagination} aria-label="Paginación"><Link className={queue.page<=1?styles.disabledPage:''} aria-disabled={queue.page<=1} href={queue.page<=1?'#':paramsHref(current,{page:queue.page-1})}>← Anterior</Link><span>Página {queue.page} de {queue.pageCount}</span><Link className={queue.page>=queue.pageCount?styles.disabledPage:''} aria-disabled={queue.page>=queue.pageCount} href={queue.page>=queue.pageCount?'#':paramsHref(current,{page:queue.page+1})}>Siguiente →</Link></nav>:null}
    </section>}

    <section className={styles.bodyGrid}><div className={styles.panel}><h2>Distribución C6 vigente</h2><div className={styles.distribution}>{distribution.map(([key,cls,range])=><div className={`${styles.band} ${cls}`} key={key}><span>{labels[key]}</span><strong>{pct(s.distribution[key],s.evaluated)}%</strong><small>{nf(s.distribution[key])} · {range}</small></div>)}</div><p className={styles.formulaNote}>C6 es la fórmula oro activa. C5 y 1.0.0 se conservan únicamente como histórico y nunca se consideran vigentes.</p></div><div className={styles.panel}><h2>Estado del dominio</h2><div className={styles.detailGrid}><div><span>Total ready</span><b>{nf(s.total)}</b></div><div><span>Películas</span><b>{nf(s.movies)}</b></div><div><span>Episodios</span><b>{nf(s.episodes)}</b></div><div><span>Agregados C6</span><b>{nf(s.aggregateCount)}</b></div></div><div className={styles.domainState}><b>{s.recommendation.label}</b><span>{s.recommendation.description}</span></div></div></section>

    <div className={styles.adminNote}>ⓘ PikoQuality tiene una única fuente de verdad: score + versión C6 + technical_fingerprint vigente. Las pantallas consumidoras no necesitan conocer versiones históricas.</div>
  </div>;
}

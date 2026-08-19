import Link from 'next/link';
import {qualitySummary,QUALITY_VERSION} from '../../../lib/pikoquality';
import PikoQualityRunner from './PikoQualityRunner';
import styles from './pikoquality.module.css';

export const dynamic='force-dynamic';
const nf=n=>Number(n||0).toLocaleString('es-ES');
const dt=v=>v?new Date(v).toLocaleString('es-ES'):'—';
const labels={excellent:'Excelente',very_good:'Muy buena',correct:'Correcta',improvable:'Mejorable',deficient:'Deficiente'};
const phaseTitle={a:'Carga inicial A en progreso',b:'Enriquecimiento B en progreso',retry_b:'Revisión de errores B',aggregate:'Agregados de series pendientes',done:'PikoQuality al día'};

function Step({n,title,sub,status}){const c=status==='active'?styles.stepActive:status==='done'?styles.stepDone:'';return <div className={`${styles.step} ${c}`}><div className={styles.stepNum}>{status==='done'?'✓':n}</div><div><b>{title}</b><span>{sub}</span></div></div>}
function Metric({label,value,sub}){return <div className={styles.metric}><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>}
function pct(n,total){return total?Math.round(Number(n||0)*1000/Number(total))/10:0}

export default async function Page(){
  const s=await qualitySummary();
  const phase=s.recommendation.phase;
  const progress=phase==='a'?s.progressA:(phase==='b'||phase==='retry_b')?s.progressB:100;
  const latest=s.runs?.[0];
  const completedA=s.pending_a===0;
  const completedB=completedA&&s.pending_b===0&&s.errors===0;
  const completedAgg=completedB&&!s.aggregatePending;
  const distribution=[['excellent',styles.excellent,'85–100'],['very_good',styles.verygood,'75–84'],['correct',styles.correct,'60–74'],['improvable',styles.improvable,'40–59'],['deficient',styles.deficient,'< 40']];
  return <div className={styles.page}>
    <div className={styles.topline}>
      <div className={styles.titleWrap}><div className={styles.logo}>☆</div><div><h1>PikoQuality <span className={styles.version}>v{QUALITY_VERSION}</span></h1><p className={styles.subtitle}>Evaluación de calidad técnica de películas y episodios con datos reales de Plex.</p></div></div>
      <Link className="btn" href="/calidad">← Calidad</Link>
    </div>

    <section className={styles.hero}>
      <div className={styles.heroStatus}><div className={styles.ring} style={{'--p':`${Math.max(1,progress)}%`}}><strong>{progress}%</strong></div><div><span className={styles.muted}>Estado actual</span><h2>{phaseTitle[phase]}</h2><p>{nf(s.evaluated)} / {nf(s.total)} elementos con score A válido</p><p>Películas: {nf(s.movies)} · Episodios: {nf(s.episodes)}</p></div></div>
      <div className={styles.recommended}><PikoQualityRunner initial={s}/></div>
      <div className={styles.infoBox}><h3>¿Qué hace?</h3><ul><li><b>A:</b> calcula el score base desde Neon, sin llamar a Plex.</li><li><b>B:</b> obtiene streams detallados solo para pendientes.</li><li><b>Series:</b> agrega episodios en temporada y serie.</li><li><b>Después:</b> los cambios de fingerprint vuelven a aparecer automáticamente como pendientes.</li></ul></div>
    </section>

    <section className={styles.pipeline}>
      <Step n="1" title="Carga inicial A" sub={`${s.progressA}% · ${nf(s.evaluated)} evaluados`} status={completedA?'done':phase==='a'?'active':''}/>
      <Step n="2" title="Enriquecimiento B" sub={`${s.progressB}% · ${nf(s.enriched)} enriquecidos`} status={completedB?'done':(phase==='b'||phase==='retry_b')?'active':''}/>
      <Step n="3" title="Agregados series" sub={`${nf(s.aggregateCount)} agregados`} status={completedAgg?'done':phase==='aggregate'?'active':''}/>
      <Step n="4" title="Integración Plex Sync" sub="Detección por fingerprint activa" status="done"/>
    </section>

    <section className={styles.metrics}>
      <Metric label="Total elementos" value={nf(s.total)} sub="Películas + episodios"/>
      <Metric label="Evaluados (A)" value={nf(s.evaluated)} sub={`${s.progressA}% del total`}/>
      <Metric label="Enriquecidos (B)" value={nf(s.enriched)} sub={`${s.progressB}% del total`}/>
      <Metric label="Confianza alta" value={nf(s.high)} sub={`${pct(s.high,s.evaluated)}% de evaluados`}/>
      <Metric label="Pendientes A / B" value={`${nf(s.pending_a)} / ${nf(s.pending_b)}`} sub="Acción guiada por estado"/>
      <Metric label="Stale / errores" value={`${nf(s.stale)} / ${nf(s.errors)}`} sub="No se puntúan como mala copia"/>
    </section>

    <section className={styles.bodyGrid}>
      <div className={styles.panel}><h2>Detalles de la fase actual</h2><div className={styles.detailGrid}><div><span>Fase</span><b>{phaseTitle[phase]}</b></div><div><span>Última ejecución</span><b>{latest?dt(latest.started_at):'—'}</b></div><div><span>Último lote</span><b>{latest?`${nf(latest.processed_count)} elementos`:'—'}</b></div><div><span>Duración</span><b>{latest?.duration_seconds!=null?`${latest.duration_seconds} s`:'—'}</b></div></div><div className={styles.progressWrap}><div className={styles.progressTrack}><span style={{width:`${Math.max(1,progress)}%`}}/></div><b>{progress}%</b></div><div className={styles.eventList}>{s.runs.map(r=><div className={styles.event} key={r.id}><span><b>{r.job_type}</b> · {dt(r.started_at)}</span><span>{nf(r.processed_count)} procesados · {nf(r.error_count)} errores · <span className={styles.resultTag}>{r.status}</span></span></div>)}</div></div>
      <div className={styles.panel}><h2>Resumen de PikoQuality</h2><div className={styles.distribution}>{distribution.map(([key,cls,range])=><div className={`${styles.band} ${cls}`} key={key}><span>{labels[key]}</span><strong>{pct(s.distribution[key],s.evaluated)}%</strong><small>{nf(s.distribution[key])} · {range}</small></div>)}</div><p className={styles.subtitle} style={{marginTop:16}}>La distribución usa únicamente elementos con score vigente. Idioma no interviene en la nota.</p></div>
    </section>

    <section><div className={styles.panel} style={{paddingBottom:0}}><h2>Últimos elementos evaluados</h2></div><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Título</th><th>Tipo</th><th>Resolución</th><th>Códec</th><th>PikoQuality</th><th>Banda</th><th>Confianza</th><th>Estado</th></tr></thead><tbody>{s.recent.map(x=><tr key={x.rating_key}><td><strong>{x.plex_title||x.rating_key}</strong><br/><span className={styles.muted}>{x.plex_year||'—'}</span></td><td>{x.item_type==='movie'?'Película':`Episodio T${x.parent_index??'?'}E${x.item_index??'?'}`}</td><td>{x.resolution||'—'}</td><td>{x.video_codec||'—'}</td><td><strong>{x.score??'—'}</strong></td><td>{labels[x.band]||x.band||'—'}</td><td><span className={`${styles.badge} ${x.confidence==='high'?styles.high:x.confidence==='low'?styles.low:styles.medium}`}>{x.confidence==='high'?'Alta':x.confidence==='low'?'Baja':'Media'}</span></td><td>{x.status}</td></tr>)}</tbody></table></div></section>

    <div className={styles.adminNote}>ⓘ Todos los lotes A, B, reintentos y agregados quedan registrados en <Link href="/admin">Admin → Actividad / Procesos</Link>. Puedes cerrar esta página y reanudar después: el progreso ya procesado no se pierde.</div>
  </div>;
}

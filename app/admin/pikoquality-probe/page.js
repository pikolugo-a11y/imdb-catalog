import Link from 'next/link';
import ActionButton from '@/components/ActionButton';
import {getLatestPikoQualityBProbe} from '@/lib/pikoquality-b-probe';
import {runPikoQualityBProbeAction} from './actions';

export const dynamic='force-dynamic';
const dt=v=>v?new Date(v).toLocaleString('es-ES'):'—';
const yn=v=>v?'Sí':'No';

export default async function PikoQualityProbe(){
  const run=await getLatestPikoQualityBProbe(),summary=run?.summary||{},coverage=summary.coverage||{},rows=summary.results||[];
  return <>
    <div className="page-head"><div><div className="eyebrow">Diagnóstico temporal · #44</div><h1>Piloto PikoQuality B</h1><p>Compara los datos técnicos que ya existen en Neon con el detalle de streams que Plex entrega realmente. No modifica la biblioteca ni persiste streams: solo registra el resultado seguro en pipeline_runs.</p></div><ActionButton action={runPikoQualityBProbeAction} label="Ejecutar piloto B" pendingLabel="Consultando muestra en Plex…"/></div>
    <p><Link href="/admin">← Volver a Administración</Link></p>
    {!run?<div className="empty-state"><b>Todavía no se ha ejecutado el piloto.</b><p>La muestra incluye películas y episodios antiguos, intermedios y modernos.</p></div>:<>
      <div className="mini-kpis"><div className="kpi"><span>Muestras</span><b>{coverage.samples??run.processed_count??0}</b></div><div className="kpi"><span>Con streams</span><b>{coverage.with_streams??0}</b></div><div className="kpi"><span>Bit depth</span><b>{coverage.bit_depth??0}</b></div><div className="kpi"><span>Audio bitrate</span><b>{coverage.audio_bitrate??0}</b></div></div>
      <div className="info-banner">Última prueba: {dt(run.started_at)} · estado {run.status} · HDR/DV detectado en {coverage.hdr_signal??0} · múltiples pistas de audio en {coverage.multiple_audio??0} · subtítulos en {coverage.subtitles??0}.</div>
      <div className="table-wrap"><table><thead><tr><th>Tipo</th><th>Título</th><th>A (resumen)</th><th>Streams</th><th>Vídeo B</th><th>Audio B</th><th>Bit depth</th><th>Color</th><th>HDR/DV</th><th>Subs</th></tr></thead><tbody>{rows.map(r=>{const b=r.phase_b||{},v=b.video?.[0]||{},a=b.audio?.[0]||{};return <tr key={r.rating_key}><td>{r.type}</td><td><b>{r.title}</b><br/><small>{r.year||'—'} · bucket {r.bucket}</small></td><td>{r.phase_a?.resolution||'—'} · {r.phase_a?.video_codec||'—'} · {r.phase_a?.audio_codec||'—'}</td><td>{b.stream_count??0} ({b.video_streams??0}V/{b.audio_streams??0}A/{b.subtitle_streams??0}S)</td><td>{v.codec||'—'} {v.bitrate?`· ${v.bitrate} kbps`:''}</td><td>{a.codec||'—'} {a.channels?`· ${a.channels}ch`:''} {a.bitrate?`· ${a.bitrate} kbps`:''}</td><td>{v.bit_depth??'—'}</td><td>{yn(b.has_color_space||b.has_chroma)}</td><td>{yn(b.has_hdr_signal)}</td><td>{b.subtitle_streams??0}</td></tr>})}</tbody></table></div>
      <details className="process-card"><summary><b>Detalle técnico seguro</b></summary><pre className="json-summary">{JSON.stringify(summary,null,2)}</pre></details>
    </>}
  </>;
}

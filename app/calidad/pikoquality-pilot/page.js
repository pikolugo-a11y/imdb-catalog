import Link from 'next/link';
import {runPikoQualityBPilot} from '../../../lib/pikoquality-pilot';

export const dynamic='force-dynamic';
const fmt=v=>v==null||v===''?'—':String(v);
const mb=v=>v?`${(Number(v)/1024/1024).toFixed(0)} MB`:'—';
const dur=v=>v?`${Math.round(Number(v)/60000)} min`:'—';

export default async function PikoQualityPilot({searchParams}){
  const sp=await searchParams;const run=sp?.run==='1';let data=null,error=null;
  if(run){try{data=await runPikoQualityBPilot()}catch(e){error=String(e?.message||e)}}
  return <>
    <div className="hero"><div><div className="eyebrow">#44 · prueba segura</div><h1>Piloto PikoQuality B</h1><p>Compara los datos ya persistidos (A) con los streams detallados que Plex puede aportar (B). Solo lectura: no modifica Plex ni Neon.</p></div><div className="actions"><Link className="btn" href="/calidad">← Calidad</Link><Link className="btn primary" href="/calidad/pikoquality-pilot?run=1">Ejecutar piloto B</Link></div></div>
    {!run&&<div className="card"><h2>Qué va a hacer</h2><p>Seleccionará automáticamente una muestra pequeña de películas y episodios antiguos/modernos y consultará únicamente su metadata detallada en Plex.</p><p><strong>No guarda nada.</strong> Puedes ejecutarlo sin riesgo.</p></div>}
    {error&&<div className="card"><h2>Error del piloto</h2><p>{error}</p></div>}
    {data&&<>
      <div className="stats-grid">
        <div className="stat"><span>Probados</span><strong>{data.gains.tested}</strong></div><div className="stat"><span>Streams</span><strong>{data.gains.withStreams}</strong></div><div className="stat"><span>Bit depth</span><strong>{data.gains.withBitDepth}</strong></div><div className="stat"><span>HDR / DV</span><strong>{data.gains.withDynamicRange}</strong></div><div className="stat"><span>Bitrate vídeo</span><strong>{data.gains.withVideoBitrate}</strong></div><div className="stat"><span>Bitrate audio</span><strong>{data.gains.withAudioBitrate}</strong></div><div className="stat"><span>Audio múltiple</span><strong>{data.gains.withMultipleAudio}</strong></div><div className="stat"><span>Subtítulos</span><strong>{data.gains.withSubtitles}</strong></div>
      </div>
      <div className="card"><h2>Comparación A → B</h2><p className="muted">B muestra exclusivamente lo que Plex devolvió ahora desde Media → Part → Stream.</p>
        <div style={{overflowX:'auto'}}><table><thead><tr><th>Título</th><th>A · actual</th><th>B · streams Plex</th></tr></thead><tbody>{data.results.map((x,i)=><tr key={x.ratingKey||i}><td><strong>{x.title}</strong><br/><span className="muted">{x.type==='episode'?`Episodio T${x.season??'?'}E${x.episode??'?'}`:'Película'} · {fmt(x.year)}</span></td><td>{x.ok?<><div>{fmt(x.a.resolution)} · {fmt(x.a.dimensions)}</div><div>{fmt(x.a.video)} · {fmt(x.a.bitrate)} kbps</div><div>{fmt(x.a.audio)}</div><div className="muted">{mb(x.a.size)} · {dur(x.a.duration)}</div></>:<span>—</span>}</td><td>{x.ok?<><div><strong>{x.b.streamCount} streams</strong> · V{x.b.videoStreams}/A{x.b.audioStreams}/S{x.b.subtitleStreams}</div><div>Vídeo: {fmt(x.b.videoCodecs)} · {fmt(x.b.videoBitrate)} kbps</div><div>Bit depth/HDR: {fmt(x.b.bitDepth)} · {fmt(x.b.dynamicRange)}</div><div>Audio: {fmt(x.b.audioCodecs)} · {fmt(x.b.audioBitrate)} kbps</div><div className="muted">Color: {fmt(x.b.color)} · Subs: {fmt(x.b.subtitleLanguages)}</div></>:<span>{x.error}</span>}</td></tr>)}</tbody></table></div>
      </div>
    </>}
  </>
}

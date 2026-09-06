import './ficha-v4.css';

export default function LoadingFicha(){
  return <main className="ficha-v4">
    <div className="fv4-back"><span>Cargando ficha…</span></div>
    <section className="fv4-hero" aria-busy="true">
      <div className="fv4-poster-wrap"><div className="fv4-poster-ph"/></div>
      <div className="fv4-identity"><div className="fv4-kicker"><span>PikoFilm</span></div><h1 style={{opacity:.45}}>Cargando…</h1><p className="fv4-muted">Recuperando la información de la obra.</p></div>
      <section className="fv4-score-block"><div className="fv4-score-main"><span>★ PikoScore</span><strong>—</strong><small>Cargando</small></div></section>
    </section>
  </main>;
}

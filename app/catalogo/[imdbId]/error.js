'use client';

export default function FichaError({reset}){
  return <main className="ficha-v4">
    <section className="fv4-secondary-panel" style={{maxWidth:760,margin:'36px auto'}}>
      <div className="fv4-section-head"><div><span>Ficha</span><h2>No se pudo cargar la obra</h2></div></div>
      <p className="fv4-muted">La información imprescindible de la ficha no está disponible ahora mismo. No se han inventado ni sustituido datos.</p>
      <button className="fv4-exclude" style={{marginTop:16}} onClick={()=>reset()}>Reintentar</button>
    </section>
  </main>;
}

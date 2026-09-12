'use client';

export default function Error({reset}){
  return <main style={{maxWidth:760,margin:'64px auto',padding:'24px'}}>
    <section className="empty-state" style={{display:'grid',gap:12}}>
      <strong>No se pudo cargar esta página</strong>
      <p>PikoFilm ha encontrado un problema inesperado. Puedes volver a intentarlo sin perder el resto de la aplicación.</p>
      <div><button className="button" onClick={()=>reset()}>↻ Reintentar</button></div>
    </section>
  </main>;
}

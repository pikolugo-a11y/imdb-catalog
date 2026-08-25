'use client';
import './quality-dashboard.css';

export default function Error({reset}){
  return <main className="qh-error" role="alert">
    <section className="qh-error-card">
      <div className="eyebrow">Calidad</div>
      <h2>No se ha podido cargar el estado de Calidad</h2>
      <p>El resto de PikoFilm sigue disponible. Puedes reintentar la lectura del Lifecycle.</p>
      <button type="button" onClick={()=>reset()}>Reintentar</button>
    </section>
  </main>;
}

import './loading.css';

export default function Loading(){
  return <div className="v4-page-loading" role="status" aria-live="polite" aria-busy="true">
    <span className="v4-page-loading-mark" aria-hidden="true">P</span>
    <div><strong>Cargando PikoFilm…</strong><small>Actualizando la vista con los datos más recientes.</small></div>
  </div>;
}

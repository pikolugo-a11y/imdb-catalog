import './quality-dashboard.css';

export default function Loading(){
  return <main className="quality-home qh-page qh-loading" aria-label="Cargando Calidad">
    <div className="qh-loading-head"><span className="qh-skeleton"/><span className="qh-skeleton"/></div>
    <span className="qh-skeleton qh-loading-summary"/>
    <div className="qh-loading-flow" aria-hidden="true">
      <span className="qh-skeleton"/><span className="qh-skeleton"/><span className="qh-skeleton"/><span className="qh-skeleton"/>
      <span className="qh-skeleton"/><span className="qh-skeleton"/>
    </div>
  </main>;
}

'use client';
import './validation.css';
export default function Error({reset}){return <div className="iv-page"><section className="iv-empty" role="alert"><b>No se ha podido cargar Validación de identidad</b><span>La incidencia está aislada en esta pantalla. Puedes reintentar sin perder el resto de PikoFilm.</span><button onClick={()=>reset()}>Reintentar</button></section></div>}

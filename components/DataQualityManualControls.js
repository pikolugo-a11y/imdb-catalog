import {DATA_FIELDS} from '@/lib/data-quality';
import {MANUAL_RATING_SOURCES} from '@/lib/data-quality-manual';
import {saveManualDataAction,acceptIncompleteDataAction,saveManualRatingAction,fixRatingsAtFiveAction} from '@/app/calidad/datos/actions';

function inputFor(field){
  if(field==='type')return <select name="value" required defaultValue=""><option value="" disabled>Selecciona tipo</option><option>Película</option><option>Serie</option><option>Miniserie</option></select>;
  if(field==='overview')return <textarea name="value" rows="3" required placeholder="Introduce la sinopsis…"/>;
  if(field==='year')return <input name="value" type="number" min="1801" max="2200" required placeholder="Año"/>;
  if(field==='runtime')return <input name="value" type="number" min="1" max="2000" required placeholder="Minutos"/>;
  if(field==='release_date')return <input name="value" type="date" required/>;
  if(field==='genres')return <input name="value" required placeholder="Drama, Comedia, Thriller…"/>;
  if(field==='poster_path'||field==='backdrop_path')return <input name="value" required placeholder="URL completa o path de TMDb"/>;
  return <input name="value" required placeholder={`Valor para ${DATA_FIELDS[field]?.label||field}`}/>;
}

export default function DataQualityManualControls({r}){
  const missing=r.missing||[];
  return <div className="dq-manual">
    <details className="dq-details dq-manual-panel"><summary>Edición / decisión manual</summary>
      <div className="dq-manual-block">
        <b>Datos</b>
        {missing.length?<div className="dq-manual-fields">{missing.map(field=><form action={saveManualDataAction} key={field} className="dq-manual-form"><input type="hidden" name="imdbId" value={r.imdb_id}/><input type="hidden" name="field" value={field}/><label>{DATA_FIELDS[field]?.label||field}</label>{inputFor(field)}<button type="submit">Guardar</button></form>)}</div>:<small>No faltan campos de datos.</small>}
        {!r.dataReady&&<form action={acceptIncompleteDataAction} className="dq-manual-decision"><input type="hidden" name="imdbId" value={r.imdb_id}/><button type="submit" className="button ghost">Dar datos por revisados y avanzar</button><small>Conserva los huecos visibles, pero deja de bloquear Lifecycle.</small></form>}
      </div>
      <div className="dq-manual-block">
        <b>Ratings manuales</b>
        <form action={saveManualRatingAction} className="dq-rating-manual-form"><input type="hidden" name="imdbId" value={r.imdb_id}/><select name="source" required defaultValue=""><option value="" disabled>Fuente</option>{Object.entries(MANUAL_RATING_SOURCES).map(([key,x])=><option value={key} key={key}>{x.label} (0–{x.scale})</option>)}</select><input name="rating" type="number" min="0" step="0.01" required placeholder="Puntuación"/><input name="votes" type="number" min="0" step="1" placeholder="Votos (opcional)"/><button type="submit">Guardar rating</button></form>
        {!r.manualRatingsFixed&&<form action={fixRatingsAtFiveAction} className="dq-manual-decision"><input type="hidden" name="imdbId" value={r.imdb_id}/><button type="submit" className="button ghost">Cerrar ratings con PikoScore 5,0</button><small>Decisión manual permanente: no necesita fuentes ni recálculo automático.</small></form>}
        {r.manualRatingsFixed&&<small className="dq-manual-note">✓ Ratings cerrados manualmente · PikoScore fijo 5,0</small>}
      </div>
    </details>
  </div>;
}

import ConfirmSubmitButton from '@/components/ConfirmSubmitButton';
import {formatMadridDateTime} from '@/lib/format-madrid';
import {setSeriesManualCompleteAction} from '../manual-complete-actions';

export default function SeriesPhysicalManualCard({ratingKey,summary}){
  const physical=summary?.physicalLocation||{},locations=physical.locations||[],manual=Boolean(summary?.manual_complete);
  return <div className="review-bottom-grid">
    <section className="review-card">
      <h3>Ubicación física</h3>
      {locations.length?<><p>Carpeta{locations.length>1?'s':''} detectada{locations.length>1?'s':''} desde Plex:</p><div className="context-ids">{locations.map(x=><code key={x}>{x}</code>)}</div>{!physical.complete&&<p>La ruta está incompleta para parte de los archivos. Se completará al refrescar Plex.</p>}</>:physical.fileCount>0?<p>PikoFilm todavía conserva sólo el nombre de archivo. Pulsa <b>Actualizar Plex</b> una vez para registrar la ruta completa de esta serie.</p>:<p>Plex no ha devuelto archivos físicos para esta serie.</p>}
      {!!physical.fileCount&&<small>{physical.fileCount} archivo{physical.fileCount===1?'':'s'} físico{physical.fileCount===1?'':'s'} registrado{physical.fileCount===1?'':'s'}.</small>}
    </section>
    <section className="review-card">
      <h3>Ajuste manual de cobertura</h3>
      {manual?<><strong className="ok">Serie cuadrada manualmente</strong><p>Todos los episodios oficiales se tratan como disponibles en Calidad. La evidencia física de Plex y el diagnóstico original se conservan.</p>{summary.manual_complete_at&&<small>Decidido: {formatMadridDateTime(summary.manual_complete_at,{fallback:'—'})}</small>}<form action={setSeriesManualCompleteAction}><input type="hidden" name="ratingKey" value={ratingKey}/><input type="hidden" name="mode" value="reopen"/><ConfirmSubmitButton pendingLabel="Restaurando…" message="¿Volver al diagnóstico automático de esta serie? Reaparecerán los faltantes y anomalías que sigan existiendo.">Volver al diagnóstico automático</ConfirmSubmitButton></form></>:<><p>Para casos excepcionales en los que la referencia no puede reconciliarse de forma fiable. PikoFilm dejará de mostrar episodios pendientes, pero no modificará Plex ni borrará el diagnóstico físico.</p><form action={setSeriesManualCompleteAction}><input type="hidden" name="ratingKey" value={ratingKey}/><input type="hidden" name="mode" value="mark"/><ConfirmSubmitButton pendingLabel="Guardando…" message="¿Marcar toda la serie como cuadrada manualmente? PikoFilm dejará de mostrar episodios pendientes, pero no modificará Plex ni borrará el diagnóstico físico.">Marcar serie como cuadrada</ConfirmSubmitButton></form></>}
    </section>
  </div>;
}

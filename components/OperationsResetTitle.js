'use client';
import {useActionState} from 'react';
import Link from 'next/link';
import {resetTitleToNewsAction} from '@/app/admin/actions';

const initial={ok:null,message:''};
export default function OperationsResetTitle(){
  const[state,action,pending]=useActionState(resetTitleToNewsAction,initial);
  return <section className="ops-panel ops-reset-panel">
    <div className="ops-panel-head"><div><span className="ops-label">Mantenimiento</span><h2>Reiniciar desde Novedades</h2></div></div>
    <p className="ops-reset-copy">Retira un título del catálogo y elimina su estado derivado para volver a introducirlo desde Novedades. El historial de Operaciones se conserva.</p>
    <form action={action} className="ops-reset-form">
      <label>IMDb del título<input name="imdbId" required pattern="tt[0-9]+" placeholder="tt1234567" autoComplete="off"/></label>
      <label>Confirma escribiendo el mismo IMDb<input name="confirmImdb" required pattern="tt[0-9]+" placeholder="tt1234567" autoComplete="off"/></label>
      <button className="ops-danger" disabled={pending}>{pending?'Reiniciando…':'Reiniciar desde Novedades'}</button>
    </form>
    {state?.message&&<div className={`ops-reset-result ${state.ok?'ok':'bad'}`}><strong>{state.ok?'Operación completada':'No se ha reiniciado'}</strong><span>{state.message}</span>{state.ok&&state.imdbId&&<Link href={`/novedades?imdb=${encodeURIComponent(state.imdbId)}`}>Abrir Novedades →</Link>}{state.runId&&<Link href={`/admin/runs/${state.runId}`}>Ver ejecución →</Link>}</div>}
    <small className="ops-reset-warning">Acción destructiva controlada: si aparece una dependencia no contemplada, el reinicio se bloquea antes de borrar.</small>
  </section>
}

'use client';
import {useActionState,useMemo,useState} from 'react';
import Link from '@/components/NoPrefetchLink';
import {enqueuePikoRelevanceSelectionAction} from './actions';

const fmt=v=>v==null?'—':Number(v).toFixed(1);
export default function RelevanceQueueTable({rows=[]}){
  const [state,formAction,pending]=useActionState(enqueuePikoRelevanceSelectionAction,null);
  const [selected,setSelected]=useState([]);
  const selectable=useMemo(()=>rows.filter(r=>!['queued','leased','running'].includes(r.queue_status)).map(r=>r.imdb_id),[rows]);
  const all=selectable.length>0&&selectable.every(id=>selected.includes(id));
  const toggle=id=>setSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);
  const toggleAll=()=>setSelected(all?selected.filter(id=>!selectable.includes(id)):[...new Set([...selected,...selectable])]);
  return <form action={formAction} className="relq-form">
    <div className="relq-actions"><label><input type="checkbox" checked={all} onChange={toggleAll} disabled={!selectable.length||pending}/> Seleccionar página</label><button disabled={pending||!selected.length}>{pending?'Encolando…':`Calcular seleccionadas · ${selected.length}`}</button></div>
    {state?.message&&<p className={state.ok?'relq-message ok':'relq-message error'}>{state.message}</p>}
    <div className="relq-table-shell"><table><thead><tr><th aria-label="Seleccionar"/><th>Serie</th><th>Año</th><th className="num">PikoScore</th><th>Estado</th><th/></tr></thead><tbody>{rows.map(r=>{const busy=['queued','leased','running'].includes(r.queue_status);return <tr key={r.imdb_id}><td><input type="checkbox" name="imdbId" value={r.imdb_id} checked={selected.includes(r.imdb_id)} onChange={()=>toggle(r.imdb_id)} disabled={busy||pending}/></td><td><Link href={`/catalogo/${r.imdb_id}`}>{r.display_title}</Link><small>{r.imdb_id}</small></td><td>{r.year||'—'}</td><td className="num score">{fmt(r.final_rating)}</td><td>{busy?<span className="queued">{r.queue_status==='running'?'Calculando':'En cola'}</span>:<span className="pending">Pendiente</span>}</td><td><button name="singleImdbId" value={r.imdb_id} disabled={busy||pending}>{busy?'En cola':'Calcular'}</button></td></tr>})}</tbody></table></div>
  </form>;
}

'use client';
import Link from '@/components/NoPrefetchLink';
import {useEffect,useMemo,useRef,useState} from 'react';

const classify=item=>{const r=item.result||{};if(['queued','running'].includes(item.technicalStatus))return{kind:'running',label:'Procesando',href:null};if(item.technicalStatus==='failed')return{kind:'error',label:'Error técnico',href:`/admin/runs/${item.runId}`};if(r.state==='COMPLETE')return{kind:'done',label:'Completada',href:`/catalogo/${item.imdbId}`};if(r.blocked_in)return{kind:r.human_decision?'attention':'error',label:r.human_decision?'Necesita revisión':'Se detuvo',href:r.blocked_in};if(item.technicalStatus==='partial'||item.functionalResult==='pending')return{kind:'attention',label:'Necesita atención',href:`/admin/runs/${item.runId}`};return{kind:'done',label:'Finalizada',href:`/catalogo/${item.imdbId}`};};
const time=v=>{if(!v)return'';try{return new Intl.DateTimeFormat('es-ES',{hour:'2-digit',minute:'2-digit'}).format(new Date(v))}catch{return''}};

export default function LifecycleActivity(){
 const[items,setItems]=useState([]),[open,setOpen]=useState(false),[toast,setToast]=useState(null);const previous=useRef(new Map());
 useEffect(()=>{let cancelled=false,timer;const load=async()=>{try{const r=await fetch('/api/lifecycle-activity',{cache:'no-store'}),d=await r.json();if(cancelled)return;const next=Array.isArray(d.items)?d.items:[];for(const item of next){const before=previous.current.get(item.runId),now=classify(item);if(before==='running'&&now.kind!=='running')setToast({...item,...now});previous.current.set(item.runId,now.kind)}setItems(next)}catch{}timer=setTimeout(load,items.some(x=>classify(x).kind==='running')?4000:12000)};load();return()=>{cancelled=true;clearTimeout(timer)}},[]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(null),7000);return()=>clearTimeout(t)},[toast]);
 const unread=useMemo(()=>items.filter(x=>classify(x).kind==='running').length,[items]);
 return <div className="v4-activity">
  <button type="button" className="v4-activity-button" aria-expanded={open} onClick={()=>setOpen(v=>!v)} title="Actividad de procesamiento">◎{unread>0?<span>{unread}</span>:null}</button>
  {open?<div className="v4-activity-panel"><div className="v4-activity-head"><b>Actividad reciente</b><small>Lifecycle automático</small></div>{items.length?items.map(item=>{const s=classify(item),body=<><span className={`v4-activity-dot ${s.kind}`}/><span><b>{item.title}</b><small>{s.label}{time(item.finishedAt||item.requestedAt)?` · ${time(item.finishedAt||item.requestedAt)}`:''}</small></span></>;return s.href?<Link key={item.runId} href={s.href} onClick={()=>setOpen(false)}>{body}</Link>:<div key={item.runId}>{body}</div>}):<p>No hay actividad reciente.</p>}</div>:null}
  {toast?<div className={`v4-activity-toast ${toast.kind}`}><b>{toast.kind==='done'?'✓':toast.kind==='attention'?'⚠':'✕'} {toast.title}</b><span>{toast.label}</span>{toast.href?<Link href={toast.href}>Abrir</Link>:null}</div>:null}
 </div>;
}

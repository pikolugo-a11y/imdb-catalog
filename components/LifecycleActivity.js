'use client';
import Link from '@/components/NoPrefetchLink';
import {useEffect,useMemo,useRef,useState} from 'react';

const SEEN_KEY='pikofilm:lifecycle-seen:v1';
const classify=item=>{const r=item.result||{};if(['queued','running'].includes(item.technicalStatus))return{kind:'running',label:'Procesando',href:null};if(item.technicalStatus==='failed')return{kind:'error',label:'Error técnico',href:`/admin/runs/${item.runId}`};if(r.state==='COMPLETE')return{kind:'done',label:'Completada',href:`/catalogo/${item.imdbId}`};if(r.blocked_in)return{kind:r.human_decision?'attention':'error',label:r.human_decision?'Necesita revisión':'Se detuvo',href:r.blocked_in};if(item.technicalStatus==='partial'||item.functionalResult==='pending')return{kind:'attention',label:'Necesita atención',href:`/admin/runs/${item.runId}`};return{kind:'done',label:'Finalizada',href:`/catalogo/${item.imdbId}`};};
const time=v=>{if(!v)return'';try{return new Intl.DateTimeFormat('es-ES',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(v))}catch{return''}};
const loadSeen=()=>{try{return new Set(JSON.parse(localStorage.getItem(SEEN_KEY)||'[]'))}catch{return new Set()}};
const saveSeen=s=>{try{localStorage.setItem(SEEN_KEY,JSON.stringify([...s].slice(-100)))}catch{}};

export default function LifecycleActivity(){
 const[items,setItems]=useState([]),[open,setOpen]=useState(false),[toast,setToast]=useState(null),[seen,setSeen]=useState(new Set());const previous=useRef(new Map());
 useEffect(()=>setSeen(loadSeen()),[]);
 useEffect(()=>{let cancelled=false,timer;const load=async()=>{try{const r=await fetch('/api/lifecycle-activity',{cache:'no-store'}),d=await r.json();if(cancelled)return;const next=Array.isArray(d.items)?d.items:[];for(const item of next){const before=previous.current.get(item.runId),now=classify(item);if(before==='running'&&now.kind!=='running')setToast({...item,...now});previous.current.set(item.runId,now.kind)}setItems(next)}catch{}timer=setTimeout(load,4000)};load();return()=>{cancelled=true;clearTimeout(timer)}},[]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(null),7000);return()=>clearTimeout(t)},[toast]);
 const unread=useMemo(()=>items.filter(x=>classify(x).kind!=='running'&&!seen.has(x.runId)).length,[items,seen]);
 const running=useMemo(()=>items.filter(x=>classify(x).kind==='running').length,[items]);
 const markSeen=runId=>{if(!runId)return;setSeen(prev=>{const next=new Set(prev);next.add(runId);saveSeen(next);return next})};
 const openPanel=()=>{setOpen(v=>!v)};
 return <div className="v4-activity">
  <button type="button" className="v4-activity-button" aria-expanded={open} onClick={openPanel} title="Actividad de procesamiento">◎{unread>0?<span>{unread}</span>:running>0?<span>{running}</span>:null}</button>
  {open?<div className="v4-activity-panel"><div className="v4-activity-head"><b>Actividad reciente</b><small>{unread?`${unread} resultado${unread===1?'':'s'} sin ver`:running?`${running} en curso`:'Todo visto'}</small></div>{items.length?items.map(item=>{const s=classify(item),isUnread=s.kind!=='running'&&!seen.has(item.runId),body=<><span className={`v4-activity-dot ${s.kind}`}/><span><b>{isUnread?'● ':''}{item.title}</b><small>{s.label}{time(item.finishedAt||item.requestedAt)?` · ${time(item.finishedAt||item.requestedAt)}`:''}</small></span></>;return s.href?<Link key={item.runId} href={s.href} onClick={()=>{markSeen(item.runId);setOpen(false)}}>{body}</Link>:<div key={item.runId}>{body}</div>}):<p>No hay actividad reciente.</p>}</div>:null}
  {toast?<div className={`v4-activity-toast ${toast.kind}`}><b>{toast.kind==='done'?'✓':toast.kind==='attention'?'⚠':'✕'} {toast.title}</b><span>{toast.label} · quedará guardado en Actividad</span>{toast.href?<Link href={toast.href} onClick={()=>markSeen(toast.runId)}>Abrir</Link>:null}</div>:null}
 </div>;
}

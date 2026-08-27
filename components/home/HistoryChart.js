'use client';
import {useState} from 'react';
import {nf,pct,one} from '@/lib/home-format';

const SERIES={plex:{label:'Plex',key:'plex',format:n=>nf(n)},catalog:{label:'Catálogo',key:'catalog',format:n=>nf(n)},missing:{label:'Pendientes',key:'missing',format:n=>nf(n)},quality:{label:'Calidad',key:'quality',format:n=>pct(n)}};

function Delta({now,then,type='count'}){
  if(now==null||then==null)return <span className="delta flat">sin histórico comparable</span>;
  const d=Number(now)-Number(then);
  if(Math.abs(d)<.05)return <span className="delta flat">→ estable</span>;
  return <span className={`delta ${d>0?'up':'down'}`}>{d>0?'↑':'↓'} {type==='pp'?one(Math.abs(d))+' pp':nf(Math.abs(d))}</span>;
}

export default function HistoryChart({rows=[]}){
  const [series,setSeries]=useState('plex');
  if(rows.length<2)return <div className="empty-state"><b>Estamos construyendo tu histórico comparable</b><p>{rows.length===1?'Hay 1 día válido registrado.':'Todavía no hay snapshots con el esquema actual.'} Los datos aparecerán aquí sin reconstruir pasado incompatible.</p></div>;
  const first=rows[0],last=rows.at(-1),cfg=SERIES[series];
  const vals=rows.map(r=>Number(r[cfg.key])).filter(Number.isFinite),min=Math.min(...vals),max=Math.max(...vals),span=Math.max(max-min,1);
  const points=rows.map((r,i)=>{const x=rows.length===1?50:(i/(rows.length-1))*100;const v=Number(r[cfg.key]);const y=Number.isFinite(v)?92-((v-min)/span)*78:92;return`${x},${y}`}).join(' ');
  return <div className="history-v4">
    <div className="history-summary"><article><span>Catálogo</span><b>{nf(last.catalog)}</b><Delta now={last.catalog} then={first.catalog}/></article><article><span>En Plex</span><b>{nf(last.plex)}</b><Delta now={last.plex} then={first.plex}/></article><article><span>Pendientes</span><b>{nf(last.missing)}</b><Delta now={last.missing} then={first.missing}/></article><article><span>Calidad</span><b>{pct(last.quality)}</b><Delta now={last.quality} then={first.quality} type="pp"/></article></div>
    <div className="history-series-tabs">{Object.entries(SERIES).map(([id,s])=><button key={id} className={series===id?'active':''} onClick={()=>setSeries(id)}>{s.label}</button>)}</div>
    <div className="history-line-wrap"><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`Evolución de ${cfg.label}`}><polyline points={points} fill="none" vectorEffect="non-scaling-stroke"/></svg><div className="history-axis"><span>{rows[0].date}</span><b>{cfg.format(last[cfg.key])}</b><span>{last.date}</span></div></div>
    <p className="history-availability">{rows.length} días comparables disponibles con el esquema actual.</p>
  </div>;
}

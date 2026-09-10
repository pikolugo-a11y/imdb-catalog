import Link from '@/components/NoPrefetchLink';
import {getActivityTimeline,getActivityCalendar,getActivitySummary,getActivityRunDetail} from '@/lib/activity-v4';
import {reschedulePlan,setPlanPriority,togglePlanProtection,toggleDeliberatePeak,recalculatePlanningNow} from './actions';
import ActivityRefresh from './ActivityRefresh';
import './actividad-v4.css';

export const dynamic='force-dynamic';
const TZ='Europe/Madrid',DAY=86400000;
const FILTERS=[['todo','Todo'],['catalogo','Catálogo'],['plex','Plex'],['calidad','Calidad'],['personas','Personas'],['sagas','Sagas'],['novedades','Novedades'],['errores','Errores']];
const fmtDate=v=>new Intl.DateTimeFormat('es-ES',{timeZone:TZ,day:'2-digit',month:'short',year:'numeric'}).format(new Date(v));
const fmtTime=v=>new Intl.DateTimeFormat('es-ES',{timeZone:TZ,hour:'2-digit',minute:'2-digit'}).format(new Date(v));
const fmtDayName=v=>new Intl.DateTimeFormat('es-ES',{timeZone:TZ,weekday:'short'}).format(new Date(v));
const fmtDayNumber=v=>new Intl.DateTimeFormat('es-ES',{timeZone:TZ,day:'numeric'}).format(new Date(v));
const fmtMonthShort=v=>new Intl.DateTimeFormat('es-ES',{timeZone:TZ,month:'short'}).format(new Date(v));
const dateKey=v=>new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v));
function madridInputValue(v){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(v)).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;}
function dayLabel(value){const key=dateKey(value),today=dateKey(Date.now()),yesterday=dateKey(Date.now()-DAY);return key===today?'Hoy':key===yesterday?'Ayer':fmtDate(value)}
function href(base,params){const q=new URLSearchParams(Object.entries(params).filter(([,v])=>v!==undefined&&v!==null&&v!==''));return `${base}?${q}`;}
function groupTimeline(items){const groups=[];for(const item of items){const label=dayLabel(item.requested_at);let group=groups.at(-1);if(!group||group.label!==label){group={label,items:[]};groups.push(group)}group.items.push(item)}return groups;}
function entityImdbId(item){if(String(item.entity_id||'').startsWith('tt'))return item.entity_id;const id=item.after_compact?.imdb_id;return String(id||'').startsWith('tt')?id:null;}
function madridNoon(key){return new Date(`${key}T12:00:00+02:00`);}
function addDaysKey(key,days){return dateKey(new Date(madridNoon(key).getTime()+days*DAY));}
function mondayKey(key){const d=madridNoon(key),weekday=Number(new Intl.DateTimeFormat('en-GB',{timeZone:TZ,weekday:'short'}).format(d)==='Sun'?7:['Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(new Intl.DateTimeFormat('en-GB',{timeZone:TZ,weekday:'short'}).format(d))+1);return addDaysKey(key,-(weekday-1));}
function buildCalendarDays(startKey,endKey,plans,overloads){
  const map=new Map();for(const plan of plans){if(!plan.planned_at)continue;const key=dateKey(plan.planned_at),row=map.get(key)||[];row.push(plan);map.set(key,row);}
  const overloadMap=new Map((overloads||[]).map(x=>[String(x.day),x])),gridStart=mondayKey(startKey),endMonday=mondayKey(endKey),gridEnd=addDaysKey(endMonday,6),days=[];
  for(let key=gridStart;;key=addDaysKey(key,1)){const dayPlans=map.get(key)||[],volume=dayPlans.reduce((n,x)=>n+Number(x.planned_volume||0),0),overload=overloadMap.get(key),titles=new Map();for(const p of dayPlans)titles.set(p.title,(titles.get(p.title)||0)+Number(p.planned_volume||0));days.push({key,date:madridNoon(key),plans:dayPlans,volume,overload,titles:[...titles.entries()],inRange:key>=startKey&&key<=endKey});if(key===gridEnd)break;}
  return days;
}
function CalendarCard({plan}){return <article className={`av4-plan ${plan.attention?'attention':''}`}>
  <div className="av4-plan-head"><div><b>{plan.title}</b><small>{plan.statusLabel} · {plan.planned_volume} tareas · carga {plan.loadLabel.toLowerCase()}</small></div><span className={`av4-load ${plan.loadLabel.toLowerCase()}`}>{plan.loadLabel}</span></div>
  <div className="av4-plan-meta">{plan.planned_at?<span>{fmtDate(plan.planned_at)} · {fmtTime(plan.planned_at)}</span>:<span>Sin fecha asignada</span>}<span>Prioridad {plan.priority}</span>{plan.protected&&<span>Fijado</span>}{plan.deliberate_peak&&<span>Pico deliberado</span>}</div>
  <details><summary>Planificar</summary><div className="av4-plan-actions">
    <form action={reschedulePlan}><input type="hidden" name="planId" value={plan.plan_id}/><input name="plannedAt" type="datetime-local" defaultValue={plan.planned_at?madridInputValue(plan.planned_at):''}/><button>Reprogramar</button></form>
    <form action={setPlanPriority}><input type="hidden" name="planId" value={plan.plan_id}/><input name="priority" type="number" min="0" max="100" defaultValue={plan.priority}/><button>Cambiar prioridad</button></form>
    <form action={togglePlanProtection}><input type="hidden" name="planId" value={plan.plan_id}/><input type="hidden" name="value" value={plan.protected?'false':'true'}/><button>{plan.protected?'Permitir redistribución':'Fijar planificación'}</button></form>
    <form action={toggleDeliberatePeak}><input type="hidden" name="planId" value={plan.plan_id}/><input type="hidden" name="value" value={plan.deliberate_peak?'false':'true'}/><button>{plan.deliberate_peak?'Quitar pico deliberado':'Mantener como pico'}</button></form>
  </div></details>
</article>}
function CalendarDay({day,selected}){
  if(!day.inRange)return <div className="av4-calendar-cell outside" aria-hidden="true"><span className="av4-calendar-date">{fmtDayNumber(day.date)}</span></div>;
  const empty=day.volume===0,attention=Boolean(day.overload)||day.plans.some(x=>x.attention),level=day.overload?'alta':day.plans.some(x=>String(x.loadLabel).toLowerCase()==='media')?'media':'baja';
  return <Link href={href('/actividad',{vista:'calendario',dia:day.key})} className={`av4-calendar-cell ${empty?'empty':''} ${attention?'attention':''} ${selected?'selected':''}`}>
    <div className="av4-calendar-cell-head"><div><strong>{fmtDayNumber(day.date)}</strong><span>{fmtMonthShort(day.date)}</span></div>{empty?<em>Libre</em>:<span className={`av4-day-load ${level}`}>{level}</span>}</div>
    {empty?<div className="av4-calendar-free">Sin trabajo planificado</div>:<><div className="av4-calendar-volume"><strong>{day.volume}</strong><span>tareas</span></div><div className="av4-calendar-events">{day.titles.slice(0,3).map(([title,volume])=><div key={title}><span>{title}</span><b>{volume}</b></div>)}{day.titles.length>3&&<small>+{day.titles.length-3} tipos más</small>}</div></>}
  </Link>;
}

export default async function ActivityPage({searchParams}){
  const sp=await searchParams,view=sp?.vista==='calendario'?'calendario':'cronologia',domain=sp?.filtro||'todo',q=sp?.q||'',page=Math.max(1,Number(sp?.pagina)||1),detailId=sp?.run||null;
  const [summary,calendar,timeline,detail]=await Promise.all([getActivitySummary(),getActivityCalendar(),getActivityTimeline({domain,q,page}),detailId?getActivityRunDetail(detailId):null]);
  const groups=groupTimeline(timeline.items),dated=calendar.plans.filter(x=>x.planned_at),pending=calendar.plans.filter(x=>!x.planned_at),startKey=dateKey(Date.now()),endKey=addDaysKey(startKey,29),calendarDays=buildCalendarDays(startKey,endKey,dated,calendar.overloads),requestedDay=String(sp?.dia||''),selectedKey=/^\d{4}-\d{2}-\d{2}$/.test(requestedDay)&&requestedDay>=startKey&&requestedDay<=endKey?requestedDay:startKey,selected=calendarDays.find(x=>x.key===selectedKey)||null;
  return <main className="av4-shell"><ActivityRefresh/>
    <header className="av4-title"><div><p>ACTIVIDAD</p><h1>Qué está haciendo PikoFilm</h1><span>Pasado, presente y próximos 30 días en una misma historia funcional.</span></div><nav className="av4-modes"><Link href={href('/actividad',{vista:'cronologia',filtro:domain,q})} className={view==='cronologia'?'active':''}>Cronología</Link><Link href={href('/actividad',{vista:'calendario'})} className={view==='calendario'?'active':''}>Calendario</Link></nav></header>
    <section className="av4-kpis"><div><small>En curso</small><strong>{summary.active}</strong></div><div className={summary.attention+calendar.counts.attention?'attention':''}><small>Requiere atención</small><strong>{summary.attention+calendar.counts.attention}</strong></div><div><small>Próximos 7 días</small><strong>{calendar.counts.next7}</strong></div><div><small>Pendiente de planificar</small><strong>{calendar.counts.pending}</strong></div></section>
    {view==='cronologia'?<>
      <section className="av4-tools"><form><input type="hidden" name="vista" value="cronologia"/><input type="hidden" name="filtro" value={domain}/><input name="q" defaultValue={q} placeholder="Buscar título, persona, saga o actividad…"/><button>Buscar</button></form><div className="av4-filters">{FILTERS.map(([key,label])=><Link key={key} href={href('/actividad',{vista:'cronologia',filtro:key,q})} className={domain===key?'active':''}>{label}</Link>)}</div></section>
      <section className="av4-timeline">{groups.length?groups.map(group=><div className="av4-day" key={group.label}><h2>{group.label}</h2>{group.items.map(item=>{const imdbId=entityImdbId(item);return <article className={`av4-entry ${item.attention?'attention':''}`} key={item.run_id}><div className="av4-entry-time">{fmtTime(item.requested_at)}</div><div className="av4-entry-body"><div className="av4-entry-top"><b>{item.title}</b><span>{item.statusLabel}</span></div><p>{item.resultLabel}</p><small>{item.originLabel}{item.entityLabel?` · ${item.entityLabel}`:''}{item.duration_ms?` · ${Math.max(1,Math.round(Number(item.duration_ms)/60000))} min`:''}</small><div className="av4-entry-links">{imdbId&&<Link href={`/catalogo/${imdbId}`}>Ver ficha</Link>}<Link href={href('/actividad',{vista:'cronologia',filtro:domain,q,pagina:page,run:item.run_id})}>Ver detalle</Link></div></div></article>})}</div>):<div className="av4-empty">No hay actividad que coincida con estos filtros.</div>}</section>
      <nav className="av4-pagination">{page>1&&<Link href={href('/actividad',{vista:'cronologia',filtro:domain,q,pagina:page-1})}>← Más reciente</Link>}{timeline.hasMore&&<Link href={href('/actividad',{vista:'cronologia',filtro:domain,q,pagina:page+1})}>Más antiguo →</Link>}</nav>
    </>:<section className="av4-calendar"><div className="av4-calendar-note"><div><b>Planificación automática activa</b><span>PikoFilm reparte trabajo flexible dentro de su ventana segura. Pulsa un día para revisar y reprogramar sus bloques. Horas de Madrid.</span></div><form action={recalculatePlanningNow}><button className="av4-recalculate">Recalcular planificación ahora</button></form></div>
      {calendar.overloads.length>0&&<div className="av4-calendar-alerts"><h2>Carga que merece revisión</h2>{calendar.overloads.map(item=><div className={`av4-calendar-warning ${item.deliberatePeak?'deliberate':''}`} key={item.day}><b>{fmtDate(`${item.day}T12:00:00Z`)} · {item.volume} tareas</b><span>{item.reason} {item.deliberatePeak?'PikoFilm respetará este pico.':'Puedes mover trabajo no prioritario a un día libre o fijar el pico si es intencionado.'}</span></div>)}</div>}
      {pending.length>0&&<details className="av4-pending"><summary><span>Pendiente de ubicar</span><b>{pending.reduce((n,x)=>n+Number(x.planned_volume),0)} tareas · {pending.length} bloques</b></summary><div>{pending.map(plan=><CalendarCard key={plan.plan_id} plan={plan}/>)}</div></details>}
      <div className="av4-calendar-range"><div><p>PRÓXIMOS 30 DÍAS</p><h2>{fmtDate(madridNoon(startKey))} — {fmtDate(madridNoon(endKey))}</h2></div><span>Seleccionado: <b>{selectedKey===startKey?'Hoy':fmtDate(madridNoon(selectedKey))}</b></span></div>
      <div className="av4-weekdays">{['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(x=><span key={x}>{x}</span>)}</div>
      <div className="av4-calendar-grid">{calendarDays.map(day=><CalendarDay key={day.key} day={day} selected={day.key===selectedKey}/>)}</div>
      <section className="av4-day-detail"><header><div><p>{selected?fmtDayName(selected.date):''}</p><h2>{selected?fmtDate(selected.date):''}</h2></div>{selected&&selected.volume>0?<div className="av4-day-total"><strong>{selected.volume}</strong><span>tareas · {selected.plans.length} bloques</span></div>:<div className="av4-day-free-badge">Día libre</div>}</header>
        {selected&&selected.plans.length?selected.plans.sort((a,b)=>new Date(a.planned_at)-new Date(b.planned_at)).map(plan=><CalendarCard key={plan.plan_id} plan={plan}/>):<div className="av4-empty av4-empty-day"><b>Sin trabajo planificado</b><span>Este día está libre dentro del horizonte de 30 días. Puedes usarlo como referencia para redistribuir carga desde otros días.</span></div>}
      </section>
    </section>}
    {detail&&<aside className="av4-detail"><Link className="av4-detail-close" href={href('/actividad',{vista:'cronologia',filtro:domain,q,pagina:page})}>×</Link><p>DETALLE FUNCIONAL</p><h2>{detail.run.title}</h2><strong>{detail.run.statusLabel}</strong><p>{detail.run.resultLabel}</p><dl><div><dt>Origen</dt><dd>{detail.run.originLabel}</dd></div><div><dt>Fecha</dt><dd>{fmtDate(detail.run.requested_at)} · {fmtTime(detail.run.requested_at)}</dd></div>{detail.run.entityLabel&&<div><dt>Afectado</dt><dd>{detail.run.entityLabel}</dd></div>}</dl>{detail.children.length>0&&<div className="av4-detail-list"><h3>Efectos relacionados</h3>{detail.children.map(x=><div key={x.run_id}><b>{x.title}{x.entityLabel?` · ${x.entityLabel}`:''}</b><span>{x.resultLabel}</span></div>)}</div>}{detail.errors.length>0&&<div className="av4-detail-list attention"><h3>Incidencias</h3>{detail.errors.map(x=><div key={x.error_id}><b>{x.functionalMessage}</b><span>{x.nextStep}</span></div>)}</div>}<Link className="av4-technical" href={detail.run.technicalHref}>Ver detalle técnico en Operaciones</Link></aside>}
  </main>;
}

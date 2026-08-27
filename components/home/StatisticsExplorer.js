'use client';
import {useEffect,useMemo,useState} from 'react';
import {nf,one,pct,score,pp,decadeLabel} from '@/lib/home-format';
import {eligibleRows,mostCovered,leastCovered,bestScore} from '@/lib/home-statistics';

const tabs=[['dna','ADN'],['coverage','Cobertura'],['score','PikoScore'],['countries','Países'],['sagas','Sagas'],['profile','Perfil'],['balance','Balance']];

function Bars({rows,value='total',suffix='',integer=false,diverging=false}){
  const safe=(rows||[]).filter(Boolean),max=Math.max(...safe.map(r=>Math.abs(Number(r?.[value]||0))),1);
  return <div className={`home-bars ${diverging?'diverging':''}`}>{safe.map((r,i)=>{
    const raw=Number(r?.[value]||0),label=r.label||r.band||(r.bucket!=null?decadeLabel(r.bucket):'Sin etiqueta');
    return <div className="home-bar" key={`${label}-${i}`}><span>{label||'Sin etiqueta'}</span><div><i className={raw<0?'negative':''} style={{width:`${Math.max(3,Math.round(Math.abs(raw)/max*100))}%`}}/></div><b>{integer?nf(raw):one(raw)}{suffix}</b></div>;
  })}</div>;
}

function Insight({label,value,help,tone=''}){return <article className={tone}><span>{label}</span><b>{value}</b>{help&&<small>{help}</small>}</article>}

export default function StatisticsExplorer({data}){
  const [tab,setTab]=useState('dna');
  useEffect(()=>{const saved=window.localStorage.getItem('pikofilm-home-stat');if(tabs.some(([id])=>id===saved))setTab(saved)},[]);
  const choose=id=>{setTab(id);window.localStorage.setItem('pikofilm-home-stat',id)};

  const genreEligible=useMemo(()=>eligibleRows(data.genres||[],'genre'),[data.genres]);
  const countryEligible=useMemo(()=>eligibleRows(data.countries||[],'country'),[data.countries]);
  const decadeEligible=useMemo(()=>eligibleRows(data.decades||[],'decade'),[data.decades]);
  const gap=useMemo(()=>[...genreEligible].sort((a,b)=>a.coverage-b.coverage).slice(0,7),[genreEligible]);
  const country=(data.countries||[]).slice(0,8);
  const balance=useMemo(()=>[...(data.balance?.genres||[])].filter(r=>genreEligible.some(g=>g.label===r.label)).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta)).slice(0,7),[data.balance,genreEligible]);
  const topGenre=(data.genres||[])[0]||null,bestCoverage=mostCovered(data.genres||[],'genre'),topScore=bestScore(data.genres||[],'genre');
  const bestDecade=mostCovered(data.decades||[],'decade'),bestCountry=mostCovered(data.countries||[],'country');
  const saga=data.sagas||{},profile=data.profile||{};
  const durationRows=[
    {label:'< 90 min',total:profile.runtime_lt90},{label:'90–119 min',total:profile.runtime_90_119},{label:'120–149 min',total:profile.runtime_120_149},{label:'150–179 min',total:profile.runtime_150_179},{label:'180+ min',total:profile.runtime_180_plus}
  ];

  return <section className="dashboard-panel stats-explorer">
    <div className="section-head home-section-head"><div><div className="eyebrow">Mi filmoteca</div><h2>Explorador estadístico</h2><p>Una superficie compacta para entender la colección sin bajar al detalle operativo.</p></div></div>
    <div className="stats-tabs" role="tablist" aria-label="Estadísticas de la filmoteca">{tabs.map(([id,label])=><button key={id} role="tab" aria-selected={tab===id} className={tab===id?'active':''} onClick={()=>choose(id)}>{label}</button>)}</div>
    <div className="stats-stage">
      {tab==='dna'&&<div className="stats-grid editorial"><div><h3>ADN de la colección</h3><p className="stats-lead">Presencia de géneros: un título puede pertenecer a varios.</p><Bars rows={(data.genres||[]).slice(0,8)} integer/></div><div className="stat-insights"><Insight label="Género dominante" value={topGenre?.label||'—'} help={topGenre?`${nf(topGenre.total)} títulos asociados`:null}/><Insight label="Mejor cobertura representativa" value={bestCoverage?.label||'—'} help={bestCoverage?`${pct(bestCoverage.coverage)} · ${nf(bestCoverage.owned)}/${nf(bestCoverage.total)}`:null}/><Insight label="Mejor PikoScore representativo" value={topScore?.label||'—'} help={topScore?`${score(topScore.avg_score)} de media`:null}/></div><div className="stats-insight-strip"><b>Lo que dicen tus datos</b><span>{topGenre?`${topGenre.label} es el género más presente.`:'Sin muestra suficiente.'}</span><span>{bestCoverage?`${bestCoverage.label} destaca en cobertura entre géneros representativos.`:''}</span></div></div>}

      {tab==='coverage'&&<div className="stats-grid editorial"><div><h3>Mapa de cobertura</h3><p className="stats-lead">Huecos entre segmentos con muestra suficiente; evitamos extremos engañosos.</p><Bars rows={gap} value="coverage" suffix=" %"/></div><div className="stat-insights"><Insight label="Mayor hueco representativo" value={leastCovered(data.genres||[],'genre')?.label||'—'} help={gap[0]?`${pct(gap[0].coverage)} · ${nf(gap[0].owned)}/${nf(gap[0].total)}`:null}/><Insight label="Década más cubierta" value={bestDecade?decadeLabel(bestDecade.bucket):'—'} help={bestDecade?`${pct(bestDecade.coverage)} · ${nf(bestDecade.owned)}/${nf(bestDecade.total)}`:'Sin muestra suficiente'}/></div><div className="coverage-mini-grid">{decadeEligible.slice(-6).map(r=><article key={r.bucket}><span>{decadeLabel(r.bucket)}</span><b>{pct(r.coverage)}</b><small>{nf(r.owned)}/{nf(r.total)}</small></article>)}</div></div>}

      {tab==='score'&&<div className="stats-grid editorial"><div><h3>PikoScore Observatory</h3><p className="stats-lead">Distribución por bandas canónicas y cobertura real dentro de cada banda.</p><Bars rows={data.scoreBands||[]} value="coverage" suffix=" %"/></div><div className="stat-insights"><Insight label="PikoScore medio" value={score(data.kpi.avg_score)} help="catálogo objetivo"/><Insight label="PikoScore medio en Plex" value={score(data.kpi.avg_score_plex)} help="biblioteca presente"/><Insight label="Títulos con PikoScore" value={pct(profile.score_coverage)} help={`${nf(data.kpi.score_known)} de ${nf(data.kpi.catalog_total)}`}/></div><div className="score-band-cards">{(data.scoreBands||[]).map(r=><article key={r.band||r.label}><span>{r.label||r.band||'Sin banda'}</span><b>{pct(r.coverage)}</b><small>{nf(r.owned)}/{nf(r.total)} en Plex</small></article>)}</div></div>}

      {tab==='countries'&&<div className="stats-grid editorial"><div><h3>Cinematografías</h3><p className="stats-lead">Presencia por país. Las coproducciones pueden estar asociadas a más de una cinematografía.</p><Bars rows={country} integer/></div><div className="stat-insights"><Insight label="Más representada" value={country[0]?.label||'—'} help={country[0]?`${nf(country[0].total)} títulos asociados`:null}/><Insight label="Mejor cubierta representativa" value={bestCountry?.label||'—'} help={bestCountry?`${pct(bestCountry.coverage)} · ${nf(bestCountry.owned)}/${nf(bestCountry.total)}`:null}/><Insight label="Países visibles" value={nf(countryEligible.length)} help="con muestra suficiente entre los principales"/></div></div>}

      {tab==='sagas'&&<div className="stats-grid saga-rich"><div><h3>Sagas & universos</h3><p className="stats-lead">Misma definición canónica que la página Sagas: sólo títulos relevantes y accionables.</p><div className="saga-dual"><div className="saga-orbit"><strong>{pct(saga.complete_pct)}</strong><span>sagas completas</span></div><div className="saga-orbit secondary"><strong>{pct(saga.coverage)}</strong><span>cobertura de universos</span></div></div></div><div className="stat-insights"><Insight label="Completas" value={nf(saga.complete)} help={`de ${nf(saga.all)} colecciones activas`}/><Insight label="A una película" value={nf(saga.one)} help="subconjunto de sagas ya empezadas"/><Insight label="En progreso" value={nf(saga.incomplete)} help="con al menos una pendiente"/><Insight label="Sin empezar" value={nf(saga.not_started)} help="0 títulos relevantes en Plex"/></div><div className="saga-summary-line"><span><b>{nf(saga.owned_movies)}</b> de {nf(saga.movies)} títulos de saga en Plex</span><span><b>{nf(saga.missing_movies)}</b> pendientes accionables</span></div></div>}

      {tab==='profile'&&<div className="stats-grid editorial"><div><h3>Perfil de tu filmoteca</h3><div className="profile-line"><span>{profile.oldest_year||'—'}</span><i/><b>{Math.round(Number(profile.median_year||0))||'—'}</b><i/><span>{profile.newest_year||'—'}</span></div><p className="stats-lead">Año mediano: {Math.round(Number(profile.median_year||0))||'—'}. Distribución de duración sólo sobre películas con runtime válido.</p><Bars rows={durationRows} integer/></div><div className="stat-insights"><Insight label="Duración mediana" value={profile.median_runtime?`${Math.round(Number(profile.median_runtime))} min`:'—'} help={`${pct(profile.runtime_coverage)} con runtime conocido`}/><Insight label="Más de 3 horas" value={nf(profile.runtime_180_plus)} help="películas"/><Insight label="Horas de cine en Plex" value={nf(profile.plex_movie_hours)} help="sólo películas con runtime válido"/></div></div>}

      {tab==='balance'&&<div className="stats-grid editorial"><div><h3>Balance de colección</h3><p className="stats-lead">Participación relativa normalizada. En géneros múltiples, cada título reparte su peso entre sus asociaciones.</p><Bars rows={balance} value="delta" suffix=" pp" diverging/></div><div className="stat-insights"><Insight label="Mayor desviación" value={balance[0]?.label||'—'} help={balance[0]?`${pp(balance[0].delta)} · ${Number(balance[0].delta)>=0?'más presente en Plex':'menos presente en Plex'}`:null}/><Insight label="Comparación" value="Catálogo ↔ Plex" help="distribuciones normalizadas, no faltantes absolutos"/></div></div>}
    </div>
  </section>;
}

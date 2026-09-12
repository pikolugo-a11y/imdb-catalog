import Link from '@/components/NoPrefetchLink';
import PendingSubmitButton from '@/components/PendingSubmitButton';
import {getNewsSettings} from '@/lib/news-v1';
import {saveNewsSettingsAction} from '../actions';
import './criteria-v4.css';
export const dynamic='force-dynamic';

function RuleCard({title,description,ratingName,ratingValue,votesName,votesValue}){return <section className="criteria-card"><div><h2>{title}</h2><p>{description}</p></div><div className="criteria-fields"><label>IMDb mínima<input name={ratingName} type="number" min="0" max="10" step="0.1" required defaultValue={ratingValue}/></label><label>Votos mínimos<input name={votesName} type="number" min="0" step="100" required defaultValue={votesValue}/></label></div></section>}

export default async function Criterios({searchParams}){
  const p=await searchParams||{},s=await getNewsSettings();
  return <div className="criteria-v4">
    <Link className="criteria-back" href="/novedades">← Novedades</Link>
    <header className="criteria-hero"><div><div className="eyebrow">Novedades · configuración</div><h1>Criterios IMDb</h1><p>Define qué obras puede proponer Discovery. Guardar modifica los criterios persistidos, pero nunca lanza una búsqueda por sí solo.</p></div></header>
    {p.notice==='saved'&&<div className="criteria-notice" role="status">✓ Criterios guardados. Se aplicarán en la próxima ejecución manual de Discovery.</div>}
    <div className="criteria-note"><b>Impacto:</b> estos umbrales gobiernan futuras propuestas de Discovery; no eliminan títulos existentes del Catálogo ni ejecutan mantenimiento automáticamente.</div>
    <form action={saveNewsSettingsAction} className="criteria-form">
      <div className="criteria-grid">
        <RuleCard title="Películas generales" description="Umbral estándar para películas no españolas." ratingName="movieGeneralRating" ratingValue={s.movie.general.minRating} votesName="movieGeneralVotes" votesValue={s.movie.general.minVotes}/>
        <RuleCard title="Películas españolas" description="Regla específica para cine español." ratingName="movieSpainRating" ratingValue={s.movie.spain.minRating} votesName="movieSpainVotes" votesValue={s.movie.spain.minVotes}/>
        <RuleCard title="Series y miniseries generales" description="Umbral estándar para ficción televisiva no española." ratingName="seriesGeneralRating" ratingValue={s.series.general.minRating} votesName="seriesGeneralVotes" votesValue={s.series.general.minVotes}/>
        <RuleCard title="Series españolas" description="Regla específica para series y miniseries españolas." ratingName="seriesSpainRating" ratingValue={s.series.spain.minRating} votesName="seriesSpainVotes" votesValue={s.series.spain.minVotes}/>
        <section className="criteria-card criteria-global"><div><h2>Países excluidos globalmente</h2><p>Códigos separados por comas. Se aplican sólo al universo de Discovery.</p></div><div className="criteria-fields"><label>Países excluidos<input name="excludedCountries" defaultValue={s.excludedCountries.join(', ')} placeholder="Q668, IN"/></label></div></section>
      </div>
      <div className="criteria-actions"><PendingSubmitButton pendingLabel="Guardando criterios…">Guardar criterios</PendingSubmitButton><Link href="/novedades">Cancelar</Link></div>
    </form>
  </div>;
}

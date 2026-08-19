import Link from 'next/link';
import {getNewsSettings} from '@/lib/news-v1';
import {saveNewsSettingsAction} from '../actions';
export const dynamic='force-dynamic';

export default async function Criterios({searchParams}){
  const p=await searchParams||{},s=await getNewsSettings();
  return <>
    <div className="breadcrumbs"><Link href="/novedades">Novedades</Link><span>›</span><b>Criterios IMDb</b></div>
    <div className="page-head"><div><div className="eyebrow">Configuración</div><h1>Criterios IMDb</h1><p>Los cambios se aplican al siguiente discovery sin tocar código ni desplegar.</p></div></div>
    {p.notice==='saved'?<div className="info-banner">Criterios guardados.</div>:null}
    <form action={saveNewsSettingsAction}>
      <div className="series-grid">
        <section className="card"><h3>Películas generales</h3><label>IMDb mínima<input name="movieGeneralRating" type="number" min="0" max="10" step="0.1" defaultValue={s.movie.general.minRating}/></label><label>Votos mínimos<input name="movieGeneralVotes" type="number" min="0" step="100" defaultValue={s.movie.general.minVotes}/></label></section>
        <section className="card"><h3>Películas españolas</h3><label>IMDb mínima<input name="movieSpainRating" type="number" min="0" max="10" step="0.1" defaultValue={s.movie.spain.minRating}/></label><label>Votos mínimos<input name="movieSpainVotes" type="number" min="0" step="100" defaultValue={s.movie.spain.minVotes}/></label></section>
        <section className="card"><h3>Series / miniseries generales</h3><label>IMDb mínima<input name="seriesGeneralRating" type="number" min="0" max="10" step="0.1" defaultValue={s.series.general.minRating}/></label><label>Votos mínimos<input name="seriesGeneralVotes" type="number" min="0" step="100" defaultValue={s.series.general.minVotes}/></label></section>
        <section className="card"><h3>Series españolas</h3><label>IMDb mínima<input name="seriesSpainRating" type="number" min="0" max="10" step="0.1" defaultValue={s.series.spain.minRating}/></label><label>Votos mínimos<input name="seriesSpainVotes" type="number" min="0" step="100" defaultValue={s.series.spain.minVotes}/></label></section>
      </div>
      <section className="card" style={{marginTop:16}}><h3>Países excluidos globalmente</h3><p>Separados por comas. India se mantiene inicialmente como Q668 / IN.</p><input name="excludedCountries" defaultValue={s.excludedCountries.join(', ')} style={{width:'100%'}}/></section>
      <div style={{display:'flex',gap:8,marginTop:18,flexWrap:'wrap'}}><button className="button" name="runNow" value="0">Guardar</button><button className="button secondary" name="runNow" value="1">Guardar y buscar ahora</button><Link className="button secondary" href="/novedades">Cancelar</Link></div>
    </form>
  </>
}

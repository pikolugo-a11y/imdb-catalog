import Kpi from '@/components/Kpi';
import { getDashboard } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const d = await getDashboard();
  return <>
    <div className="hero"><div><div className="eyebrow">Centro de control</div><h1>Tu biblioteca, bajo control.</h1><p>PikoFilm prioriza qué merece entrar en Plex, cruza el catálogo seleccionado con tu biblioteca real y señala lo que necesita revisión.</p></div></div>
    <div className="grid">
      <Kpi label="Catálogo seleccionado" value={d.catalog_total} note="películas y series candidatas" href="/catalogo"/>
      <Kpi label="Ya en Plex" value={d.catalog_in_plex} note="cruces confirmados" href="/catalogo"/>
      <Kpi label="Faltan en Plex" value={d.catalog_missing} note="universo seleccionable" href="/catalogo"/>
      <Kpi label="En proceso" value={d.catalog_acquiring} note="marcadas para conseguir" href="/catalogo"/>
      <Kpi label="Revisión películas" value={d.movie_review_pending} note="incidencias pendientes" href="/calidad/peliculas"/>
      <Kpi label="Series con incidencias" value={d.series_with_issues} note="diagnóstico por episodio" href="/calidad/series"/>
      <Kpi label="Episodios que faltan en ES" value={d.missing_episodes_actionable} note="faltantes accionables confirmados" href="/calidad/series"/>
      <Kpi label="Disponibilidad ES desconocida" value={d.missing_episodes_unknown} note="no se consideran error todavía" href="/calidad/series"/>
      <Kpi label="Plex fuera del catálogo" value={d.plex_not_in_catalog} note="requieren contexto o cruce" href="/plex"/>
    </div>
    <section className="section"><div className="section-head"><h2>Flujo de trabajo</h2><p>La web está orientada a decisiones, no al consumo de vídeo.</p></div><div className="cards"><div className="card"><h3>1 · Seleccionar</h3><p>Explora el catálogo curado y encuentra qué títulos merecen incorporarse.</p></div><div className="card"><h3>2 · Correlacionar</h3><p>Comprueba inmediatamente si cada título ya existe en Plex o está en proceso.</p></div><div className="card"><h3>3 · Auditar</h3><p>Ataca identificaciones dudosas, calidad de ficheros y huecos reales de películas o episodios.</p></div></div></section>
  </>;
}

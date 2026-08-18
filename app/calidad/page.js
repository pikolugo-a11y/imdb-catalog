import Link from 'next/link';

export default function Calidad() {
  return <><div className="hero"><div><div className="eyebrow">Diagnóstico</div><h1>Calidad</h1><p>Películas y series comparten Plex, pero no comparten motor de diagnóstico.</p></div></div><div className="split-links"><Link className="big-link" href="/calidad/peliculas"><strong>Películas</strong><span>Identificación, fichero, resolución, duplicados, cruces dudosos y colecciones incompletas.</span></Link><Link className="big-link" href="/calidad/series"><strong>Series</strong><span>Serie → temporada → episodio. Presencia, huecos, numeración, duración y disponibilidad efectiva en España.</span></Link></div></>;
}

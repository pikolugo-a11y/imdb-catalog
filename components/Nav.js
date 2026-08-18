import Link from 'next/link';

const links = [
  ['/', 'Inicio'],
  ['/catalogo', 'Catálogo'],
  ['/plex', 'Plex'],
  ['/calidad', 'Calidad'],
  ['/sagas', 'Sagas']
];

export default function Nav() {
  return <>
    <header className="topbar">
      <Link href="/" className="brand"><span>P</span>PikoFilm</Link>
      <nav>{links.map(([href,label]) => <Link key={href} href={href}>{label}</Link>)}</nav>
      <div className="version">V1 · desarrollo</div>
    </header>
    <nav className="mobile-nav">{links.map(([href,label]) => <Link key={href} href={href}>{label}</Link>)}</nav>
  </>;
}

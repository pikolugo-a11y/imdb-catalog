import Link from 'next/link';
const main=[['/','Inicio'],['/catalogo','Catálogo'],['/plex','Plex'],['/calidad','Calidad'],['/sagas','Sagas']];
export default function Nav(){return <><header className="topbar"><Link href="/" className="brand"><span>P</span>PikoFilm</Link><nav>{main.map(([h,l])=><Link key={h} href={h}>{l}</Link>)}<Link href="/admin">Admin</Link></nav><div className="version">V1 · predeploy</div></header><nav className="mobile-nav">{main.map(([h,l])=><Link key={h} href={h}>{l}</Link>)}</nav></>}

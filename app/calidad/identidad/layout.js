import Link from 'next/link';
export default function IdentityLayout({children}){return <><div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:14}}><Link className="button ghost" href="/calidad/identidad">Identidad</Link><Link className="button ghost" href="/calidad/identidad/ambiguos">⚑ Ambiguos FilmAffinity</Link></div>{children}</>}

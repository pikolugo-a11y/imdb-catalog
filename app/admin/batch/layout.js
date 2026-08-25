import Link from 'next/link';
import './batch.css';
import './compact.css';

export default function BatchLayout({children}){return <><nav className="batch-subnav" aria-label="Procesos Batch"><Link href="/admin/batch">Lifecycle</Link><Link href="/admin/batch/personas">Personas / Filmografías</Link></nav>{children}</>}

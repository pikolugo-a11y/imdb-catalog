import Link from 'next/link';
import DatabaseStoragePanel from '@/components/home/DatabaseStoragePanel';
import {db} from '@/lib/db';
export const dynamic='force-dynamic';
export default async function OperationsSystem(){const sql=db();const history=await sql`SELECT snapshot_date,metrics FROM dashboard_snapshots ORDER BY snapshot_date DESC LIMIT 90`;return <div className="ops-shell"><header className="ops-hero"><div><div className="ops-kicker">Operaciones · Sistema</div><h1>Sistema</h1><p>Infraestructura y almacenamiento técnico de PikoFilm.</p></div><Link className="ops-refresh" href="/admin">← Operaciones</Link></header><DatabaseStoragePanel history={[...history].reverse()}/></div>}

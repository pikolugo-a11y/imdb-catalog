import Link from '@/components/NoPrefetchLink';
import {db} from '@/lib/db';
import {getC6BatchState} from '@/lib/pikoquality-c6-batch';
import {getTechnicalDashboard} from '@/lib/plex-technical-control.mjs';
import TechnicalRunFlow from '@/app/calidad/pikoquality/TechnicalRunFlow';
import C6BatchRunner from '@/app/calidad/pikoquality/C6BatchRunner';

export const dynamic='force-dynamic';

export default async function OperationsPikoQuality(){
  const sql=db();
  const [technical,c6]=await Promise.all([getTechnicalDashboard(sql),getC6BatchState(sql)]);
  return <div className="ops-shell">
    <header className="ops-hero"><div><div className="ops-kicker">Operaciones · PikoQuality</div><h1>Mantenimiento técnico</h1><p>Captura física y recálculos masivos. Estos controles son técnicos: Calidad sólo muestra salud funcional, prioridades y recálculo individual.</p></div><Link className="ops-refresh" href="/admin">← Operaciones</Link></header>
    <TechnicalRunFlow technical={technical}/>
    <div style={{height:16}}/>
    <C6BatchRunner initial={c6}/>
  </div>;
}
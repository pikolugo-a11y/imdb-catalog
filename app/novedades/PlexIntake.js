import Link from 'next/link';
import {db} from '@/lib/db';
import PlexSyncButton from '@/components/PlexSyncButton';

function fmt(v){if(!v)return 'Nunca';try{return new Date(v).toLocaleString('es-ES')}catch{return 'Nunca'}}

export default async function PlexIntake(){
  const sql=db();
  const [rows,[sync]] = await Promise.all([
    sql`SELECT p.rating_key,p.plex_title,p.plex_year,p.item_type,p.added_at
        FROM plex_items p
        WHERE p.active AND p.item_type IN('movie','show')
          AND NOT EXISTS(SELECT 1 FROM plex_external_ids x WHERE x.rating_key=p.rating_key AND x.provider='imdb')
        ORDER BY p.added_at DESC NULLS LAST,p.plex_title
        LIMIT 100`,
    sql`SELECT finished_at,started_at FROM plex_sync_runs WHERE status='success' ORDER BY COALESCE(finished_at,started_at) DESC LIMIT 1`
  ]);
  return <section className="plex-intake">
    <div className="plex-intake-head">
      <div>
        <div className="eyebrow">PLEX → NOVEDADES</div>
        <h2>Entrada desde Plex</h2>
        <p>Actualizar Plex solo detecta cambios. Todo título nuevo entra en Novedades y sigue el mismo ciclo que cualquier otra incorporación.</p>
      </div>
      <div className="plex-intake-sync"><small>Última sincronización · {fmt(sync?.finished_at||sync?.started_at)}</small><PlexSyncButton/></div>
    </div>
    <div className="plex-step-card">
      <div className="plex-step-number">1</div>
      <div className="plex-step-copy"><span>Paso 1 · Identidad</span><strong>{rows.length.toLocaleString('es-ES')} títulos de Plex sin IMDb</strong><p>No pueden convertirse todavía en una Novedad normal. Al resolver su IMDb pasarán automáticamente a la cola de Novedades Plex.</p></div>
      <Link className="button secondary" href="/calidad/identidad?issue=missing_plex_imdb">Abrir Identidad →</Link>
    </div>
    {rows.length>0?<div className="plex-identity-list">{rows.map(r=><Link key={r.rating_key} className="plex-identity-row" href={`/calidad/identidad?plex=${encodeURIComponent(r.rating_key)}&q=${encodeURIComponent(r.plex_title||'')}`}>
      <div><b>{r.plex_title||'Sin título'}</b><span>{r.item_type==='show'?'Serie':'Película'} · {r.plex_year||'Año desconocido'} · Plex #{r.rating_key}</span></div>
      <strong>Resolver IMDb →</strong>
    </Link>)}</div>:<div className="plex-intake-ok">✓ Todos los títulos activos de Plex tienen IMDb.</div>}
  </section>;
}

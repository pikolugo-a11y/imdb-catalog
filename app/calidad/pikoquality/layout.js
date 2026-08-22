import {db} from '@/lib/db';
import {analyzeOnePikoQualityAction} from './actions';

export const dynamic='force-dynamic';

export default async function Layout({children}){
  const sql=db();
  const pending=await sql`SELECT cl.imdb_id,m.title_es,m.year,pcs.rating_key,p.fingerprint,q.score,q.source_fingerprint FROM catalog_lifecycle cl JOIN movies m USING(imdb_id) LEFT JOIN plex_catalog_status pcs USING(imdb_id) LEFT JOIN plex_items p ON p.rating_key=pcs.rating_key AND p.active LEFT JOIN piko_quality q ON q.rating_key=pcs.rating_key WHERE cl.lifecycle_state='TECH_PENDING' AND m.type='Película' ORDER BY m.year DESC NULLS LAST,m.title_es LIMIT 500`;
  return <>
    {pending.length>0&&<section style={{margin:'0 auto 22px',maxWidth:1500,padding:'18px 22px',border:'1px solid #334155',borderRadius:14,background:'#0f172a'}}>
      <div style={{marginBottom:12}}><div style={{fontSize:12,textTransform:'uppercase',opacity:.65}}>Último paso físico</div><h2 style={{margin:'4px 0'}}>PikoQuality pendiente · {pending.length}</h2><p style={{margin:0,opacity:.75}}>Solo aparecen películas cuyo archivo ya pasó la validación anterior. El análisis es unitario y corresponde al fingerprint actual.</p></div>
      <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th style={{textAlign:'left',padding:8}}>Película</th><th style={{textAlign:'left',padding:8}}>Plex</th><th style={{textAlign:'left',padding:8}}>Estado anterior</th><th style={{textAlign:'right',padding:8}}>Acción</th></tr></thead><tbody>{pending.map(r=><tr key={r.imdb_id} style={{borderTop:'1px solid #263244'}}><td style={{padding:8}}><b>{r.title_es||r.imdb_id}</b><br/><small>{r.year||'—'} · {r.imdb_id}</small></td><td style={{padding:8}}><small>{r.rating_key||'—'}</small></td><td style={{padding:8}}><small>{r.score!=null&&r.source_fingerprint===r.fingerprint?`PQ ${r.score} actual`:'Pendiente para archivo actual'}</small></td><td style={{padding:8,textAlign:'right'}}><form action={analyzeOnePikoQualityAction}><input type="hidden" name="imdbId" value={r.imdb_id}/><button>Analizar PikoQuality</button></form></td></tr>)}</tbody></table></div>
    </section>}
    {children}
  </>;
}

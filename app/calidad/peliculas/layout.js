import Link from 'next/link';
import {db} from '@/lib/db';
import {validateMovieFileAction} from '@/app/actions';

export const dynamic='force-dynamic';

export default async function Layout({children}){
  const sql=db();
  const pending=await sql`SELECT cl.imdb_id,m.title_es,m.year,pcs.rating_key,p.fingerprint,pf.file_path FROM catalog_lifecycle cl JOIN movies m USING(imdb_id) LEFT JOIN plex_catalog_status pcs USING(imdb_id) LEFT JOIN plex_items p ON p.rating_key=pcs.rating_key AND p.active LEFT JOIN LATERAL(SELECT file_path FROM plex_files f WHERE f.rating_key=p.rating_key ORDER BY f.media_index,f.part_index LIMIT 1) pf ON true WHERE cl.lifecycle_state='MOVIE_FILE_PENDING' ORDER BY m.year DESC NULLS LAST,m.title_es LIMIT 500`;
  return <>
    {pending.length>0&&<section style={{margin:'0 auto 22px',maxWidth:1500,padding:'18px 22px',border:'1px solid #334155',borderRadius:14,background:'#0f172a'}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'end',marginBottom:12}}><div><div style={{fontSize:12,textTransform:'uppercase',opacity:.65}}>Paso obligatorio antes de PikoQuality</div><h2 style={{margin:'4px 0'}}>Validación de archivo pendiente · {pending.length}</h2><p style={{margin:0,opacity:.75}}>Comprueba duración, nombre/año y posibles versiones del archivo físico. Se procesa una película cada vez.</p></div><Link href="/calidad">← Calidad</Link></div>
      <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th style={{textAlign:'left',padding:8}}>Película</th><th style={{textAlign:'left',padding:8}}>Archivo</th><th style={{textAlign:'left',padding:8}}>Plex</th><th style={{textAlign:'right',padding:8}}>Acción</th></tr></thead><tbody>{pending.map(r=><tr key={r.imdb_id} style={{borderTop:'1px solid #263244'}}><td style={{padding:8}}><b>{r.title_es||r.imdb_id}</b><br/><small>{r.year||'—'} · {r.imdb_id}</small></td><td style={{padding:8}}><small>{r.file_path||'Archivo físico detectado'}</small></td><td style={{padding:8}}><small>{r.rating_key||'—'}</small></td><td style={{padding:8,textAlign:'right'}}><form action={validateMovieFileAction}><input type="hidden" name="imdbId" value={r.imdb_id}/><button>Validar película</button></form></td></tr>)}</tbody></table></div>
    </section>}
    {children}
  </>;
}

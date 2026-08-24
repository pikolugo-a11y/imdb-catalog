import 'server-only';
import {db} from './db';

const clean=s=>String(s||'').replace(/\s*[-–—:]\s*(colecci[oó]n|collection)\s*$/i,'').trim();
const n=v=>Number(v||0);

export async function getSagasDashboard(filters={}){
  const sql=db();
  const q=String(filters.q||'').trim().toLowerCase();
  const state=String(filters.state||'all');
  const sort=String(filters.sort||'easy');
  const page=Math.max(1,Number(filters.page)||1);
  const pageSize=Math.min(72,Math.max(24,Number(filters.pageSize)||48));
  const raw=await sql`
    WITH members AS (
      SELECT sm.tmdb_collection_id,sm.imdb_id,sm.poster_path,sm.year,
             c.effective_status,COALESCE(m.final_rating,c.final_rating) current_score
      FROM saga_collection_members sm
      LEFT JOIN catalog_read_model c ON c.imdb_id=sm.imdb_id
      LEFT JOIN movies m ON m.imdb_id=sm.imdb_id
      LEFT JOIN catalog_exclusions ex ON ex.imdb_id=sm.imdb_id
      LEFT JOIN identity_validation iv ON iv.imdb_id=sm.imdb_id
      WHERE ex.imdb_id IS NULL AND (sm.imdb_id IS NULL OR iv.validation_status='valid')
    )
    SELECT sc.tmdb_collection_id,sc.name,sc.poster_path,sc.backdrop_path,
           count(m.*)::int total,
           count(m.*) FILTER(WHERE m.effective_status='in_plex')::int owned,
           count(m.*) FILTER(WHERE m.effective_status='acquiring')::int acquiring,
           count(m.*) FILTER(WHERE m.effective_status IS DISTINCT FROM 'in_plex')::int missing,
           round((100.0*count(m.*) FILTER(WHERE m.effective_status='in_plex')/NULLIF(count(m.*),0))::numeric,1) pct,
           round(avg(m.current_score) FILTER(WHERE m.current_score IS NOT NULL)::numeric,2) saga_score,
           count(m.current_score)::int scored_count,
           min(m.year)::int first_year,max(m.year)::int last_year,
           round(((100.0*count(m.*) FILTER(WHERE m.effective_status='in_plex')/NULLIF(count(m.*),0))-(count(m.*) FILTER(WHERE m.effective_status IS DISTINCT FROM 'in_plex')*4)+COALESCE(avg(m.current_score) FILTER(WHERE m.effective_status IS DISTINCT FROM 'in_plex'),0)*2)::numeric,1) completion_score
    FROM saga_collections sc
    JOIN members m USING(tmdb_collection_id)
    WHERE (${q}='' OR lower(sc.name) LIKE ${'%'+q+'%'})
    GROUP BY sc.tmdb_collection_id,sc.name,sc.poster_path,sc.backdrop_path
  `;
  const all=raw.map(r=>({...r,name_clean:clean(r.name)}));
  const stats={
    all:all.length,
    incomplete:all.filter(r=>n(r.owned)>0&&n(r.missing)>0).length,
    one:all.filter(r=>n(r.owned)>0&&n(r.missing)===1).length,
    complete:all.filter(r=>n(r.total)>0&&n(r.missing)===0).length,
    not_started:all.filter(r=>n(r.owned)===0).length,
    movies:all.reduce((a,r)=>a+n(r.total),0),
    owned_movies:all.reduce((a,r)=>a+n(r.owned),0),
    missing_movies:all.reduce((a,r)=>a+n(r.missing),0)
  };
  const match=r=>state==='all'||(state==='incomplete'&&n(r.owned)>0&&n(r.missing)>0)||(state==='one'&&n(r.owned)>0&&n(r.missing)===1)||(state==='complete'&&n(r.total)>0&&n(r.missing)===0)||(state==='not_started'&&n(r.owned)===0);
  const filtered=all.filter(match);
  filtered.sort((a,b)=>sort==='pct'?n(b.pct)-n(a.pct):sort==='score'?n(b.saga_score)-n(a.saga_score):sort==='missing_desc'?n(b.missing)-n(a.missing):sort==='name'?a.name_clean.localeCompare(b.name_clean,'es'):n(a.missing)-n(b.missing)||n(b.pct)-n(a.pct)||n(b.saga_score)-n(a.saga_score));
  const total=filtered.length,pages=Math.max(1,Math.ceil(total/pageSize)),safePage=Math.min(page,pages),start=(safePage-1)*pageSize;
  const almost=[...all].filter(r=>n(r.owned)>0&&n(r.missing)===1).sort((a,b)=>n(b.saga_score)-n(a.saga_score)||n(b.pct)-n(a.pct)).slice(0,6);
  return {rows:filtered.slice(start,start+pageSize),stats,total,page:safePage,pages,pageSize,almost};
}

export async function getSagaDetailV3(id){
  const sql=db();
  const [saga]=await sql`SELECT * FROM saga_collections WHERE tmdb_collection_id=${String(id)} LIMIT 1`;
  if(!saga)return null;
  const titles=await sql`
    SELECT sm.*,c.display_title,c.effective_status,c.resolution,c.poster_path catalog_poster,c.rating_key,
           COALESCE(m.final_rating,c.final_rating) final_rating,
           pq.score pikoquality_score,pq.band pikoquality_band
    FROM saga_collection_members sm
    LEFT JOIN catalog_read_model c ON c.imdb_id=sm.imdb_id
    LEFT JOIN movies m ON m.imdb_id=sm.imdb_id
    LEFT JOIN catalog_exclusions ex ON ex.imdb_id=sm.imdb_id
    LEFT JOIN identity_validation iv ON iv.imdb_id=sm.imdb_id
    LEFT JOIN LATERAL (
      SELECT q.score,q.band FROM piko_quality q
      WHERE q.rating_key=c.rating_key AND q.status='evaluated'
      ORDER BY q.updated_at DESC NULLS LAST LIMIT 1
    ) pq ON true
    WHERE sm.tmdb_collection_id=${String(id)} AND ex.imdb_id IS NULL AND (sm.imdb_id IS NULL OR iv.validation_status='valid')
    ORDER BY sm.position NULLS LAST,sm.year NULLS LAST,sm.title`;
  return {...saga,name_clean:clean(saga.name),titles};
}

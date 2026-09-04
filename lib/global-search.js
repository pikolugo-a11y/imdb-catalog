import 'server-only';
import {db} from './db';

const LIMIT=6;
const MAX_QUERY_LENGTH=100;
const clean=s=>String(s||'').trim().slice(0,MAX_QUERY_LENGTH);

export async function globalSearch(rawQuery){
  const q=clean(rawQuery);
  if(q.length<2)return{titles:[],people:[],sagas:[]};
  const sql=db(),like=`%${q}%`,starts=`${q}%`,exact=q.toLowerCase();
  const [titles,people,sagas]=await Promise.all([
    sql`SELECT c.imdb_id,c.display_title,c.original_title,c.year,c.type,c.poster_path,c.effective_status
        FROM catalog_read_model c
        WHERE lower(c.imdb_id)=lower(${q}) OR lower(c.display_title) LIKE lower(${like}) OR lower(COALESCE(c.original_title,'')) LIKE lower(${like})
        ORDER BY CASE WHEN lower(c.imdb_id)=lower(${q}) THEN 0 WHEN lower(c.display_title)=${exact} THEN 1 WHEN lower(c.display_title) LIKE lower(${starts}) THEN 2 ELSE 3 END,
                 c.year DESC NULLS LAST,c.display_title
        LIMIT ${LIMIT}`,
    sql`SELECT p.tmdb_person_id,p.name,p.profile_path,p.known_for_department
        FROM people p
        WHERE EXISTS(
          SELECT 1 FROM movie_credits mc
          JOIN catalog_read_model c ON c.imdb_id=mc.imdb_id
          WHERE mc.tmdb_person_id=p.tmdb_person_id
        )
          AND (p.tmdb_person_id::text=${q} OR lower(p.name) LIKE lower(${like}))
        ORDER BY CASE WHEN p.tmdb_person_id::text=${q} THEN 0 WHEN lower(p.name)=${exact} THEN 1 WHEN lower(p.name) LIKE lower(${starts}) THEN 2 ELSE 3 END,
                 p.name
        LIMIT ${LIMIT}`,
    sql`SELECT sc.tmdb_collection_id,sc.name,sc.poster_path,
               (SELECT count(*)::int FROM saga_collection_members sm WHERE sm.tmdb_collection_id=sc.tmdb_collection_id) member_count
        FROM saga_collections sc
        WHERE (sc.tmdb_collection_id::text=${q} OR lower(sc.name) LIKE lower(${like}))
          AND (SELECT count(*) FROM saga_collection_members sm WHERE sm.tmdb_collection_id=sc.tmdb_collection_id)>=2
        ORDER BY CASE WHEN sc.tmdb_collection_id::text=${q} THEN 0 WHEN lower(sc.name)=${exact} THEN 1 WHEN lower(sc.name) LIKE lower(${starts}) THEN 2 ELSE 3 END,
                 sc.name
        LIMIT ${LIMIT}`
  ]);
  return{titles,people,sagas};
}

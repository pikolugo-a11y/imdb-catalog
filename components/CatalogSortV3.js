'use client';
import {useRouter,useSearchParams} from 'next/navigation';

const OPTIONS=[
  ['score:desc','PikoScore · mayor primero'],['score:asc','PikoScore · menor primero'],
  ['imdb:desc','IMDb · mayor primero'],['imdb:asc','IMDb · menor primero'],
  ['votes:desc','Votos IMDb · más votadas'],['votes:asc','Votos IMDb · menos votadas'],
  ['year:desc','Año · más recientes'],['year:asc','Año · más antiguas'],
  ['title:asc','Título · A–Z'],['title:desc','Título · Z–A'],
  ['runtime:desc','Duración · mayor primero'],['runtime:asc','Duración · menor primero']
];

export default function CatalogSortV3({sort='score',dir='desc'}){
  const router=useRouter();
  const search=useSearchParams();
  const value=`${sort}:${dir}`;
  function change(next){
    const [s,d]=next.split(':');
    const p=new URLSearchParams(search.toString());
    p.set('sort',s);p.set('dir',d);p.set('page','1');
    router.push(`/catalogo?${p.toString()}`);
  }
  return <label className="catalog-sort-control"><span>Ordenar</span><select value={value} onChange={e=>change(e.target.value)}>{OPTIONS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>;
}

'use client';
export default function CatalogError({reset}){return <div className="catalog-v4"><section className="cv4-state invalid"><strong>No se pudo consultar el catálogo</strong><p>La base no ha devuelto esta consulta. Tus filtros y la URL se mantienen intactos.</p><button type="button" onClick={()=>reset()}>Reintentar</button></section></div>}

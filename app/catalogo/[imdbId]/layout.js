import './series-command-v3.css';

// Ficha V4 is a database/detail surface, not a pipeline controller. Technical
// Lifecycle states belong to Calidad/Operaciones; the Ficha itself already
// exposes current PikoQuality and only real human-attention cases.
export default function CatalogDetailLayout({children}){
  return children;
}

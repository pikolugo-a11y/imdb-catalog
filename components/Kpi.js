export default function Kpi({ label, value, note, href }) {
  const content = <div className="kpi"><div className="kpi-label">{label}</div><div className="kpi-value">{Number(value ?? 0).toLocaleString('es-ES')}</div>{note && <div className="kpi-note">{note}</div>}</div>;
  if (!href) return content;
  return <a className="kpi-link" href={href}>{content}</a>;
}

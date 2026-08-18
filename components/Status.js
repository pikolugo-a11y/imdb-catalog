export function Status({ value }) {
  const map = {
    in_plex: ['En Plex','ok'],
    acquiring: ['En proceso','warn'],
    missing: ['Falta','bad']
  };
  const normalized = value === 'in_plex' ? 'in_plex' : value === 'acquiring' ? 'acquiring' : 'missing';
  const [label, cls] = map[normalized];
  return <span className={`status ${cls}`}>{label}</span>;
}

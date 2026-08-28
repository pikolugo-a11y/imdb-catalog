const processCatalog={
  'PROC-ID-001':{name:'Obtener identidad'},
};

const kindLabels={individual:'Individual',batch:'Batch',system:'Sistema'};
const entityLabels={title:'Título',movie:'Película',series:'Serie',season:'Temporada',episode:'Episodio',person:'Persona'};
const triggerLabels={calidad_identidad_manual:'Manual desde Calidad'};
const executorLabels={vercel:'Vercel',railway:'Railway'};

export const processDisplay=code=>({code,name:processCatalog[code]?.name||code});
export const kindDisplay=value=>kindLabels[value]||value||'—';
export const entityDisplay=value=>entityLabels[value]||value||'Sin entidad';
export const triggerDisplay=value=>triggerLabels[value]||value||'Origen desconocido';
export const executorDisplay=value=>executorLabels[value]||value||'Ejecutor desconocido';

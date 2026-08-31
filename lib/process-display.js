const processCatalog={
  'PROC-ID-001':{name:'Obtener identidad'},
  'PROC-ID-002':{name:'Corregir identidad'},
  'PROC-IV-001':{name:'Obtener evidencia de identidad'},
  'PROC-IV-002':{name:'Validar identidad'},
  'PROC-IV-003':{name:'Corregir IDs durante validación'},
  'PROC-IV-004':{name:'Decisión manual de identidad'},
  'PROC-IV-005':{name:'Forzar asociación de identidad'},
  'PROC-DATA-001':{name:'Completar datos estructurales'},
  'PROC-DATA-002':{name:'Refrescar ratings'},
  'PROC-DATA-003':{name:'Calcular PikoScore'},
  'PROC-DATA-005':{name:'Aceptar datos incompletos'},
  'PROC-MOV-001':{name:'Validar archivo físico'},
  'PROC-MOV-002':{name:'Aceptar incidencia de película'},
  'PROC-OPS-001':{name:'Reiniciar título desde Novedades'},
};

const kindLabels={individual:'Individual',batch:'Batch',system:'Sistema'};
const entityLabels={title:'Título',movie:'Película',series:'Serie',season:'Temporada',episode:'Episodio',person:'Persona'};
const triggerLabels={calidad_identidad_manual:'Manual desde Calidad',calidad_validacion_identidad_manual:'Manual desde Validación de identidad',calidad_datos_manual:'Manual desde Datos',calidad_peliculas_manual:'Manual desde Películas',operations_manual:'Manual desde Operaciones'};
const executorLabels={vercel:'Vercel',railway:'Railway'};

export const processDisplay=code=>({code,name:processCatalog[code]?.name||code});
export const kindDisplay=value=>kindLabels[value]||value||'—';
export const entityDisplay=value=>entityLabels[value]||value||'Sin entidad';
export const triggerDisplay=value=>triggerLabels[value]||value||'Origen desconocido';
export const executorDisplay=value=>executorLabels[value]||value||'Ejecutor desconocido';

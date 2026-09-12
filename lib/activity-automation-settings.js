import 'server-only';
import {db} from './db';

export const AUTOMATION_SETTING_KEY='automation_schedule_v1';
export const AUTOMATION_PROFILES={
  balanced:{label:'Equilibrado',hours:[3,7,11,15,19,23],description:'Reparte el trabajo durante todo el día.'},
  dawn:{label:'Madrugada',hours:[3,7],description:'Prioriza la madrugada y primera hora.'},
  morning:{label:'Mañana',hours:[7,11],description:'Prioriza la mañana.'},
  afternoon:{label:'Tarde',hours:[15,19],description:'Prioriza la tarde.'},
  night:{label:'Noche',hours:[19,23],description:'Prioriza la tarde-noche y la noche.'},
};

export const CONFIGURABLE_AUTOMATIONS=[
  {code:'PROC-MOV-001',title:'Validación de archivos de películas',domain:'Calidad',description:'Comprueba automáticamente los archivos físicos que necesitan validación.',dueText:'Cuando una película queda pendiente de validación física.'},
  {code:'PROC-SER-002',title:'Detalle Plex de Series',domain:'Plex',description:'Continúa cambios de Series ya detectados por Plex y reconstruye su diagnóstico.',dueText:'Cuando una serie queda invalidada o necesita refresco de detalle Plex.'},
  {code:'PROC-SER-003',title:'Referencias TMDb de Series',domain:'Calidad',description:'Actualiza la referencia TMDb de las series cuando vuelve a tocar comprobarla.',dueText:'Según la próxima fecha de comprobación de cada serie.'},
  {code:'PROC-SER-004',title:'Disponibilidad de Series en España',domain:'Calidad',description:'Recomprueba disponibilidad española de temporadas que siguen sin resolver.',dueText:'Cuando vence el periodo de revisión de disponibilidad.'},
  {code:'PROC-DATA-002',title:'Valoraciones',domain:'Calidad',description:'Refresca las valoraciones cuando dejan de estar suficientemente frescas.',dueText:'Según la antigüedad del título: PikoFilm calcula cuándo toca refrescarlo.'},
  {code:'PROC-PER-001',title:'Personas',domain:'Personas',description:'Actualiza perfiles y filmografías relevantes cuando vencen.',dueText:'Según actividad reciente y última actualización de cada persona.'},
  {code:'PROC-PQ-001',title:'PikoQuality',domain:'Calidad',description:'Recalcula PikoQuality para elementos que han quedado pendientes.',dueText:'Cuando existen elementos pendientes de recalcular.'},
];

export const SYSTEM_AUTOMATIONS=[
  {code:'PROC-PLAN-002',title:'Organizador automático',description:'Despierta PikoFilm, revisa lo vencido, equilibra la carga y lanza lo que toca.',scheduleText:'Cada hora',editable:false},
  {code:'PROC-HOME-001',title:'Snapshot diario del Dashboard',description:'Guarda una fotografía histórica agregada del Dashboard.',scheduleText:'Una vez al día',editable:false},
];

const configurableCodes=new Set(CONFIGURABLE_AUTOMATIONS.map(x=>x.code));
export function isConfigurableAutomation(code){return configurableCodes.has(String(code||''));}
export function automationProfile(profile){return AUTOMATION_PROFILES[profile]||AUTOMATION_PROFILES.balanced;}
function defaults(){return{version:1,processes:Object.fromEntries(CONFIGURABLE_AUTOMATIONS.map(x=>[x.code,{enabled:true,profile:'balanced'}]))};}
export function normalizeAutomationSettings(value){
  const base=defaults(),source=value&&typeof value==='object'?value:{};
  for(const item of CONFIGURABLE_AUTOMATIONS){const current=source.processes?.[item.code]||{};base.processes[item.code]={enabled:current.enabled!==false,profile:AUTOMATION_PROFILES[current.profile]?current.profile:'balanced'};}
  return base;
}
export async function loadAutomationSettings(sql=db()){
  const [row]=await sql.query(`SELECT value FROM app_settings WHERE key=$1 LIMIT 1`,[AUTOMATION_SETTING_KEY]);
  return normalizeAutomationSettings(row?.value);
}
export async function saveAutomationSetting(sql,code,{enabled,profile}){
  if(!isConfigurableAutomation(code))throw new Error('Automatización no configurable');
  if(!AUTOMATION_PROFILES[profile])throw new Error('Franja no válida');
  const settings=await loadAutomationSettings(sql);settings.processes[code]={enabled:Boolean(enabled),profile};
  await sql.query(`INSERT INTO app_settings(key,value,description,updated_at) VALUES($1,$2::jsonb,$3,now()) ON CONFLICT(key) DO UPDATE SET value=excluded.value,description=excluded.description,updated_at=now()`,[AUTOMATION_SETTING_KEY,JSON.stringify(settings),'Configuración operativa de automatizaciones de Actividad']);
  return settings;
}

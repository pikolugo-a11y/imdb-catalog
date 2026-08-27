const hasValue=v=>v!==null&&v!==undefined&&v!==''&&!Number.isNaN(Number(v));
export const nf=v=>hasValue(v)?Number(v).toLocaleString('es-ES',{maximumFractionDigits:0}):'—';
export const one=v=>hasValue(v)?Number(v).toLocaleString('es-ES',{minimumFractionDigits:1,maximumFractionDigits:1}):'—';
export const pct=v=>{if(!hasValue(v))return'—';const n=Number(v);return `${Number.isInteger(n)?n.toLocaleString('es-ES'):one(n)} %`;};
export const score=v=>hasValue(v)?one(v):'—';
export const pp=v=>{if(!hasValue(v))return'—';const n=Number(v);return `${n>0?'+':''}${one(n)} pp`;};
export const decadeLabel=v=>{if(!hasValue(v))return'—';const y=Number(v);if(y>=2000)return`años ${y}`;return`años ${String(y).slice(-2).padStart(2,'0')}`;};
export const statusLabel=n=>Number(n)>=97?'Excelente':Number(n)>=92?'Muy bien':Number(n)>=85?'Correcto':Number(n)>=70?'Atención':'Crítico';

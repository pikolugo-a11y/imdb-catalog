import Link from '@/components/NoPrefetchLink';
import {getQualityHomeSnapshot} from '@/lib/quality-home';
import '../calidad-v4.css';
export const dynamic='force-dynamic';

const nf=n=>Number(n||0).toLocaleString('es-ES');
const stateLabel=stage=>stage.status.key==='healthy'?'Al día':stage.status.key==='pending'?'En seguimiento':'Requiere atención';

function Card({title,description,stages,links,wide=false}){
  const count=stages.reduce((n,s)=>n+Number(s?.count||0),0);
  const attention=stages.some(s=>['attention','blocked'].includes(s?.status?.key));
  const tracking=!attention&&stages.some(s=>s?.status?.key==='pending');
  const label=attention?'Requiere atención':tracking?'En seguimiento':'Al día';
  return <section className={`qv4-center-card${wide?' wide':''}`}><h2>{title}</h2><p>{description}</p><div className="qv4-center-links">{links.map(([href,label])=><Link key={href} href={href}>{label}<span>→</span></Link>)}</div><div className="qv4-center-stat"><div><strong>{nf(count)}</strong><span>casos en el área</span></div><span>{label}</span></div></section>;
}

export default async function CentroCalidad(){
  const home=await getQualityHomeSnapshot();
  const byId=Object.fromEntries(home.stages.map(stage=>[stage.id,stage]));
  return <div className="qv4-page">
    <header className="qv4-hero qv4-center-head"><div><div className="breadcrumbs"><Link href="/calidad">Calidad</Link><span>›</span><b>Centro de Calidad</b></div><div className="qv4-eyebrow">Áreas comunes</div><h1>Centro de Calidad</h1><p>Las áreas que comparten un mismo patrón viven juntas aquí. Entra sólo en la que quieras trabajar; no existe una cola transversal que te obligue a seguir un orden.</p></div><div className={`qv4-global qv4-${home.globalStatus.key}`}>{home.globalStatus.label}</div></header>

    <section className="qv4-center-grid">
      <Card title="Identidad + Validación" description="Resolver identificadores cuando faltan y decidir sólo las validaciones que realmente requieren criterio humano." stages={[byId.identity,byId.validation]} links={[[byId.identity.href,'Identidad'],[byId.validation.href,'Validación']]}/>
      <Card title="Datos + PikoScore" description="Completitud estructural, ratings y PikoScore. El mantenimiento por caducidad se mantiene en seguimiento automático." stages={[byId.data]} links={[[byId.data.href,'Abrir Datos']]}/>
      <Card title="Personas" description="Vigencia de perfiles y filmografías con refresco adaptativo; el control individual sigue disponible en cada persona." stages={[byId.people]} links={[[byId.people.href,'Abrir Personas']]}/>
      <Card title="PikoQuality" description="Salud y calidad técnica del archivo físico. Los barridos técnicos pertenecen a Operaciones; aquí queda la lectura funcional." stages={[byId.pikoquality]} links={[[byId.pikoquality.href,'Abrir PikoQuality']]}/>
      <Card wide title="Integridad Lifecycle" description="Recuperación excepcional de títulos sin estado y anomalías estructurales. No es mantenimiento ordinario ni una cola de trabajo diario." stages={[byId.recovery]} links={[[byId.recovery.href,'Revisar integridad'],['/admin','Ver detalle técnico']]}/>
    </section>

    <div className="qv4-center-note">Calidad muestra estado funcional y decisiones. Los procesos que sólo están ejecutándose, reintentando o esperando su próxima revisión no necesitan que pulses nada; su trazabilidad completa permanece en Operaciones.</div>
  </div>;
}

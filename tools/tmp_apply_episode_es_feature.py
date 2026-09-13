from pathlib import Path


def patch(path, old, new):
    p=Path(path); text=p.read_text()
    if old not in text:
        raise SystemExit(f'No se encontró el bloque esperado en {path}: {old[:120]!r}')
    p.write_text(text.replace(old,new,1))

# Server actions
p='app/calidad/series/actions.js'
patch(p,"import {confirmSeriesEsAvailability} from '@/lib/series-es-availability';", "import {confirmSeriesEsAvailability} from '@/lib/series-es-availability';\nimport {markAllEpisodesSpainAvailable,setEpisodeSpainAvailability} from '@/lib/series-episode-availability';")
marker='export async function reviewSeriesExtraAction(formData){'
insert="""export async function setEpisodeSpainAvailabilityAction(formData){
  const ratingKey=String(formData.get('ratingKey')||'').trim(),season=Number(formData.get('season')),episode=Number(formData.get('episode')),status=String(formData.get('status')||'').trim();
  if(!ratingKey||!Number.isInteger(season)||season<0||!Number.isInteger(episode)||episode<1||!['available','not_yet_available'].includes(status))throw new Error('Disponibilidad de episodio inválida');
  const sql=db(),entityId=`${ratingKey}:S${season}E${episode}`,requestKey=`PROC-SER-008:${entityId}:${status}:${Math.floor(Date.now()/3000)}`;
  const observed=await executeObservedProcess({processCode:'PROC-SER-008',runKind:'individual',triggerSource:'calidad_series_manual',executor:'vercel',entityType:'episode',entityId,correlationKey:requestKey,idempotencyKey:requestKey,context:{surface:`/calidad/series/${ratingKey}`,operation:'set_episode_es_availability',rating_key:ratingKey,season,episode,status}},async trace=>{
    const result=await setEpisodeSpainAvailability(sql,{ratingKey,season,episode,status,note:status==='available'?'Marcado manualmente como emitido en España':'Marcado manualmente como no emitido en España'});
    await trace.event({eventType:'manual_decision',step:'set_episode_es_availability',entityType:'episode',entityId,message:status==='available'?'Marcar episodio como emitido en España':'Marcar episodio como no emitido en España',data:{season,episode,status,previous_status:result.before?.availability_status||null}});
    await recomputeLifecycleForIds([result.imdbId]);await rebuildSeriesQualityReadModel(sql);
    return{technicalStatus:'succeeded',functionalResult:status==='available'?'available_es':'not_available_es',before:result.before||null,after:{availability_status:status,source:'manual_ui'},metrics:{episodes:1},message:status==='available'?'Episodio marcado como emitido en España':'Episodio marcado como no emitido en España',imdbId:result.imdbId,ratingKey,season,episode};
  });
  revalidate(ratingKey,observed.result?.imdbId);return observed.result;
}

export async function markAllEpisodesSpainAvailableAction(formData){
  const ratingKey=String(formData.get('ratingKey')||'').trim();if(!ratingKey)throw new Error('Serie inválida');
  const sql=db(),requestKey=`PROC-SER-008:${ratingKey}:all_available:${Math.floor(Date.now()/3000)}`;
  const observed=await executeObservedProcess({processCode:'PROC-SER-008',runKind:'individual',triggerSource:'calidad_series_manual',executor:'vercel',entityType:'series',entityId:ratingKey,correlationKey:requestKey,idempotencyKey:requestKey,context:{surface:`/calidad/series/${ratingKey}`,operation:'mark_all_episode_es_available',rating_key:ratingKey}},async trace=>{
    const result=await markAllEpisodesSpainAvailable(sql,{ratingKey});
    await trace.event({eventType:'manual_decision',step:'mark_all_episode_es_available',entityType:'series',entityId:ratingKey,message:'Marcar todos los episodios oficiales como emitidos en España',data:{episodes:result.total,already_available:result.alreadyAvailable,overwritten_no:result.overwrittenNo}});
    await recomputeLifecycleForIds([result.imdbId]);await rebuildSeriesQualityReadModel(sql);
    return{technicalStatus:'succeeded',functionalResult:'all_available_es',before:{already_available:result.alreadyAvailable,explicit_no:result.overwrittenNo},after:{availability_status:'available',episodes:result.total},metrics:{episodes:result.total,overwritten_no:result.overwrittenNo},message:`${result.total} episodios marcados como emitidos en España`,imdbId:result.imdbId,ratingKey};
  });
  revalidate(ratingKey,observed.result?.imdbId);return observed.result;
}

"""
patch(p,marker,insert+marker)

# Series detail frontend
p='app/calidad/series/[ratingKey]/page.js'
patch(p,"import {syncPlexSeriesDetailAction,refreshOneSeriesAction,confirmEsAvailabilityAction,reviewSeriesExtraAction,reviewSeriesDoubleEpisodeAction,resetSeasonAvailabilityAction} from '../actions';", "import {syncPlexSeriesDetailAction,refreshOneSeriesAction,confirmEsAvailabilityAction,reviewSeriesExtraAction,reviewSeriesDoubleEpisodeAction,resetSeasonAvailabilityAction,setEpisodeSpainAvailabilityAction,markAllEpisodesSpainAvailableAction} from '../actions';")
patch(p,"function ExtraFields({ratingKey,e,decision}){return <><input type=\"hidden\" name=\"ratingKey\" value={ratingKey}/><input type=\"hidden\" name=\"season\" value={e.season_number}/><input type=\"hidden\" name=\"episode\" value={e.episode_number}/><input type=\"hidden\" name=\"decision\" value={decision}/></>}", "function ExtraFields({ratingKey,e,decision}){return <><input type=\"hidden\" name=\"ratingKey\" value={ratingKey}/><input type=\"hidden\" name=\"season\" value={e.season_number}/><input type=\"hidden\" name=\"episode\" value={e.episode_number}/><input type=\"hidden\" name=\"decision\" value={decision}/></>}\nfunction EpisodeEsFields({ratingKey,e,status}){return <><input type=\"hidden\" name=\"ratingKey\" value={ratingKey}/><input type=\"hidden\" name=\"season\" value={e.season_number}/><input type=\"hidden\" name=\"episode\" value={e.episode_number}/><input type=\"hidden\" name=\"status\" value={status}/></>}")
maintenance='    <section className="maintenance-card compact-maintenance"><div className="section-head"><div><h2>Actualizar fuentes</h2><p>Controles manuales disponibles sin seguimiento batch en esta pantalla.</p></div></div><div className="maintenance-actions">{maintenance.map(m=><ActionButton key={m.key} action={maintenanceAction(m.key)} fields={m.key===\'tmdb\'?{ratingKey,imdbId:summary.imdb_id}:{ratingKey}} label={`Actualizar ${m.label}`} pendingLabel={maintenancePending(m.key)}/>)}</div></section>\n'
spain=maintenance+'\n    <section className="maintenance-card compact-maintenance"><div className="section-head"><div><h2>Disponibilidad en España por episodio</h2><p>Corrección manual excepcional. No carga la serie completa en el navegador.</p></div></div><div className="maintenance-actions"><form action={markAllEpisodesSpainAvailableAction}><input type="hidden" name="ratingKey" value={ratingKey}/><ConfirmSubmitButton message={`¿Marcar los ${t.total} episodios oficiales como emitidos en España? Esto sobrescribirá cualquier “No emitido” guardado a nivel de episodio.`} pendingLabel="Marcando episodios…">Marcar todo como emitido en España</ConfirmSubmitButton></form></div></section>\n'
patch(p,maintenance,spain)
patch(p,'<div className="episode-expanded"><Evidence e={e}/>{e.plex_diagnostic_status===\'missing\'&&sourceEpisode>0&&<div className="availability-actions">', '<div className="episode-expanded"><Evidence e={e}/><div className="availability-actions"><form action={setEpisodeSpainAvailabilityAction}><EpisodeEsFields ratingKey={ratingKey} e={e} status="available"/><PendingSubmitButton pendingLabel="Guardando…">Emitido en España</PendingSubmitButton></form><form action={setEpisodeSpainAvailabilityAction}><EpisodeEsFields ratingKey={ratingKey} e={e} status="not_yet_available"/><PendingSubmitButton pendingLabel="Guardando…">No emitido en España</PendingSubmitButton></form></div>{e.plex_diagnostic_status===\'missing\'&&sourceEpisode>0&&<div className="availability-actions">')

# Human-readable process name
p='lib/process-display.js'
patch(p,"'PROC-SER-006':{name:'Volver disponibilidad de temporada a automático'},'PROC-SER-007':{name:'Actualizar perfil de catálogo de Series'},", "'PROC-SER-006':{name:'Volver disponibilidad de temporada a automático'},'PROC-SER-007':{name:'Actualizar perfil de catálogo de Series'},'PROC-SER-008':{name:'Corregir disponibilidad España por episodio'},")

# Canonical process docs
p='docs/processes/PROCESS_CATALOG.md'
patch(p,"| PROC-SER-006 | Series | Retirar override de disponibilidad | manual | no | acción observada + refresh | Vercel | NO APLICA |", "| PROC-SER-006 | Series | Retirar override de disponibilidad | manual | no | acción observada + refresh | Vercel | NO APLICA |\n| PROC-SER-008 | Series | Corregir disponibilidad España por episodio / marcar toda la serie | manual | no | `series-episode-availability.js` + acción observada | Vercel | NO APLICA |")

# Contract test
Path('test/ser008-episode-es-availability-contract.test.mjs').write_text("""import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\nconst read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');\nconst core=read('../lib/series-episode-availability.js');\nconst actions=read('../app/calidad/series/actions.js');\nconst page=read('../app/calidad/series/[ratingKey]/page.js');\nconst display=read('../lib/process-display.js');\n\ntest('SER-008 gobierna correcciones España por episodio',()=>{assert.match(actions,/processCode:'PROC-SER-008'/);assert.match(actions,/setEpisodeSpainAvailabilityAction/);assert.match(actions,/markAllEpisodesSpainAvailableAction/);assert.match(actions,/eventType:'manual_decision'/);assert.match(display,/'PROC-SER-008':\\{name:'Corregir disponibilidad España por episodio'\\}/)});\ntest('marcar todo se resuelve en PostgreSQL sin cargar miles de episodios en el navegador',()=>{assert.match(core,/INSERT INTO series_episode_availability/);assert.match(core,/SELECT e\\.show_rating_key,e\\.season_number,e\\.episode_number/);assert.match(core,/ON CONFLICT\\(show_rating_key,season_number,episode_number,country_code\\) DO UPDATE/);assert.match(page,/Marcar todo como emitido en España/);assert.match(page,/Esto sobrescribirá cualquier “No emitido”/)});\ntest('la ficha permite corregir Sí No sólo para el episodio abierto',()=>{assert.match(page,/EpisodeEsFields/);assert.match(page,/>Emitido en España</);assert.match(page,/>No emitido en España</);assert.match(page,/SERIES_EPISODE_PAGE_SIZE|episodeData\\.pages/)});\n""")

# Ensure CI runs the new contract
p='package.json'; text=Path(p).read_text(); old='test/ser006-reset-availability-observability-contract.test.mjs test/series-read-model-parity-contract.test.mjs'; new='test/ser006-reset-availability-observability-contract.test.mjs test/ser008-episode-es-availability-contract.test.mjs test/series-read-model-parity-contract.test.mjs';
if old not in text: raise SystemExit('No se encontró ancla package.json')
Path(p).write_text(text.replace(old,new,1))
print('Parche SER-008 aplicado')

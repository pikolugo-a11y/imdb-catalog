'use client';

import {excludeTitle} from '@/app/actions';

export default function ExcludeTitleForm({imdbId,returnTo,label='Excluir de PikoFilm'}){
  function confirmExclude(event){
    if(!window.confirm('¿Excluir esta obra de PikoFilm? Pasará a Excluidas y dejará de formar parte del Catálogo activo.'))event.preventDefault();
  }
  return <form action={excludeTitle} onSubmit={confirmExclude}>
    <input type="hidden" name="imdbId" value={imdbId}/>
    <input type="hidden" name="returnTo" value={returnTo}/>
    <button className="fv4-exclude" type="submit">{label}</button>
  </form>;
}

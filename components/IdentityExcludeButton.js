'use client';
import {excludeTitle} from '@/app/actions';
export default function IdentityExcludeButton({imdbId,title,inPlex,returnTo}){
  return <form action={excludeTitle} onSubmit={e=>{const msg=inPlex?`“${title}” está actualmente en Plex. Excluir no borra el archivo físico, pero lo sacará del catálogo operativo y de sus colas. ¿Excluir?`:`¿Excluir “${title}” del catálogo operativo?`;if(!window.confirm(msg))e.preventDefault();}}>
    <input type="hidden" name="imdbId" value={imdbId}/><input type="hidden" name="returnTo" value={returnTo}/><button className="identity-action-danger">Excluir</button>
  </form>;
}

'use client';

import {excludeTitle} from '@/app/actions';
import ConfirmSubmitButton from '@/components/ConfirmSubmitButton';

export default function ExcludeTitleForm({imdbId,returnTo,label='Excluir de PikoFilm'}){
  return <form action={excludeTitle}>
    <input type="hidden" name="imdbId" value={imdbId}/>
    <input type="hidden" name="returnTo" value={returnTo}/>
    <ConfirmSubmitButton className="fv4-exclude" message="¿Excluir esta obra de PikoFilm? Pasará a Excluidas y dejará de formar parte del Catálogo activo." pendingLabel="Excluyendo…">{label}</ConfirmSubmitButton>
  </form>;
}

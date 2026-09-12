'use client';
import {useFormStatus} from 'react-dom';

export default function PendingSubmitButton({children,pendingLabel='Procesando…',disabled=false,...props}){
  const{pending}=useFormStatus();
  return <button {...props} disabled={disabled||pending}>{pending?pendingLabel:children}</button>;
}

'use client';
import {useFormStatus} from 'react-dom';

export default function ConfirmSubmitButton({children,message,pendingLabel='Procesando…',disabled=false,...props}){
  const{pending}=useFormStatus();
  const confirm=event=>{if(!pending&&!window.confirm(message))event.preventDefault()};
  return <button {...props} type="submit" disabled={disabled||pending} onClick={confirm}>{pending?pendingLabel:children}</button>;
}

'use client';
import {useActionState} from 'react';
export default function ActionButton({action,label,pendingLabel='Procesando…',className='',fields={}}){const[state,formAction,pending]=useActionState(action,null);return <div className="action-stack"><form action={formAction}>{Object.entries(fields).map(([k,v])=><input key={k} type="hidden" name={k} value={v??''}/>)}<button className={className} disabled={pending}>{pending?pendingLabel:label}</button></form>{state?.message&&<small className={state.ok?'action-ok':'action-error'}>{state.message}</small>}</div>}

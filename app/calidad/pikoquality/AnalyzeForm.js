'use client';

import {useActionState} from 'react';
import {useFormStatus} from 'react-dom';
import {analyzeOnePikoQualityAction} from './actions';
import styles from './pikoquality.module.css';

const initialState={success:null,message:''};

function Submit(){
  const {pending}=useFormStatus();
  return <button className={styles.analyzeButton} type="submit" disabled={pending} aria-busy={pending}>{pending?'Analizando…':'Analizar'}</button>;
}

export default function AnalyzeForm({imdbId}){
  const [state,action]=useActionState(analyzeOnePikoQualityAction,initialState);
  return <form action={action} className={styles.analyzeForm}>
    <input type="hidden" name="imdbId" value={imdbId}/>
    <Submit/>
    {state?.message?<span className={state.success?styles.inlineSuccess:styles.inlineError} role="status">{state.message}</span>:null}
  </form>;
}

'use client';

import {useFormStatus} from 'react-dom';
import styles from './pikoquality.module.css';

export default function AnalyzeSubmitButton(){
  const {pending}=useFormStatus();
  return <button className={styles.analyzeButton} type="submit" disabled={pending} aria-busy={pending}>{pending?'Analizando…':'Analizar'}</button>;
}

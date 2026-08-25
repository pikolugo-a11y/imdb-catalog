'use client';
import {useEffect,useRef} from 'react';
import {useRouter} from 'next/navigation';
export default function IdentityAutoRefresh(){
  const router=useRouter(),hiddenAt=useRef(null);
  useEffect(()=>{const onVisibility=()=>{if(document.hidden){hiddenAt.current=Date.now();return}const elapsed=hiddenAt.current?Date.now()-hiddenAt.current:0;hiddenAt.current=null;const active=document.activeElement,editing=active&&['INPUT','TEXTAREA','SELECT'].includes(active.tagName)||document.querySelector('[data-identity-edit-open="true"]');if(elapsed>=180000&&!editing)router.refresh()};document.addEventListener('visibilitychange',onVisibility);return()=>document.removeEventListener('visibilitychange',onVisibility)},[router]);
  return null;
}

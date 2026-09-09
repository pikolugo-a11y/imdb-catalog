'use client';
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';

export default function ActivityRefresh(){
  const router=useRouter();
  useEffect(()=>{
    let timer=null;
    const refresh=()=>{if(document.visibilityState==='visible')router.refresh();};
    const arm=()=>{clearInterval(timer);if(document.visibilityState==='visible')timer=setInterval(refresh,30000);};
    const onVisibility=()=>{if(document.visibilityState==='visible')refresh();arm();};
    document.addEventListener('visibilitychange',onVisibility);window.addEventListener('focus',refresh);arm();
    return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',onVisibility);window.removeEventListener('focus',refresh);};
  },[router]);
  return null;
}

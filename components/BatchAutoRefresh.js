'use client';
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';

export default function BatchAutoRefresh({active=false,paused=false}){
  const router=useRouter();
  useEffect(()=>{
    if(!active)return undefined;
    const ms=paused?7000:3000;
    const timer=setInterval(()=>router.refresh(),ms);
    return()=>clearInterval(timer);
  },[active,paused,router]);
  return null;
}

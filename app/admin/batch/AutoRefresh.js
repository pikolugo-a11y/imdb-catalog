'use client';
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';

export default function AutoRefresh({active=false,interval=4000}){
  const router=useRouter();
  useEffect(()=>{
    if(!active)return;
    const id=setInterval(()=>router.refresh(),interval);
    return()=>clearInterval(id);
  },[active,interval,router]);
  return null;
}

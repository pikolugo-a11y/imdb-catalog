'use client';
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';

export default function TechnicalAutoRefresh({active=false}){
  const router=useRouter();
  useEffect(()=>{
    if(!active)return;
    const id=setInterval(()=>router.refresh(),2000);
    return()=>clearInterval(id);
  },[active,router]);
  return null;
}

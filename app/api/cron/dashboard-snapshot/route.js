import {NextResponse} from 'next/server';
import {captureDashboardSnapshot} from '@/lib/dashboard-v2';
import {appendDatabaseStorageSnapshot} from '@/lib/database-storage';
import {isCronAuthorized} from '@/lib/cron-auth';

export const dynamic='force-dynamic';

export async function GET(request){
  if(!isCronAuthorized(request))return NextResponse.json({ok:false,error:'unauthorized'},{status:401});
  try{
    const metrics=await captureDashboardSnapshot();
    const storage=await appendDatabaseStorageSnapshot();
    return NextResponse.json({ok:true,date:new Date().toISOString().slice(0,10),metrics:{...metrics,...storage}});
  }catch(error){
    console.error('dashboard snapshot cron',error);
    return NextResponse.json({ok:false,error:'snapshot_failed'},{status:500});
  }
}

import {NextResponse} from 'next/server';
import {captureDashboardSnapshot} from '@/lib/dashboard-v2';
export const dynamic='force-dynamic';
export async function GET(request){
  const secret=process.env.CRON_SECRET;
  if(secret&&request.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({ok:false,error:'unauthorized'},{status:401});
  try{const metrics=await captureDashboardSnapshot();return NextResponse.json({ok:true,date:new Date().toISOString().slice(0,10),metrics})}catch(error){console.error('dashboard snapshot cron',error);return NextResponse.json({ok:false,error:'snapshot_failed'},{status:500})}
}

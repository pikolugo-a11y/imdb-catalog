import {NextResponse} from 'next/server';
import {rebuildAggregates,DEFAULT_A_BATCH} from '../../../../lib/pikoquality';
import {processLifecycleABatch} from '../../../../lib/pikoquality-lifecycle-a';
import {getPikoQualityState} from '../../../../lib/pikoquality-state';
import {enrichPending,DEFAULT_B_BATCH} from '../../../../lib/pikoquality-enrichment';

export const dynamic='force-dynamic';
export const maxDuration=60;

export async function POST(request){
  try{
    const body=await request.json().catch(()=>({}));
    const phase=String(body?.phase||'');
    let result;
    if(phase==='a')result=await processLifecycleABatch(DEFAULT_A_BATCH);
    else if(phase==='b')result=await enrichPending(DEFAULT_B_BATCH,false);
    else if(phase==='retry_b')result=await enrichPending(80,true);
    else if(phase==='aggregate')result=await rebuildAggregates();
    else return NextResponse.json({ok:false,error:'Fase PikoQuality no válida'},{status:400});
    const state=await getPikoQualityState();
    return NextResponse.json({ok:true,phase,result,state});
  }catch(e){
    return NextResponse.json({ok:false,error:String(e?.message||e)},{status:500});
  }
}

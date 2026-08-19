'use server';
import {revalidatePath} from 'next/cache';
import {runPikoQualityBProbe} from '@/lib/pikoquality-b-probe';

export async function runPikoQualityBProbeAction(){
  try{
    const r=await runPikoQualityBProbe();
    revalidatePath('/admin/pikoquality-probe');
    revalidatePath('/admin');
    return{ok:true,message:`Piloto B completado: ${r.count} muestras · streams ${r.coverage.with_streams}/${r.count} · bit depth ${r.coverage.bit_depth}/${r.count} · audio bitrate ${r.coverage.audio_bitrate}/${r.count}`};
  }catch(e){
    revalidatePath('/admin/pikoquality-probe');
    revalidatePath('/admin');
    return{ok:false,message:e?.message||'No se pudo ejecutar el piloto PikoQuality B'};
  }
}

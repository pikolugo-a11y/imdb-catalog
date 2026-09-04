import {NextResponse} from 'next/server';
import {globalSearch} from '@/lib/global-search';

export const dynamic='force-dynamic';

export async function GET(request){
  const {searchParams}=new URL(request.url);
  const q=String(searchParams.get('q')||'').trim();
  if(!q)return NextResponse.json({titles:[],people:[],sagas:[]});
  try{return NextResponse.json(await globalSearch(q));}
  catch(error){console.error('global-search',error);return NextResponse.json({error:'No se pudo completar la búsqueda.'},{status:500});}
}

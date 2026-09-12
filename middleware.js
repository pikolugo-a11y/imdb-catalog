import {NextResponse} from 'next/server';

const ACCESS_COOKIE='pikofilm_private';
const ACCESS_HASH='426b0675f22600ef525f3f4af7df3f2c984e5b1b3ccbda92408f38dcbc0f703b';
const PUBLIC_CONTROL_PATHS=new Set([
  '/api/cron/activity-planner',
  '/api/cron/dashboard-snapshot',
  '/robots.txt',
]);

async function sha256(value){
  const bytes=new TextEncoder().encode(String(value||''));
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}

function notFound(){
  return new NextResponse('Not Found',{
    status:404,
    headers:{
      'content-type':'text/plain; charset=utf-8',
      'cache-control':'private, no-store, max-age=0',
      'x-robots-tag':'noindex, nofollow, noarchive',
    },
  });
}

export async function middleware(request){
  const {pathname,searchParams}=request.nextUrl;

  // Never execute malformed dynamic routes that can be emitted by legacy data.
  if(pathname.endsWith('/null')||pathname.endsWith('/undefined'))return notFound();

  // Cron endpoints keep their own fail-closed CRON_SECRET authentication. They
  // must reach the route without opening any other database-backed surface.
  if(PUBLIC_CONTROL_PATHS.has(pathname))return NextResponse.next();

  const supplied=searchParams.get('access');
  if(supplied&&await sha256(supplied)===ACCESS_HASH){
    const url=request.nextUrl.clone();
    url.searchParams.delete('access');
    const response=NextResponse.redirect(url);
    response.cookies.set(ACCESS_COOKIE,supplied,{
      httpOnly:true,
      secure:true,
      sameSite:'strict',
      path:'/',
      maxAge:60*60*24*365,
    });
    return response;
  }

  const cookie=request.cookies.get(ACCESS_COOKIE)?.value;
  if(cookie&&await sha256(cookie)===ACCESS_HASH)return NextResponse.next();

  return notFound();
}

export const config={
  matcher:['/((?!_next/static|_next/image|favicon.ico).*)'],
};

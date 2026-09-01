import {neon} from '@neondatabase/serverless';
import {executeMov001Canonical,getMov001Snapshot} from '../lib/mov001-canonical.mjs';

const imdbId=process.argv[2];
if(!/^tt\d+$/.test(String(imdbId||''))) throw new Error('IMDb ID inválido');
if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL no está configurada');
const sql=neon(process.env.DATABASE_URL);
const before=await getMov001Snapshot(sql,imdbId);
const result=await executeMov001Canonical(sql,imdbId);
const after=await getMov001Snapshot(sql,imdbId);
console.log(JSON.stringify({imdbId,before,after,result},null,2));

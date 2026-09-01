import 'server-only';
import {db} from './db';
import {executeData001Canonical} from './data001-canonical.mjs';
import {createApiGate} from './batch-api-governance.mjs';

export async function updateDataQualityTitle(imdbId,{trace=null}={}){
  const sql=db();
  return executeData001Canonical(sql,imdbId,{trace,lane:'manual',apiGate:createApiGate(sql)});
}

import 'server-only';
import {db} from './db';
import {createApiGate} from './batch-api-governance.mjs';
import {normalizeIdentityTitle,validateIdentityEvidence} from './identity-title-normalization';
import {executeIv001Canonical,executeIv002Canonical} from './identity-validation-canonical.mjs';

export const normalizeTitle=normalizeIdentityTitle;
export const validateEvidence=validateIdentityEvidence;

export async function refreshIdentityEvidence(imdbId,trace=null){
  const sql=db();
  return executeIv001Canonical(sql,imdbId,{trace,lane:'manual',apiGate:createApiGate(sql)});
}

export async function validateOne(imdbId,trace=null){
  const sql=db();
  return executeIv002Canonical(sql,imdbId,{trace});
}

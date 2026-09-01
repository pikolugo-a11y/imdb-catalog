import 'server-only';
import {db} from './db';
import {audit,errorInfo} from './runlog';
import {normalizeIdentityTitle,validateIdentityEvidence} from './identity-title-normalization';
import {createApiGate} from './batch-api-governance.mjs';
import {imdbEvidenceCanonical,tmdbEvidenceCanonical,refreshIdentityEvidenceCanonical,persistIdentityValidationCanonical,validateIdentityCanonical} from './identity-validation-canonical.mjs';

export const normalizeTitle=normalizeIdentityTitle;
export const validateEvidence=validateIdentityEvidence;

export async function imdbEvidenceFromDb(imdbId,trace=null){const sql=db();return imdbEvidenceCanonical(sql,imdbId,{trace,lane:'manual',apiGate:createApiGate(sql)})}
export async function tmdbEvidence(imdbId,tmdbId,type,trace=null){const sql=db();return tmdbEvidenceCanonical(sql,imdbId,tmdbId,type,{trace,lane:'manual',apiGate:createApiGate(sql)})}

export async function refreshIdentityEvidence(imdbId,trace=null){const sql=db(),started=Date.now();if(!trace){const[m]=await sql`SELECT tmdb_id FROM movies WHERE imdb_id=${imdbId}`;await audit('identity_validation','title',imdbId,'evidence_refresh_started',{tmdb_id:m?.tmdb_id||null,validation_version:'2.0.0'})}try{const r=await refreshIdentityEvidenceCanonical(sql,imdbId,{trace,lane:'manual',apiGate:createApiGate(sql)});if(!trace)await audit('identity_validation','title',imdbId,'evidence_refresh_completed',{complete:r.complete,duration_ms:Date.now()-started,link_evidence:r.evidence?.link_evidence||null});return r}catch(error){if(!trace)await audit('identity_validation','title',imdbId,'evidence_refresh_failed',{duration_ms:Date.now()-started,error:errorInfo(error)});throw error}}

export async function persistValidation(imdbId,evidence,trace=null){const sql=db(),r=await persistIdentityValidationCanonical(sql,imdbId,evidence,{trace});if(!trace)await audit('identity_validation','title',imdbId,'validation_scored',{status:r.automaticStatus||r.status,score:r.score,details:r.details});return r}

export async function validateOne(imdbId,trace=null){const sql=db();if(!trace)await audit('identity_validation','title',imdbId,'validation_started',{validation_version:'2.0.0'});return validateIdentityCanonical(sql,imdbId,{trace})}

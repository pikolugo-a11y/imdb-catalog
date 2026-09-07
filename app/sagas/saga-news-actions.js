'use server';
import {routeToNewsAction} from '@/app/novedades/intake-actions';

export async function addSagaMemberToNewsAction(formData){
  formData.set('origin','saga');
  formData.set('candidateType','movie');
  return routeToNewsAction(formData);
}

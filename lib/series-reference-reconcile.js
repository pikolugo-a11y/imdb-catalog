import 'server-only';
import {reconcileSeriesReferencesFromPlexCore} from './series-reference-reconcile-core.mjs';

export async function reconcileSeriesReferencesFromPlex(sql){
  return reconcileSeriesReferencesFromPlexCore(sql);
}

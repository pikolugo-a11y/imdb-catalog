import IdentityValidationBatchPanel from '@/components/IdentityValidationBatchPanel';
import IdentityBatchAutoRefresh from '@/components/IdentityBatchAutoRefresh';
import {getIdentityValidationBatchState} from '@/lib/identity-validation-batch';
import './validation-batch.css';
export const dynamic='force-dynamic';
export default async function IdentityValidationLayout({children}){const state=await getIdentityValidationBatchState(),active=Boolean(state.iv001.active||state.iv002.active);return <><IdentityBatchAutoRefresh active={active}/><IdentityValidationBatchPanel state={state}/>{children}</>}

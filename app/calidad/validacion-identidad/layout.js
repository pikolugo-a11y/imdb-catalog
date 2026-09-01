import IvBatchPanels from '@/components/IvBatchPanels';
import IdentityBatchAutoRefresh from '@/components/IdentityBatchAutoRefresh';
import {getIvBatchPanelState} from '@/lib/iv-batch';
export const dynamic='force-dynamic';
export default async function IdentityValidationLayout({children}){const[iv001,iv002]=await Promise.all([getIvBatchPanelState('PROC-IV-001'),getIvBatchPanelState('PROC-IV-002')]);return <><IdentityBatchAutoRefresh active={Boolean(iv001.active||iv002.active)}/><IvBatchPanels iv001={iv001} iv002={iv002}/>{children}</>}

import Mov001BatchPanel from '@/components/Mov001BatchPanel';
import {getMov001BatchPanelState} from '@/lib/mov001-batch';

export const dynamic='force-dynamic';
export default async function Layout({children}){const state=await getMov001BatchPanelState();return <><div className="movie-batch-slot"><Mov001BatchPanel state={state}/></div>{children}</>}

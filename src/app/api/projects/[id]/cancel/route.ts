import {cancelRound2} from '../../../../../../server/agent/round2';
import {safeRoute} from '../../../../../../server/agent/http';
export const runtime='nodejs';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
  return safeRoute(request,async()=>Response.json(await cancelRound2((await params).id)));
}

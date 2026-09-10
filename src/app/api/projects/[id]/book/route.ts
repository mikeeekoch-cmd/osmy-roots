import {prepareEdition} from '../../../../../../server/agent/editions';
import {loadProject} from '../../../../../../server/state/store';
import {prepareRound2Book} from '../../../../../../server/agent/round2';
import {safeRoute} from '../../../../../../server/agent/http';
export const runtime='nodejs';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
  return safeRoute(request,async()=>Response.json(await ((await loadProject((await params).id)).research?prepareEdition((await params).id):prepareRound2Book((await params).id))));
}

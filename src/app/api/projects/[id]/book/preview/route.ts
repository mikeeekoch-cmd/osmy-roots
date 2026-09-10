import {previewEdition} from '../../../../../../../server/agent/editions';
import {loadProject} from '../../../../../../../server/state/store';
import {previewRound2Book} from '../../../../../../../server/agent/round2';
import {safeRoute} from '../../../../../../../server/agent/http';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
  return safeRoute(request,async()=>new Response(new Uint8Array(await ((await loadProject((await params).id)).research?previewEdition((await params).id):previewRound2Book((await params).id))),{headers:{'Content-Type':'application/pdf','Cache-Control':'no-store'}}));
}

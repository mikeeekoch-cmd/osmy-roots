import {previewRound2Book} from '../../../../../../../server/agent/round2';
import {safeRoute} from '../../../../../../../server/agent/http';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
  return safeRoute(request,async()=>new Response(new Uint8Array(await previewRound2Book((await params).id)),{headers:{'Content-Type':'application/pdf','Cache-Control':'no-store'}}));
}

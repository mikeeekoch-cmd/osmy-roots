import {cycleAction} from '../../../../../../server/agent/research';
import {safeRoute} from '../../../../../../server/agent/http';
export const runtime='nodejs';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){return safeRoute(request,async()=>Response.json(await cycleAction((await params).id,await request.json())));}

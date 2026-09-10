import {safeRoute} from '../../../../../../server/agent/http';
import {disconnectConnection} from '../../../../../../server/connectors/google';
export const runtime='nodejs';
export async function POST(request:Request,{params}:{params:Promise<{provider:string}>}){return safeRoute(request,async()=>Response.json(await disconnectConnection((await params).provider)));}

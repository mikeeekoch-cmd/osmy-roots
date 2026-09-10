import {safeRoute} from '../../../../server/agent/http';
import {connectionStatuses} from '../../../../server/connectors/google';
export const runtime='nodejs';
export async function GET(request:Request){return safeRoute(request,async()=>Response.json(await connectionStatuses(),{headers:{'Cache-Control':'no-store'}}));}

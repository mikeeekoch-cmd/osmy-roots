import {safeRoute} from '../../../../../../server/agent/http';
import {beginConnection} from '../../../../../../server/connectors/google';
export const runtime='nodejs';
export async function POST(request:Request,{params}:{params:Promise<{provider:string}>}){return safeRoute(request,async()=>{const {url,state}=await beginConnection((await params).provider);return Response.json({url},{headers:{'Set-Cookie':`roots-oauth=${state}; HttpOnly; SameSite=Lax; Path=/api/connections/callback; Max-Age=600`,'Cache-Control':'no-store'}});});}

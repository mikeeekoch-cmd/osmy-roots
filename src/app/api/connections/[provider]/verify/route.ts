import {z} from 'zod';
import {safeRoute} from '../../../../../../server/agent/http';
import {verifyConnection} from '../../../../../../server/connectors/google';
export const runtime='nodejs';
export async function POST(request:Request,{params}:{params:Promise<{provider:string}>}){return safeRoute(request,async()=>{const input=z.object({selectedScope:z.array(z.string()).max(40).default([])}).parse(await request.json());return Response.json(await verifyConnection((await params).provider,input.selectedScope));});}

import {z} from 'zod';
import {importProviderSources} from '../../../../../../server/agent/research';
import {safeRoute} from '../../../../../../server/agent/http';
export const runtime='nodejs';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){return safeRoute(request,async()=>{const input=z.object({provider:z.enum(['drive','gmail']),selectedIds:z.array(z.string()).min(1).max(40),baseVersion:z.number().int()}).parse(await request.json());return Response.json(await importProviderSources((await params).id,input.provider,input.selectedIds,input.baseVersion));});}

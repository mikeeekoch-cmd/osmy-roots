import { z } from 'zod';
import { addContribution } from '../../../../../../server/agent/service';
import { multipart, safeRoute } from '../../../../../../server/agent/http';
const Input=z.object({text:z.string().max(100000).optional(),targetPersonId:z.string().optional(),requestId:z.string().optional(),publicRecordUrl:z.string().url().optional()});
export const runtime='nodejs';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){return safeRoute(request,async()=>{const {input,files}=await multipart(request);return Response.json(await addContribution((await params).id,{...Input.parse(input),files}))})}

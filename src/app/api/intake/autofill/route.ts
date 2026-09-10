import {safeRoute,multipart} from '../../../../../server/agent/http';
import {draftAutofill} from '../../../../../server/agent/autofill';
export const runtime='nodejs';
export async function POST(request:Request){return safeRoute(request,async()=>{const {input,files}=await multipart(request);return Response.json(await draftAutofill(input,files));});}

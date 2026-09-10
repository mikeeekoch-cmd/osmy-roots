import { loadProject, readAsset } from '../../../../../../../server/state/store';
import { safeRoute } from '../../../../../../../server/agent/http';
import { AppError } from '../../../../../../../server/state/validation';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{id:string;assetId:string}>}){return safeRoute(request,async()=>{const {id,assetId}=await params;const s=await loadProject(id);const asset=s.assets.find(a=>a.id===assetId);if(!asset)throw new AppError('Asset not found.',404);const type=['image/png','image/jpeg','image/webp','image/gif'].includes(asset.mediaType)?asset.mediaType:'application/octet-stream';return new Response(new Uint8Array(await readAsset(id,assetId)),{headers:{'Content-Type':type,'Content-Disposition':`${type==='application/octet-stream'?'attachment':'inline'}; filename="asset"`,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; sandbox"}})})}

import { createProject } from "../../../../server/agent/service";
import { multipart, safeRoute } from "../../../../server/agent/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return safeRoute(request, async () => {
    const { input, files } = await multipart(request);
    return Response.json(await createProject(input, files));
  });
}

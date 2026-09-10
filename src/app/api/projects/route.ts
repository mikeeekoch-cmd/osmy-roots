import {kickResearch} from "../../../../server/agent/research";
import { createProject } from "../../../../server/agent/service";
import { multipart, safeRoute } from "../../../../server/agent/http";
import { isRound2Input, startRound2 } from "../../../../server/agent/round2";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return safeRoute(request, async () => {
    const { input, files } = await multipart(request);
    const snapshot=await (isRound2Input(files) ? startRound2(input, files) : createProject(input, files));
    if(snapshot.research)kickResearch(snapshot.projectId);
    return Response.json(snapshot);
  });
}

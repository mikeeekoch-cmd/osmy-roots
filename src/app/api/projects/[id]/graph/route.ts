import { mutateGraph } from "../../../../../../server/state/decisions";
import { safeRoute } from "../../../../../../server/agent/http";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeRoute(request, async () =>
    Response.json(await mutateGraph((await params).id, await request.json())),
  );
}

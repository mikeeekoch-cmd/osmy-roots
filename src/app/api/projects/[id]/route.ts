import { loadProject } from "../../../../../server/state/store";
import { safeRoute } from "../../../../../server/agent/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeRoute(request, async () =>
    Response.json(await loadProject((await params).id), {
      headers: { "Cache-Control": "no-store" },
    }),
  );
}

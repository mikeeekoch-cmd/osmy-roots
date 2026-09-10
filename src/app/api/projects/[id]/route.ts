import {pumpResearch} from "../../../../../server/agent/research";
import {loadProject} from "../../../../../server/state/store";
import { pumpRound2 } from "../../../../../server/agent/round2";
import { safeRoute } from "../../../../../server/agent/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeRoute(request, async () =>
    Response.json(await ((await loadProject((await params).id)).research ? pumpResearch((await params).id) : pumpRound2((await params).id)), {
      headers: { "Cache-Control": "no-store" },
    }),
  );
}

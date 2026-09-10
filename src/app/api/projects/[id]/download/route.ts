import { downloadFamilyBook } from "../../../../../../server/agent/service";
import { safeRoute } from "../../../../../../server/agent/http";
import { loadProject } from "../../../../../../server/state/store";
import { downloadRound2 } from "../../../../../../server/agent/round2";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeRoute(request, async () => {
    const id = (await params).id;
    const current = await loadProject(id);
    const bundle = await (current.run ? downloadRound2(id) : downloadFamilyBook(id));
    return new Response(new Uint8Array(bundle.bytes), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${bundle.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
        "Cache-Control": "no-store",
      },
    });
  });
}

import { downloadFamilyBook } from "../../../../../../server/agent/service";
import { safeRoute } from "../../../../../../server/agent/http";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeRoute(request, async () => {
    const bundle = await downloadFamilyBook((await params).id);
    return new Response(new Uint8Array(bundle.bytes), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${bundle.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
        "Cache-Control": "no-store",
      },
    });
  });
}

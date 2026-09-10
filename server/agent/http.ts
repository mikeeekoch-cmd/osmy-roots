import { ZodError } from "zod";
import { randomUUID, createHash } from "node:crypto";
import type { InputFile } from "../../packages/contracts";
import { AppError, validateSnapshot } from "../state/validation";
import { PORTABLE_RESTORE_MAX_PARTS } from "../../packages/contracts/round3";
import { UPLOAD_LIMITS } from "../../packages/contracts/round2";
export function localRequest(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("host") || url.host;
  if (
    !["127.0.0.1", "localhost", "[::1]"].some(
      (h) => host === h || host.startsWith(`${h}:`),
    )
  )
    throw new AppError(
      "This prototype is available on localhost only.",
      403,
      "LOCAL_ONLY",
    );
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== host)
    throw new AppError(
      "Cross-origin requests are not permitted.",
      403,
      "ORIGIN_REJECTED",
    );
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site")
    throw new AppError(
      "Cross-site requests are not permitted.",
      403,
      "ORIGIN_REJECTED",
    );
}
export async function multipart(request: Request) {
  const cap =
    UPLOAD_LIMITS.maxTotalBytes + UPLOAD_LIMITS.multipartOverheadBytes;
  const advertised = request.headers.get("content-length");
  if (advertised && (!/^\d+$/.test(advertised) || Number(advertised) > cap))
    throw new AppError("Upload exceeds the 100 MB total limit.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("Choose files before starting.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > cap) {
        await reader.cancel();
        throw new AppError("Upload exceeds the 100 MB total limit.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bounded = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bounded.set(chunk, offset);
    offset += chunk.length;
  }
  const form = await new Response(bounded, {
    headers: { "content-type": request.headers.get("content-type") || "" },
  }).formData();
  let input: unknown;
  try {
    input = JSON.parse(String(form.get("input") || "{}"));
  } catch {
    throw new AppError("Input must be valid JSON.");
  }
  const picked = form
    .getAll("files")
    .filter((f): f is File => f instanceof File);
  if (
    picked.length > PORTABLE_RESTORE_MAX_PARTS ||
    picked.reduce((n, f) => n + f.size, 0) > UPLOAD_LIMITS.maxTotalBytes
  )
    throw new AppError("Choose at most 40 files totaling 100 MB.", 413);
  const tooLarge = picked.find((f) => f.size > UPLOAD_LIMITS.maxFileBytes);
  if (tooLarge)
    throw new AppError(
      `${tooLarge.name} exceeds the 25 MB per-file limit.`,
      413,
    );
  const files: InputFile[] = await Promise.all(
    picked.map(async (f) => ({
      uploadId: randomUUID(),
      originalName: f.name,
      mediaType: f.type || "application/octet-stream",
      bytes: new Uint8Array(await f.arrayBuffer()),
    })),
  );
  if (files.length > UPLOAD_LIMITS.maxFiles) {
    let validRestore = false;
    const portable = files.find((file) => file.originalName === "project.json");
    if (portable && new URL(request.url).pathname === "/api/projects")
      try {
        const saved = validateSnapshot(
          JSON.parse(new TextDecoder().decode(portable.bytes)),
        );
        const hashes = new Set(saved.assets.map((asset) => asset.contentHash));
        validRestore =
          !!saved.research &&
          saved.files.length <= UPLOAD_LIMITS.maxFiles &&
          saved.assets.filter(
            (asset) => !asset.role || asset.role === "original",
          ).length <= UPLOAD_LIMITS.maxFiles &&
          files.every(
            (file) =>
              ["project.json", "research-stage.json"].includes(
                file.originalName,
              ) ||
              hashes.has(createHash("sha256").update(file.bytes).digest("hex")),
          );
      } catch {
        /* Untrusted JSON cannot increase the ordinary intake limit. */
      }
    if (!validRestore)
      throw new AppError(
        "Choose at most 40 new source files. A larger saved restore must contain only the project's matching original and derived assets.",
        413,
      );
  }
  return { input, files };
}
export async function safeRoute(request: Request, fn: () => Promise<Response>) {
  try {
    localRequest(request);
    return await fn();
  } catch (e) {
    if (e instanceof ZodError)
      return Response.json(
        {
          error: e.issues.map((i) => i.message).join(" "),
          code: "INVALID_INPUT",
        },
        { status: 400 },
      );
    if (e instanceof AppError)
      return Response.json(
        { error: e.message, code: e.code },
        { status: e.status },
      );
    return Response.json(
      {
        error:
          "This operation failed. Saved family data is unchanged. See the server diagnostics.",
        code: "INTERNAL_ERROR",
      },
      { status: 500 },
    );
  }
}

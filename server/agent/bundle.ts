import { inflateRawSync } from "node:zlib";
import { createHash } from "node:crypto";
import {
  buildFamilyBundle as buildRaw,
  deepestLineFocus,
} from "../export/index.mjs";
import { createZip, crc32 } from "../export/zip.mjs";
import type { BundleInput, ProjectSnapshot } from "../../packages/contracts";
import { AppError, validateSnapshot } from "../state/validation";

// Read only ZIPs produced in this process by Claude's writer, never uploaded ZIPs.
// Repackage the presentation output with the authoritative portable runtime state.
export function readGeneratedZip(input: Uint8Array) {
  const buf = Buffer.from(input);
  const entries = new Map<string, Buffer>();
  let offset = 0;
  while (offset + 30 <= buf.length && buf.readUInt32LE(offset) === 0x04034b50) {
    const flags = buf.readUInt16LE(offset + 6);
    const method = buf.readUInt16LE(offset + 8);
    const crc = buf.readUInt32LE(offset + 14);
    const size = buf.readUInt32LE(offset + 18);
    const rawSize = buf.readUInt32LE(offset + 22);
    const nameLength = buf.readUInt16LE(offset + 26);
    const extraLength = buf.readUInt16LE(offset + 28);
    const start = offset + 30 + nameLength + extraLength;
    const name = buf.toString("utf8", offset + 30, offset + 30 + nameLength);
    if (
      flags !== 0x0800 ||
      ![0, 8].includes(method) ||
      start + size > buf.length ||
      rawSize > 100_000_000 ||
      !name ||
      name.startsWith("/") ||
      name.split("/").includes("..") ||
      entries.has(name)
    )
      throw new AppError(
        "Export writer returned an invalid archive.",
        500,
        "INVALID_EXPORT",
      );
    const body = buf.subarray(start, start + size);
    const bytes =
      method === 0
        ? body
        : inflateRawSync(body, { maxOutputLength: 100_000_000 });
    if (bytes.length !== rawSize || crc32(bytes) !== crc)
      throw new AppError(
        "Export archive failed integrity validation.",
        500,
        "INVALID_EXPORT",
      );
    entries.set(name, bytes);
    offset = start + size;
  }
  if (!entries.has("book.pdf") || !entries.has("project.json"))
    throw new AppError("Export archive is incomplete.", 500, "INVALID_EXPORT");
  return entries;
}

export function bookDateLabel(
  date: ProjectSnapshot["people"][number]["lifeYears"]["birth"],
) {
  if (!date.value) return "Unknown";
  if (date.precision === "approximate") return `c. ${date.value}`;
  return date.value;
}

export function printLocators(
  passages: BundleInput["passages"],
  sources: ProjectSnapshot["sources"],
) {
  const numbers = new Map(
    sources.map((source, index) => [source.id, index + 1]),
  );
  return passages.map((passage) => ({
    ...passage,
    sourceLocators: [
      ...new Set(
        passage.sourceLocators.map((span) => {
          const locator =
            span.locator.length > 160
              ? `${span.locator.slice(0, 157)}...`
              : span.locator;
          return `[${numbers.get(span.sourceId)}] ${locator}`;
        }),
      ),
    ],
  }));
}

function presentation(snapshot: ProjectSnapshot) {
  return {
    ...snapshot,
    people: snapshot.people.map((p) => ({
      ...p,
      lifeYears: {
        ...p.lifeYears,
        label: `${bookDateLabel(p.lifeYears.birth)} - ${bookDateLabel(p.lifeYears.death)}`,
      },
    })),
    // Unresolved edges remain in portable JSON and open questions, not the printed ancestry.
    relationships: snapshot.relationships
      .filter((r) => r.status === "accepted")
      .map((r) => ({
        ...r,
        type:
          r.type === "parent"
            ? "parent_child"
            : r.type === "partner"
              ? "spouse"
              : r.type,
      })),
    stories: snapshot.stories.map((s) => ({
      ...s,
      subjectId: s.personId,
      attributedTo: s.attribution,
    })),
    claims: snapshot.claims.map((claim) => {
      if (!claim.predicate.startsWith("relationship_")) return claim;
      try {
        const value = JSON.parse(claim.value);
        return value &&
          typeof value === "object" &&
          typeof value.from === "string" &&
          typeof value.to === "string"
          ? { ...claim, value }
          : claim;
      } catch {
        return claim;
      }
    }),
    layout: { positions: snapshot.layout },
  };
}

export async function buildRuntimeBundle({
  snapshot,
  passages,
  resolveAsset,
}: BundleInput) {
  validateSnapshot(snapshot);
  if (
    snapshot.bookStatus !== "current" ||
    passages.some((p) => p.acceptedStateVersion !== snapshot.version)
  )
    throw new AppError(
      "Regenerate the book from current accepted state before export.",
      409,
      "STALE_EXPORT",
    );
  const resolved = new Map<
    string,
    { bytes: Buffer; mediaType: string; originalName: string }
  >();
  for (const asset of snapshot.assets) {
    const bytes = Buffer.from(await resolveAsset(asset.id));
    if (
      bytes.length !== asset.byteLength ||
      (asset.contentHash &&
        createHash("sha256").update(bytes).digest("hex") !== asset.contentHash)
    )
      throw new AppError(
        "An original asset does not match its saved metadata.",
        409,
        "ASSET_HASH_MISMATCH",
      );
    resolved.set(asset.id, {
      bytes,
      mediaType: asset.mediaType,
      originalName: asset.originalName,
    });
  }
  const chapterPersonId = snapshot.stories
    .filter(
      (s) =>
        s.status === "accepted" &&
        s.claimIds.some((id) => passages.some((p) => p.claimIds.includes(id))),
    )
    .at(-1)?.personId;
  const raw = await buildRaw({
    snapshot: presentation(snapshot),
    passages: printLocators(passages, snapshot.sources),
    resolveAsset: (id: string) => resolved.get(id),
    options: {
      includeAssets: "all",
      compactChapter: true,
      focusPersonId: chapterPersonId,
      branchRootId: deepestLineFocus(presentation(snapshot)),
      dedication: "For the family.",
      title: snapshot.sources.some((s) => s.kind === "synthetic_fixture")
        ? "Roots: A fictional family example"
        : "Roots: The Family Book",
    },
  });
  const entries = readGeneratedZip(raw.bytes);
  const paths = new Map<string, string>(
    (
      (raw.manifest as { assets?: { assetId: string; path: string }[] })
        .assets || []
    ).map((a: { assetId: string; path: string }) => [a.assetId, a.path]),
  );
  const portable = validateSnapshot({
    ...snapshot,
    bookPassages: passages,
    assets: snapshot.assets.map((a) => ({
      ...a,
      storageKey: paths.get(a.id) || `assets/${a.id}`,
    })),
  });
  entries.set("project.json", Buffer.from(JSON.stringify(portable, null, 2)));
  entries.set(
    "sources.json",
    Buffer.from(
      JSON.stringify(
        { schemaVersion: portable.schemaVersion, sources: portable.sources },
        null,
        2,
      ),
    ),
  );
  // P1 standalone map is outside the validated P0 path. The complete map is editable
  // in project.json and rendered safely by the app after reimport.
  entries.delete("editable-family-map.html");
  entries.set(
    "README.md",
    Buffer.from(
      `# Roots family project\n\nCurrent project version ${snapshot.version}.\n\nOpen book.pdf or book.html to read the illustrated English book. project.json retains every person, relationship, source, claim, story, decision and history event. sources.json preserves exact evidence text. research-notes.json retains warnings and unresolved questions. photos/ and uploads/ contain every saved original, unchanged.\n\nTo reopen on another machine, select project.json together with all files from photos/ and uploads/ in the Roots input form. ZIP upload is not supported. On the original machine, saved originals can also be recovered by the old project and asset IDs. Missing files are reported explicitly.\n\nAccepted recollections remain family memories. Prepared or synthetic inputs are labeled in their source records; no new archive discovery is implied. The PDF uses a compact four-page layout; the HTML and editable JSON retain material omitted from those pages. The standalone editable HTML map is deferred.\n`,
    ),
  );
  const notes = JSON.parse(entries.get("research-notes.json")!.toString());
  notes.cuts = [
    ...new Set([
      ...(notes.cuts || []),
      "standalone_editable_html_map_deferred",
    ]),
  ];
  entries.set(
    "research-notes.json",
    Buffer.from(JSON.stringify(notes, null, 2)),
  );
  const bytes = createZip(
    [...entries].map(([path, content]) => ({
      path,
      bytes: content,
      store: path.endsWith(".pdf"),
    })),
  );
  return {
    bytes,
    filename: raw.filename,
    mimeType: "application/zip" as const,
    manifest: {
      ...raw.manifest,
      schemaVersion: portable.schemaVersion,
      byteLength: bytes.length,
      files: [...entries].map(([path, content]) => ({
        path,
        byteLength: content.length,
      })),
      cuts: notes.cuts,
    },
  };
}

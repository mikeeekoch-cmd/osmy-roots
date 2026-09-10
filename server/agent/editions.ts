import { randomUUID, createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import {
  type ProjectSnapshot,
  type BookEdition,
} from "../../packages/contracts";
import {
  dataRoot,
  loadProject,
  updateProject,
  readAsset,
} from "../state/store";
import { researchFingerprint, digest } from "../state/research";
import { AppError } from "../state/validation";
import { generatePassage, selectBookClaims } from "./astra";
import { dataModules } from "./data-modules";
import { readGeneratedZip } from "./bundle";
import { createZip } from "../export/zip.mjs";
const tasks = new Map<string, Promise<ProjectSnapshot>>();
function packageSnapshot(entries: Map<string, Buffer>, s: ProjectSnapshot) {
  const portable = JSON.parse(entries.get("project.json")!.toString());
  entries.set(
    "project.json",
    Buffer.from(JSON.stringify({ ...s, assets: portable.assets }, null, 2)),
  );
  return createZip(
    [...entries].map(([path, bytes]) => ({
      path,
      bytes,
      store: path.endsWith(".pdf"),
    })),
  );
}
const bytesHash = (b: Uint8Array) =>
  createHash("sha256").update(b).digest("hex");
const path = (id: string, key: string, kind: string) =>
  join(dataRoot(), id, "editions", `${key}.${kind}`);
const editionKey = (edition: BookEdition) =>
  `${edition.fingerprint}-${edition.id}`;
const now = () => new Date().toISOString();
export function passageFingerprint(s: ProjectSnapshot) {
  const claims = selectBookClaims(s);
  return digest({
    claims,
    people: s.people
      .filter((p) => claims.some((c) => c.subjectId === p.id))
      .map((p) => ({ id: p.id, name: p.displayNameEn })),
    stories: s.stories.filter(
      (st) =>
        st.status === "accepted" &&
        st.claimIds.some((id) => claims.some((c) => c.id === id)),
    ),
  });
}
export async function prepareEdition(id: string) {
  if (tasks.has(id)) return tasks.get(id)!;
  const task = buildEdition(id).finally(() => tasks.delete(id));
  tasks.set(id, task);
  return task;
}
async function buildEdition(id: string) {
  let s = await loadProject(id);
  if (!s.research?.bookPlan)
    throw new AppError(
      "The source-backed English book plan is not prepared.",
      409,
      "BOOK_PLAN_REQUIRED",
    );
  if (!s.people.length)
    throw new AppError("Start research before preparing the book.", 409);
  const remainingPeople = s.research.bookPlan.selectedPersonIds.filter(
    (id) => !s.people.some((person) => person.id === id),
  );
  if (remainingPeople.length)
    throw new AppError(
      `${remainingPeople.length} selected family records are still awaiting research. Complete the remaining rounds before preparing the full edition.`,
      409,
      "BOOK_COVERAGE_INCOMPLETE",
    );
  const key = researchFingerprint(s);
  if (
    s.research.bookEdition?.fingerprint === key &&
    ["current", "sealed"].includes(s.research.bookEdition.status)
  )
    return s;
  const missing = s.research.oldPhotoAssetIds.filter(
    (id) =>
      !s.research!.photoPairQA.some(
        (p) =>
          p.originalAssetId === id &&
          p.qa.status === "passed" &&
          p.alignment.mode === "aligned",
      ),
  );
  if (missing.length)
    throw new AppError(
      `${missing.length} selected old photographs still need a validated comparison.`,
      409,
      "PHOTO_PAIRS_INCOMPLETE",
    );
  const edition: BookEdition = {
    id: `edition-${randomUUID()}`,
    fingerprint: key,
    status: "preparing",
    stateVersion: s.version,
    pageCount: 0,
    createdAt: now(),
    previousEditionId: s.research.bookEdition?.id,
    passageFingerprint: passageFingerprint(s),
    chapterFingerprints: Object.fromEntries(
      s.research.bookPlan.chapters.map((ch) => [
        ch.id,
        digest([
          ch.fingerprint,
          ch.claimIds.map((id) => s.claims.find((c) => c.id === id)),
          s.people.filter((p) => ch.personIds.includes(p.id)),
          s.run?.answers.filter((a) =>
            s
              .run!.questions.find((q) => q.id === a.questionId)
              ?.personIds.some((id) => ch.personIds.includes(id)),
          ),
          s.research?.questionBank.filter(
            (q) =>
              q.personIds.some((id) => ch.personIds.includes(id)) ||
              q.support.some((span) =>
                ch.support.some((s) => s.sourceId === span.sourceId),
              ),
          ),
        ]),
      ]),
    ),
  };
  await updateProject(id, (p) => {
    if (p.research!.bookEdition?.status === "sealed")
      p.research!.previousEditions.push(p.research!.bookEdition);
    p.research!.bookEdition = edition;
    p.run!.book = { status: "preparing", key };
    p.bookStatus = "generating";
  });
  try {
    let passages = s.bookPassages;
    if (selectBookClaims(s).length) {
      const unchanged =
        s.research.bookEdition?.passageFingerprint ===
          edition.passageFingerprint && passages.length > 0;
      if (!unchanged) passages = [await generatePassage(s)];
    } else {
      const claim = s.claims.find((c) => c.status === "accepted");
      if (!claim)
        throw new AppError("Review a documented family record first.", 409);
      passages = [
        {
          id: `passage-${randomUUID()}`,
          text: `Supplied family record: ${claim.value}`,
          claimIds: [claim.id],
          sourceIds: claim.sourceIds,
          sourceLocators: claim.spans,
          acceptedStateVersion: s.version,
          origin: "prepared",
        },
      ];
    }
    s = await updateProject(id, (p) => {
      if (researchFingerprint(p) !== key)
        throw new AppError(
          "The family changed while preparing this edition.",
          409,
          "STALE_EDITION",
        );
      p.bookPassages = passages.map((x) => ({
        ...x,
        acceptedStateVersion: p.version + 1,
      }));
      p.bookStatus = "current";
    });
    const bundle = await dataModules.buildFamilyBundle({
      snapshot: s,
      passages: s.bookPassages,
      resolveAsset: (assetId) => readAsset(id, assetId),
    });
    const entries = readGeneratedZip(bundle.bytes),
      pdf = entries.get("book.pdf")!,
      html = entries.get("book.html")!;
    const pageCount = (pdf.toString("latin1").match(/\/Type\s*\/Page\b/g) || [])
      .length;
    if (pageCount < 35 || pageCount > 40)
      throw new AppError(
        `The prepared book has ${pageCount} pages; this edition requires 35-40.`,
        409,
        "BOOK_PAGE_RANGE",
      );
    const ready = {
      ...edition,
      status: "current" as const,
      pageCount,
      preparedAt: now(),
      stateVersion: s.version + 1,
      pdfHash: bytesHash(pdf),
    };
    const portable = structuredClone(s);
    portable.version++;
    portable.bookPassages.forEach(
      (p) => (p.acceptedStateVersion = portable.version),
    );
    portable.research!.bookEdition = ready;
    portable.run!.book = {
      status: "ready",
      key,
      preparedAt: ready.preparedAt,
      stateVersion: portable.version,
    };
    portable.run!.phase = "ready";
    const currentBytes = packageSnapshot(entries, portable);
    await mkdir(join(dataRoot(), id, "editions"), {
      recursive: true,
      mode: 0o700,
    });
    for (const [kind, bytes] of [
      ["pdf", pdf],
      ["html", html],
      ["zip", currentBytes],
    ] as const) {
      const dest = path(id, editionKey(edition), kind),
        tmp = `${dest}.${randomUUID()}.tmp`;
      await writeFile(tmp, bytes, { mode: 0o600 });
      await rename(tmp, dest);
    }
    return updateProject(id, (p) => {
      if (researchFingerprint(p) !== key)
        throw new AppError(
          "The family changed before this edition was ready.",
          409,
          "STALE_EDITION",
        );
      p.research!.bookEdition = {
        ...ready,
        stateVersion: p.version + 1,
        zipHash: bytesHash(currentBytes),
      };
      p.run!.book = {
        status: "ready",
        key,
        preparedAt: now(),
        stateVersion: p.version + 1,
      };
      p.run!.phase = "ready";
    });
  } catch (error) {
    await updateProject(id, (p) => {
      if (p.research!.bookEdition?.fingerprint !== key) return false;
      p.research!.bookEdition.status = "error";
      p.research!.bookEdition.error =
        error instanceof AppError
          ? error.message
          : "Book preparation failed. Retry is available.";
      p.bookStatus = "failed";
      p.run!.book = { status: "failed", error: p.research!.bookEdition.error };
    });
    throw error;
  }
}
export async function previewEdition(id: string) {
  const s = await loadProject(id),
    e = s.research?.bookEdition;
  if (
    !e ||
    !["current", "sealed"].includes(e.status) ||
    e.fingerprint !== researchFingerprint(s)
  )
    throw new AppError(
      "Prepare the current full book before previewing.",
      409,
      "STALE_EDITION",
    );
  const bytes = await readFile(path(id, editionKey(e), "pdf"));
  if (bytesHash(bytes) !== e.pdfHash)
    throw new AppError("Book integrity check failed.", 409);
  return bytes;
}
const downloads = new Map<
  string,
  Promise<{ bytes: Uint8Array; filename: string }>
>();
export async function downloadEdition(id: string) {
  if (downloads.has(id)) return downloads.get(id)!;
  const task = sealEdition(id).finally(() => downloads.delete(id));
  downloads.set(id, task);
  return task;
}
async function sealEdition(id: string) {
  let s = await loadProject(id);
  if (
    !s.research?.bookEdition ||
    s.research.bookEdition.fingerprint !== researchFingerprint(s) ||
    !["current", "sealed"].includes(s.research.bookEdition.status)
  )
    s = await prepareEdition(id);
  let e = s.research!.bookEdition!;
  if (e.status === "sealed") {
    try {
      const bytes = await readFile(path(id, editionKey(e), "sealed.zip"));
      if (e.zipHash && bytesHash(bytes) !== e.zipHash)
        throw new AppError("Sealed download integrity check failed.", 409);
      if (!e.zipHash) {
        const entries = readGeneratedZip(bytes),
          portable = JSON.parse(entries.get("project.json")!.toString());
        if (
          bytesHash(entries.get("book.pdf")!) !== e.pdfHash ||
          portable.research?.bookEdition?.id !== e.id ||
          portable.research.bookEdition.fingerprint !== e.fingerprint ||
          portable.research.bookEdition.status !== "sealed"
        )
          throw new AppError(
            "Interrupted download integrity check failed.",
            409,
          );
        await updateProject(id, (p) => {
          if (p.research?.bookEdition?.id !== e.id) return false;
          p.research.bookEdition.zipHash = bytesHash(bytes);
        });
      }
      return { bytes, filename: `Osmy-Roots-${e.id}.zip` };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  const bytes = await readFile(path(id, editionKey(e), "zip"));
  if (e.status !== "sealed" && bytesHash(bytes) !== e.zipHash)
    throw new AppError("Download integrity check failed.", 409);
  s = await updateProject(
    id,
    (p) => {
      if (researchFingerprint(p) !== e.fingerprint)
        throw new AppError(
          "The book changed. Download the current edition.",
          409,
        );
      p.research!.bookEdition!.status = "sealed";
      p.research!.bookEdition!.sealedAt ||= now();
      delete p.research!.bookEdition!.zipHash;
      for (const cycle of p.research!.cycles)
        if (["queued", "running", "paused"].includes(cycle.status)) {
          cycle.status = "cancelled";
          cycle.completedAt = now();
          for (const job of p.research!.jobs.filter(
            (j) =>
              j.cycleId === cycle.id &&
              ["queued", "running", "paused"].includes(j.status),
          )) {
            job.status = "cancelled";
            delete job.leaseToken;
            delete job.leaseUntil;
          }
        }
    },
    {
      isReplay: (p) =>
        p.research?.bookEdition?.id === e.id &&
        p.research.bookEdition.status === "sealed",
    },
  );
  e = s.research!.bookEdition!;
  const entries = readGeneratedZip(bytes);
  const portable = structuredClone(s);
  delete portable.research!.bookEdition!.zipHash;
  const delivered = packageSnapshot(entries, portable);
  const dest = path(id, editionKey(e), "sealed.zip"),
    temp = `${dest}.${randomUUID()}.tmp`;
  await writeFile(temp, delivered, { mode: 0o600 });
  await rename(temp, dest);
  await updateProject(id, (p) => {
    if (p.research?.bookEdition?.id !== e.id) return false;
    p.research.bookEdition.zipHash = bytesHash(delivered);
  });
  return { bytes: delivered, filename: `Osmy-Roots-${e.id}.zip` };
}

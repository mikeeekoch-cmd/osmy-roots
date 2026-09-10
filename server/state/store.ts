import { mkdir, readFile, writeFile, rename, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import type { ProjectSnapshot } from "../../packages/contracts";
import { AppError, validateSnapshot } from "./validation";
const safeId = (id: string) => {
  if (!/^[a-zA-Z0-9_-]{1,160}$/.test(id))
    throw new AppError("Invalid record ID.");
  return id;
};
export function dataRoot() {
  return resolve(process.env.ROOTS_DATA_DIR || ".roots-data");
}
function projectDir(id: string) {
  return join(dataRoot(), safeId(id));
}
export async function loadProject(id: string) {
  try {
    return validateSnapshot(
      JSON.parse(await readFile(join(projectDir(id), "project.json"), "utf8")),
    );
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT")
      throw new AppError("Project not found.", 404, "NOT_FOUND");
    throw e;
  }
}
async function atomicSave(s: ProjectSnapshot) {
  validateSnapshot(s);
  const dir = projectDir(s.projectId);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const tmp = join(dir, `${randomUUID()}.tmp`);
  await writeFile(tmp, JSON.stringify(s, null, 2), { mode: 0o600 });
  await rename(tmp, join(dir, "project.json"));
}
async function withLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
  await mkdir(projectDir(id), { recursive: true, mode: 0o700 });
  const lock = join(projectDir(id), ".write-lock");
  const until = Date.now() + 5000;
  while (true) {
    try {
      await mkdir(lock);
      break;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      if (Date.now() > until)
        throw new AppError("Project is busy. Retry the action.", 409, "BUSY");
      await new Promise((r) => setTimeout(r, 30));
    }
  }
  try {
    return await fn();
  } finally {
    await rm(lock, { recursive: true, force: true });
  }
}
export async function createSavedProject(s: ProjectSnapshot) {
  return withLock(s.projectId, async () => {
    try {
      await readFile(join(projectDir(s.projectId), "project.json"));
      throw new AppError("Project already exists.", 409);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    await atomicSave(s);
    return s;
  });
}
export async function updateProject(
  id: string,
  fn: (s: ProjectSnapshot) => void | boolean,
  options: {
    baseVersion?: number;
    invalidateBook?: boolean;
    isReplay?: (s: ProjectSnapshot) => boolean;
  } = {},
) {
  return withLock(id, async () => {
    const s = await loadProject(id);
    if (options.isReplay?.(s)) return s;
    if (options.baseVersion !== undefined && s.version !== options.baseVersion)
      throw new AppError(
        "This project changed. Refresh and review the latest version.",
        409,
        "STALE_VERSION",
      );
    const changed = fn(s);
    if (changed === false) return s;
    s.version++;
    if (options.invalidateBook) {
      s.bookStatus = s.bookPassages.length ? "stale" : "empty";
    } else if (s.bookStatus === "current") {
      s.bookPassages.forEach((p) => (p.acceptedStateVersion = s.version));
    }
    await atomicSave(s);
    return s;
  });
}
export async function saveAsset(
  projectId: string,
  assetId: string,
  bytes: Uint8Array,
) {
  const dir = join(projectDir(projectId), "assets");
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await writeFile(join(dir, safeId(assetId)), bytes, { mode: 0o600 });
}
export async function readAsset(projectId: string, assetId: string) {
  const s = await loadProject(projectId);
  if (!s.assets.some((x) => x.id === assetId))
    throw new AppError("Asset not found.", 404);
  return new Uint8Array(
    await readFile(join(projectDir(projectId), "assets", safeId(assetId))),
  );
}
export async function writePrivateDiagnostic(value: Record<string, unknown>) {
  const dir = join(dataRoot(), "diagnostics");
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await writeFile(
    join(dir, `${Date.now()}-${randomUUID()}.json`),
    JSON.stringify(value),
    { mode: 0o600 },
  );
}

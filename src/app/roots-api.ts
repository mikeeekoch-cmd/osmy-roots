"use client";
import {
  ProjectSnapshotSchema,
  type RootsApi,
  type ProjectSnapshot,
} from "../../packages/contracts";
async function result(response: Response): Promise<ProjectSnapshot> {
  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => ({ error: "Request failed." }));
    throw new Error(body.error || `Request failed (${response.status}).`);
  }
  return ProjectSnapshotSchema.parse(await response.json());
}
const path = (id: string) => `/api/projects/${encodeURIComponent(id)}`;
function upload(input: unknown, files: File[] = []) {
  const form = new FormData();
  form.set("input", JSON.stringify(input));
  for (const file of files) form.append("files", file);
  return form;
}
function json(input: unknown) {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  };
}
export const rootsApi: RootsApi = {
  answerSetupQuestion: async (id, input) => result(await fetch(`${path(id)}/answers`, json(input))),
  prepareFamilyBook: async (id) => result(await fetch(`${path(id)}/book`, {method: "POST"})),
  cancelRun: async (id) => result(await fetch(`${path(id)}/cancel`, {method: "POST"})),
  bookPreviewUrl: (id) => `${path(id)}/book/preview`,
  retryAnalysis: async (id) => result(await fetch(`${path(id)}/retry`, {method: "POST"})),
  createProject: async (input, files = []) =>
    result(
      await fetch("/api/projects", {
        method: "POST",
        body: upload(input, files),
      }),
    ),
  getSnapshot: async (id) =>
    result(await fetch(path(id), { cache: "no-store" })),
  addContribution: async (id, { files, ...input }) =>
    result(
      await fetch(`${path(id)}/contributions`, {
        method: "POST",
        body: upload(
          { ...input, requestId: input.requestId || crypto.randomUUID() },
          files,
        ),
      }),
    ),
  reviewProposal: async (id, input) =>
    result(
      await fetch(
        `${path(id)}/review`,
        json({ ...input, requestId: input.requestId || crypto.randomUUID() }),
      ),
    ),
  mutateGraph: async (id, input) =>
    result(
      await fetch(
        `${path(id)}/graph`,
        json({ ...input, requestId: input.requestId || crypto.randomUUID() }),
      ),
    ),
  downloadFamilyBook: async (id) => {
    const response = await fetch(`${path(id)}/download`, { method: "POST" });
    if (!response.ok) {
      const body = await response.json();
      throw new Error(body.error || "Download failed.");
    }
    return response.blob();
  },
  assetUrl: (id, assetId) =>
    `${path(id)}/assets/${encodeURIComponent(assetId)}`,
};

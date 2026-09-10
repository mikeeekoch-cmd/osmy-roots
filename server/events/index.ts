import { randomUUID } from "node:crypto";
import type { ProjectSnapshot, ResearchEvent } from "../../packages/contracts";
export function event(
  s: ProjectSnapshot,
  e: Omit<ResearchEvent, "eventId" | "sequence" | "at"> & { eventId?: string },
) {
  const eventId = e.eventId || randomUUID();
  if (s.researchEvents.some((x) => x.eventId === eventId)) return;
  s.researchEvents.push({
    ...e,
    eventId,
    sequence: (s.researchEvents.at(-1)?.sequence || 0) + 1,
    at: new Date().toISOString(),
  });
  if (s.run) s.run.nextSequence = (s.researchEvents.at(-1)?.sequence || 0) + 1;
}
export function counters(s: ProjectSnapshot) {
  const completed = s.researchEvents.filter((e) => e.state === "completed");
  return {
    peopleInMap: s.people.length,
    filesProcessed: new Set(
      completed
        .filter((e) => e.operation === "parse_file" && e.assetId)
        .map(
          (e) =>
            s.assets.find((a) => a.id === e.assetId)?.contentHash || e.assetId,
        ),
    ).size,
    recordsAnalyzed: new Set(
      completed
        .filter((e) => e.operation === "analyze_record" && e.sourceId)
        .map((e) => e.sourceId),
    ).size,
    websitesRead: new Set(
      completed
        .filter(
          (e) =>
            e.operation === "retrieve_website" &&
            e.origin === "live" &&
            e.sourceId,
        )
        .map((e) => {
          try {
            return new URL(
              s.sources.find((x) => x.id === e.sourceId)?.url || "",
            ).hostname
              .toLowerCase()
              .replace(/^www\./, "");
          } catch {
            return undefined;
          }
        })
        .filter(Boolean),
    ).size,
  };
}

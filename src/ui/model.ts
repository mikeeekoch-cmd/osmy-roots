import type {
  Person,
  ProjectSnapshot,
  Relationship,
  ResearchEvent,
} from "./types";
export const label = (value: string) => value.replaceAll("_", " ");
export const dateLabel = (d: Person["lifeYears"]["birth"]) =>
  d.value ? `${d.precision === "approximate" ? "c. " : ""}${d.value}` : "?";
export const years = (p: Person) =>
  `${dateLabel(p.lifeYears.birth)} — ${dateLabel(p.lifeYears.death)}`;
export function uniqueEvents(events: ResearchEvent[]) {
  return [...new Map(events.map((e) => [e.eventId, e])).values()].sort(
    (a, b) => a.sequence - b.sequence,
  );
}
export function progressCounts(snapshot: ProjectSnapshot) {
  const completed = uniqueEvents(snapshot.researchEvents).filter(
    (e) => e.state === "completed",
  );
  const sources = new Map(snapshot.sources.map((s) => [s.id, s]));
  const files = new Set<string>(),
    records = new Set<string>(),
    websites = new Set<string>();
  for (const e of completed) {
    const source = e.sourceId ? sources.get(e.sourceId) : undefined;
    if (e.operation === "parse_file" && source)
      files.add(source.contentHash || source.id);
    if (e.operation === "analyze_record" && source)
      records.add(source.contentHash || source.id);
    if (e.operation === "retrieve_website" && e.origin === "live" && source) {
      try {
        const url = new URL(source.originalLocator);
        if (/^https?:$/.test(url.protocol))
          websites.add(url.hostname.toLowerCase().replace(/^www\./, ""));
      } catch {
        /* Unknown host is not a verified website. */
      }
    }
  }
  return {
    files: files.size,
    records: records.size,
    websites: websites.size,
    people: new Set(snapshot.people.map((p) => p.id)).size,
  };
}
export const isParent = (r: Relationship) =>
  ["parent", "parent_child", "parent_of", "father", "mother"].includes(r.type);
export function familyLayout(people: Person[], relationships: Relationship[]) {
  const generation = new Map(people.map((p) => [p.id, 0]));
  for (let pass = 0; pass < people.length; pass++) {
    let changed = false;
    for (const r of relationships.filter(isParent)) {
      if (!generation.has(r.fromPersonId) || !generation.has(r.toPersonId))
        continue;
      const next = Math.min(
        people.length - 1,
        (generation.get(r.fromPersonId) || 0) + 1,
      );
      if (next > (generation.get(r.toPersonId) || 0)) {
        generation.set(r.toPersonId, next);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const rows = new Map<number, Person[]>();
  people.forEach((p) => {
    const row = generation.get(p.id) || 0;
    rows.set(row, [...(rows.get(row) || []), p]);
  });
  const max = Math.max(1, ...[...rows.values()].map((row) => row.length));
  const positions: Record<string, { x: number; y: number }> = {};
  rows.forEach((row, g) =>
    row.forEach((p, i) => {
      positions[p.id] = {
        x: 40 + (max - row.length) * 112 + i * 224,
        y: 40 + g * 206,
      };
    }),
  );
  return {
    positions,
    width: max * 224 + 60,
    height: Math.max(1, rows.size) * 206 + 80,
  };
}
/** Focus a five-generation ancestry line through the starting person when possible. */
export function branchIds(snapshot: ProjectSnapshot): Set<string> {
  const parents = snapshot.relationships.filter(isParent);
  const layout = familyLayout(snapshot.people, snapshot.relationships);
  const seed = snapshot.people.find(
    (p) =>
      p.displayNameEn.toLowerCase() === snapshot.input.seedName.toLowerCase(),
  );
  const descendants = new Set<string>();
  const visit = (id: string) => {
    if (descendants.has(id)) return;
    descendants.add(id);
    parents
      .filter((r) => r.fromPersonId === id)
      .forEach((r) => visit(r.toPersonId));
  };
  if (seed) visit(seed.id);
  const candidates = seed
    ? snapshot.people.filter((p) => descendants.has(p.id))
    : snapshot.people;
  const end = [...candidates].sort(
    (a, b) =>
      (layout.positions[b.id]?.y || 0) - (layout.positions[a.id]?.y || 0),
  )[0];
  const ids = new Set<string>();
  let cursor: string | undefined = end?.id;
  while (cursor && !ids.has(cursor) && ids.size < 5) {
    ids.add(cursor);
    cursor = parents.find((r) => r.toPersonId === cursor)?.fromPersonId;
  }
  return ids;
}

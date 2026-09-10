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
  `${dateLabel(p.lifeYears.birth)} – ${dateLabel(p.lifeYears.death)}`;
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
  r.status !== "rejected" &&
  ["parent", "parent_child", "parent_of", "father", "mother"].includes(r.type);
export function familyLayout(people: Person[], relationships: Relationship[]) {
  const groups = new Map(people.map((p) => [p.id, p.id]));
  const root = (id: string): string => {
    let current = id;
    const seen = new Set<string>();
    while (
      groups.has(current) &&
      groups.get(current) !== current &&
      !seen.has(current)
    ) {
      seen.add(current);
      current = groups.get(current)!;
    }
    return current;
  };
  for (const r of relationships.filter(
    (r) => r.type === "partner" && r.status !== "rejected",
  )) {
    if (groups.has(r.fromPersonId) && groups.has(r.toPersonId))
      groups.set(root(r.toPersonId), root(r.fromPersonId));
  }
  const depth = new Map([...groups.values()].map((id) => [root(id), 0]));
  for (let pass = 0; pass < people.length; pass++) {
    let changed = false;
    for (const r of relationships.filter(isParent)) {
      if (!groups.has(r.fromPersonId) || !groups.has(r.toPersonId)) continue;
      const from = root(r.fromPersonId),
        to = root(r.toPersonId);
      if (from === to) continue;
      const next = Math.min(people.length - 1, (depth.get(from) || 0) + 1);
      if (next > (depth.get(to) || 0)) {
        depth.set(to, next);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const generation = new Map(
    people.map((p) => [p.id, depth.get(root(p.id)) || 0]),
  );
  const rows = new Map<number, Person[]>();
  people.forEach((p) => {
    const row = generation.get(p.id) || 0;
    rows.set(row, [...(rows.get(row) || []), p]);
  });
  rows.forEach((row, key) => {
    const ordered: Person[] = [];
    const seen = new Set<string>();
    for (const p of row) {
      if (seen.has(p.id)) continue;
      for (const peer of row.filter((other) => root(other.id) === root(p.id))) {
        if (!seen.has(peer.id)) {
          ordered.push(peer);
          seen.add(peer.id);
        }
      }
    }
    rows.set(key, ordered);
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
    height: (Math.max(0, ...rows.keys()) + 1) * 206 + 80,
  };
}
/** Focus a five-generation ancestry line through the starting person when possible. */
export function branchIds(
  snapshot: ProjectSnapshot,
  focusId?: string,
): Set<string> {
  const parents = snapshot.relationships.filter(isParent);
  const layout = familyLayout(snapshot.people, snapshot.relationships);
  const seed =
    snapshot.people.find((p) => p.id === focusId) ||
    snapshot.people.find(
      (p) =>
        p.displayNameEn.toLowerCase() === snapshot.input.seedName.toLowerCase(),
    );
  if (seed) {
    const line = [seed.id];
    while (line.length < 5) {
      const parent = parents.find(
        (r) => r.toPersonId === line[0] && !line.includes(r.fromPersonId),
      );
      if (!parent) break;
      line.unshift(parent.fromPersonId);
    }
    while (line.length < 5) {
      const child = parents.find(
        (r) => r.fromPersonId === line.at(-1) && !line.includes(r.toPersonId),
      );
      if (!child) break;
      line.push(child.toPersonId);
    }
    return new Set(line);
  }
  const end = [...snapshot.people].sort(
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

/** Preserve saved node positions across arrivals. Newly supplied relatives are placed near existing links. */
export function stableFamilyLayout(
  people: Person[],
  relationships: Relationship[],
  previous: Record<string, { x: number; y: number }> = {},
) {
  const initial = familyLayout(people, relationships);
  if (!people.some((p) => previous[p.id]))
    return { ...initial, minX: 0, minY: 0 };
  const positions: Record<string, { x: number; y: number }> =
    Object.fromEntries(
      people
        .filter((p) => previous[p.id])
        .map((p) => [p.id, { ...previous[p.id] }]),
    );
  const pending = people.filter((p) => !positions[p.id]);
  for (let pass = 0; pending.length && pass <= people.length; pass++) {
    for (let i = 0; i < pending.length;) {
      const p = pending[i];
      const edge = relationships.find(
        (r) =>
          r.status !== "rejected" &&
          ((r.toPersonId === p.id && positions[r.fromPersonId]) ||
            (r.fromPersonId === p.id && positions[r.toPersonId])),
      );
      if (!edge && pass < people.length) {
        i++;
        continue;
      }
      const from = edge?.fromPersonId === p.id;
      const anchor = edge
        ? positions[from ? edge.toPersonId : edge.fromPersonId]
        : {
            x: Math.max(0, ...Object.values(positions).map((p) => p.x)) + 224,
            y: 40,
          };
      const y =
        edge && isParent(edge) ? anchor.y + (from ? -206 : 206) : anchor.y;
      let x = edge && !isParent(edge) ? anchor.x + 224 : anchor.x;
      let attempts = 0;
      while (
        Object.values(positions).some(
          (p) => Math.abs(p.x - x) < 210 && Math.abs(p.y - y) < 170,
        ) &&
        attempts++ <= people.length
      )
        x += 224;
      positions[p.id] = { x, y };
      pending.splice(i, 1);
    }
  }
  const minX = Math.min(0, ...Object.values(positions).map((p) => p.x - 30)),
    minY = Math.min(0, ...Object.values(positions).map((p) => p.y - 30));
  return {
    positions,
    minX,
    minY,
    width:
      Math.max(320, ...Object.values(positions).map((p) => p.x + 224)) - minX,
    height:
      Math.max(240, ...Object.values(positions).map((p) => p.y + 180)) - minY,
  };
}

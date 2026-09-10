import { useEffect, useMemo, useRef, useState } from "react";
import type { ProjectSnapshot, RootsApi } from "./types";
import {
  branchIds,
  familyLayout,
  stableFamilyLayout,
  isParent,
  years,
} from "./model";
import { OriginalPhoto } from "./OriginalPhotos";
import { SourceConnection, type SavedConnection } from "./SourceConnection";
export function FamilyCanvas({
  snapshot,
  api,
  selectedId,
  highlightId,
  changedPersonIds = [],
  changedRelationshipIds = [],
  savedConnection,
  onSelect,
  onRelationship,
  onAdd,
}: {
  snapshot: ProjectSnapshot;
  api: RootsApi;
  selectedId: string | null;
  highlightId: string | null;
  changedPersonIds?: string[];
  changedRelationshipIds?: string[];
  savedConnection?: SavedConnection | null;
  onSelect: (id: string) => void;
  onRelationship: (id: string) => void;
  onAdd: () => void;
}) {
  const [all, setAll] = useState(!!snapshot.run),
    [branchPersonId, setBranchPersonId] = useState<string | undefined>(),
    [query, setQuery] = useState(""),
    [scale, setScale] = useState(0.8),
    [offset, setOffset] = useState({ x: 20, y: 20 });
  const viewport = useRef<HTMLDivElement>(null);
  const cameraTouched = useRef(false);
  const pan = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
    null,
  );
  const branch = useMemo(
    () => branchIds(snapshot, branchPersonId),
    [
      snapshot.people,
      snapshot.relationships,
      snapshot.input.seedName,
      branchPersonId,
    ],
  );
  const people = all
    ? snapshot.people
    : snapshot.people.filter((p) => branch.has(p.id));
  const savedPositions = useRef<{
    project: string;
    positions: Record<string, { x: number; y: number }>;
  }>({ project: snapshot.projectId, positions: {} });
  const layout = useMemo(() => {
    const full = snapshot.run
      ? stableFamilyLayout(
          people,
          snapshot.relationships,
          savedPositions.current.project === snapshot.projectId
            ? savedPositions.current.positions
            : {},
        )
      : { ...familyLayout(people, snapshot.relationships), minX: 0, minY: 0 };
    if (all)
      savedPositions.current = {
        project: snapshot.projectId,
        positions: full.positions,
      };
    if (all) return full;
    const ordered = [...people].sort(
      (a, b) => full.positions[a.id].y - full.positions[b.id].y,
    );
    return {
      positions: Object.fromEntries(
        ordered.map((p, i) => [p.id, { x: 30, y: 16 + i * 78 }]),
      ),
      minX: 0,
      minY: 0,
      width: 320,
      height: Math.max(1, ordered.length) * 78 + 16,
    };
  }, [people, snapshot.relationships, all]);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const fit = () => {
    if (!viewport.current) return;
    const currentLayout = layoutRef.current;
    const rect = viewport.current.getBoundingClientRect();
    const next = Math.max(
      0.2,
      Math.min(
        1,
        Math.min(
          (rect.width - 50) / currentLayout.width,
          (rect.height - 40) / currentLayout.height,
        ),
      ),
    );
    setScale(next);
    setOffset({
      x:
        (rect.width - currentLayout.width * next) / 2 -
        currentLayout.minX * next,
      y:
        Math.max(15, (rect.height - currentLayout.height * next) / 2) -
        currentLayout.minY * next,
    });
  };
  const viewKey = all ? "all" : branchPersonId || "default";
  useEffect(() => {
    cameraTouched.current = false;
    fit();
    if (!viewport.current) return;
    const observer = new ResizeObserver(() => {
      if (!cameraTouched.current) fit();
    });
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, [viewKey, snapshot.projectId]);
  const focus = (id: string, inspect = true) => {
    cameraTouched.current = true;
    setBranchPersonId(id);
    const p = layout.positions[id];
    if (!p) {
      setAll(true);
      return;
    }
    if (viewport.current) {
      const r = viewport.current.getBoundingClientRect();
      const next = Math.max(0.85, scale);
      setScale(next);
      setOffset({
        x: r.width / 2 - (p.x + (all ? 96 : 130)) * next,
        y: r.height / 2 - (p.y + (all ? 64 : 30)) * next,
      });
    }
    if (inspect) onSelect(id);
  };
  const results = query.trim()
    ? snapshot.people.filter((p) =>
        `${p.displayNameEn} ${p.originalName || ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      )
    : [];
  return (
    <section className="family-canvas" aria-label="Family map">
      <div className="canvas-heading">
        <div>
          <span className="eyebrow">The connections you keep</span>
          <h2>Your family map</h2>
        </div>
        <button onClick={onAdd}>+ Add</button>
      </div>
      <div className="map-toolbar">
        <div className="map-search">
          <input
            aria-label="Search people"
            placeholder="Find a person…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value) setAll(true);
            }}
          />
          {query && (
            <div className="search-results">
              {results.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    focus(p.id);
                    setQuery("");
                  }}
                >
                  {p.displayNameEn}
                </button>
              ))}
              {!results.length && <p>No matching people</p>}
            </div>
          )}
        </div>
        <button onClick={() => setAll(!all)}>
          {all ? "Focused branch" : `View all ${snapshot.people.length}`}
        </button>
        <select
          className="branch-person"
          aria-label="Choose a family branch"
          value={branchPersonId || ""}
          onChange={(e) => {
            setBranchPersonId(e.target.value || undefined);
            setAll(false);
          }}
        >
          <option value="">Starting family branch</option>
          {snapshot.people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.displayNameEn}
            </option>
          ))}
        </select>
      </div>
      <div
        ref={viewport}
        className="map-viewport"
        onPointerDown={(e) => {
          if (
            (e.target as HTMLElement).closest('button,a,input,[role="button"]')
          )
            return;
          cameraTouched.current = true;
          pan.current = {
            x: e.clientX,
            y: e.clientY,
            ox: offset.x,
            oy: offset.y,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (pan.current)
            setOffset({
              x: pan.current.ox + e.clientX - pan.current.x,
              y: pan.current.oy + e.clientY - pan.current.y,
            });
        }}
        onPointerUp={() => {
          pan.current = null;
        }}
        onPointerCancel={() => {
          pan.current = null;
        }}
      >
        {savedConnection && layout.positions[savedConnection.personId] && (
          <SourceConnection
            connection={savedConnection}
            target={{
              x:
                offset.x +
                (layout.positions[savedConnection.personId].x +
                  (all ? 96 : 130)) *
                  scale,
              y:
                offset.y + layout.positions[savedConnection.personId].y * scale,
            }}
          />
        )}
        {people.length === 0 ? (
          <div className="map-empty">
            <span>♧</span>
            <h3>A place for your family</h3>
            <p>
              {snapshot.run?.sealedAt ? (
                "This edition has no released family records. Your saved sources and open questions remain available."
              ) : (
                <>
                  People appear here when saved records are ready.
                  <br />
                  You can add a person or contribute another clue.
                </>
              )}
            </p>
          </div>
        ) : (
          <div
            className={`map-stage ${all ? "" : "focused-generation"}`}
            style={{
              width: layout.width,
              height: layout.height,
              transform: `translate(${offset.x}px,${offset.y}px) scale(${scale})`,
              transition: pan.current ? "none" : undefined,
            }}
          >
            <svg
              className="map-edges"
              width={layout.width}
              height={layout.height}
              aria-label="Family relationships"
            >
              {snapshot.relationships.map((r) => {
                const a = layout.positions[r.fromPersonId],
                  b = layout.positions[r.toPersonId];
                if (!a || !b || r.status === "rejected") return null;
                const parent = isParent(r),
                  cardWidth = all ? 192 : 260,
                  cardHeight = all ? 146 : 60,
                  x1 = a.x + (parent ? cardWidth / 2 : cardWidth),
                  y1 = a.y + (parent ? cardHeight : cardHeight / 2),
                  x2 = b.x + (parent ? cardWidth / 2 : 0),
                  y2 = b.y + (parent ? 0 : cardHeight / 2);
                const d = parent
                  ? `M${x1} ${y1} V${(y1 + y2) / 2} H${x2} V${y2}`
                  : `M${x1} ${y1} L${x2} ${y2}`;
                return (
                  <g
                    key={r.id}
                    className={`edge ${changedRelationshipIds.includes(r.id) ? "just-saved-edge" : ""} ${r.status === "accepted" ? "" : "uncertain"} ${parent ? "" : "partner"}`}
                  >
                    <path d={d} />
                    <path
                      className="edge-hit"
                      d={d}
                      onClick={() => onRelationship(r.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onRelationship(r.id);
                        }
                      }}
                    />
                  </g>
                );
              })}
            </svg>
            {snapshot.relationships
              .filter((r) => r.status !== "rejected")
              .map((r) => {
                const a = layout.positions[r.fromPersonId],
                  b = layout.positions[r.toPersonId];
                if (!a || !b) return null;
                const parent = isParent(r),
                  w = all ? 192 : 260,
                  h = all ? 146 : 60;
                const x = parent
                  ? (a.x + b.x) / 2 + w / 2
                  : (a.x + w + b.x) / 2;
                const y = parent
                  ? (a.y + h + b.y) / 2
                  : (a.y + b.y) / 2 + h / 2;
                return (
                  <button
                    className={`relationship-handle ${r.status === "accepted" ? "" : "uncertain"}`}
                    key={`handle-${r.id}`}
                    style={{ left: x - 8, top: y - 8 }}
                    aria-label={`${snapshot.people.find((p) => p.id === r.fromPersonId)?.displayNameEn} ${r.type} ${snapshot.people.find((p) => p.id === r.toPersonId)?.displayNameEn}`}
                    title="Inspect relationship evidence"
                    onClick={() => onRelationship(r.id)}
                  >
                    ·
                  </button>
                );
              })}
            {people.map((p) => {
              const pos = layout.positions[p.id];
              const uncertain = snapshot.claims.some(
                (c) =>
                  c.subjectId === p.id &&
                  ["disputed", "unresolved", "proposed"].includes(c.status),
              );
              return (
                <button
                  key={p.id}
                  className={`person-node ${selectedId === p.id ? "selected" : ""} ${highlightId === p.id || changedPersonIds.includes(p.id) ? "just-saved" : ""}`}
                  style={{ left: pos.x, top: pos.y }}
                  onClick={() => onSelect(p.id)}
                >
                  <div className="person-portrait">
                    {p.photoIds[0] ? (
                      <OriginalPhoto
                        src={api.assetUrl(snapshot.projectId, p.photoIds[0])}
                        alt={`${p.displayNameEn}, original family photo`}
                      />
                    ) : (
                      <span>
                        {p.displayNameEn
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")}
                      </span>
                    )}
                  </div>
                  <strong>{p.displayNameEn}</strong>
                  <small>{years(p)}</small>
                  {uncertain && (
                    <span
                      className="uncertainty"
                      title="Open or conflicting evidence"
                      aria-label="Open or conflicting evidence"
                    >
                      ?
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="map-bottom">
        <span>
          <i /> Saved family records <span className="uncertain-key">┄</span>{" "}
          Unresolved
        </span>
        <div className="zoom-tools">
          <button
            aria-label="Zoom out"
            onClick={() => {
              cameraTouched.current = true;
              setScale((s) => Math.max(0.2, s - 0.15));
            }}
          >
            −
          </button>
          <span>{Math.round(scale * 100)}%</span>
          <button
            aria-label="Zoom in"
            onClick={() => {
              cameraTouched.current = true;
              setScale((s) => Math.min(1.8, s + 0.15));
            }}
          >
            +
          </button>
          <button
            onClick={() => {
              cameraTouched.current = true;
              fit();
            }}
          >
            Fit
          </button>
        </div>
      </div>
    </section>
  );
}

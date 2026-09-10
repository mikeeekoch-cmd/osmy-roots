import { useEffect, useMemo, useRef, useState } from "react";
import type { ProjectSnapshot, RootsApi } from "./types";
import { branchIds, familyLayout, isParent, years } from "./model";
export function FamilyCanvas({
  snapshot,
  api,
  selectedId,
  highlightId,
  onSelect,
  onRelationship,
  onAdd,
}: {
  snapshot: ProjectSnapshot;
  api: RootsApi;
  selectedId: string | null;
  highlightId: string | null;
  onSelect: (id: string) => void;
  onRelationship: (id: string) => void;
  onAdd: () => void;
}) {
  const [all, setAll] = useState(false),
    [query, setQuery] = useState(""),
    [scale, setScale] = useState(0.8),
    [offset, setOffset] = useState({ x: 20, y: 20 });
  const viewport = useRef<HTMLDivElement>(null);
  const pan = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
    null,
  );
  const branch = useMemo(
    () => branchIds(snapshot),
    [snapshot.people, snapshot.relationships, snapshot.input.seedName],
  );
  const people = all
    ? snapshot.people
    : snapshot.people.filter((p) => branch.has(p.id));
  const layout = useMemo(
    () => familyLayout(people, snapshot.relationships),
    [people, snapshot.relationships],
  );
  const fit = () => {
    if (!viewport.current) return;
    const rect = viewport.current.getBoundingClientRect();
    const next = Math.max(
      0.2,
      Math.min(
        1,
        Math.min(
          (rect.width - 50) / layout.width,
          (rect.height - 40) / layout.height,
        ),
      ),
    );
    setScale(next);
    setOffset({
      x: (rect.width - layout.width * next) / 2,
      y: Math.max(15, (rect.height - layout.height * next) / 2),
    });
  };
  useEffect(() => {
    fit();
  }, [all, snapshot.people.length]);
  const focus = (id: string) => {
    const p = layout.positions[id];
    if (!p) {
      setAll(true);
      return;
    }
    if (viewport.current) {
      const r = viewport.current.getBoundingClientRect();
      setOffset({
        x: r.width / 2 - (p.x + 96) * scale,
        y: r.height / 2 - (p.y + 64) * scale,
      });
    }
    onSelect(id);
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
      </div>
      <div
        ref={viewport}
        className="map-viewport"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button,a,input")) return;
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
        {people.length === 0 ? (
          <div className="map-empty">
            <span>♧</span>
            <h3>A place for your family</h3>
            <p>
              People appear here when saved records are ready.
              <br />
              You can add a person or contribute another clue.
            </p>
          </div>
        ) : (
          <div
            className="map-stage"
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
                if (!a || !b) return null;
                const parent = isParent(r),
                  x1 = a.x + (parent ? 96 : 192),
                  y1 = a.y + (parent ? 146 : 70),
                  x2 = b.x + (parent ? 96 : 0),
                  y2 = b.y + (parent ? 0 : 70);
                const d = parent
                  ? `M${x1} ${y1} V${(y1 + y2) / 2} H${x2} V${y2}`
                  : `M${x1} ${y1} L${x2} ${y2}`;
                return (
                  <g
                    key={r.id}
                    className={`edge ${r.status === "accepted" ? "" : "uncertain"} ${parent ? "" : "partner"}`}
                  >
                    <path d={d} />
                    <path
                      className="edge-hit"
                      d={d}
                      role="button"
                      tabIndex={0}
                      aria-label={`${snapshot.people.find((p) => p.id === r.fromPersonId)?.displayNameEn} ${r.type} ${snapshot.people.find((p) => p.id === r.toPersonId)?.displayNameEn}`}
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
                  className={`person-node ${selectedId === p.id ? "selected" : ""} ${highlightId === p.id ? "just-saved" : ""}`}
                  style={{ left: pos.x, top: pos.y }}
                  onClick={() => onSelect(p.id)}
                >
                  <div className="person-portrait">
                    {p.photoIds[0] ? (
                      <img
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
            onClick={() => setScale((s) => Math.max(0.2, s - 0.15))}
          >
            −
          </button>
          <span>{Math.round(scale * 100)}%</span>
          <button
            aria-label="Zoom in"
            onClick={() => setScale((s) => Math.min(1.8, s + 0.15))}
          >
            +
          </button>
          <button onClick={fit}>Fit</button>
        </div>
      </div>
    </section>
  );
}

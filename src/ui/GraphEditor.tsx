import { useState, type FormEvent } from "react";
import type { GraphMutation, ProjectSnapshot } from "./types";
export function GraphEditor({
  snapshot,
  operation,
  entityId,
  busy,
  onSave,
  onClose,
}: {
  snapshot: ProjectSnapshot;
  operation: GraphMutation["operation"];
  entityId?: string;
  busy: boolean;
  onSave: (mutation: GraphMutation) => void;
  onClose: () => void;
}) {
  const person = snapshot.people.find((p) => p.id === entityId),
    relation = snapshot.relationships.find((r) => r.id === entityId);
  const [kind, setKind] = useState<GraphMutation["operation"]>(operation),
    [name, setName] = useState(person?.displayNameEn || ""),
    [original, setOriginal] = useState(person?.originalName || ""),
    [birth, setBirth] = useState(person?.lifeYears.birth.value || ""),
    [death, setDeath] = useState(person?.lifeYears.death.value || ""),
    [birthPrecision, setBirthPrecision] = useState(
      person?.lifeYears.birth.precision || "unknown",
    ),
    [deathPrecision, setDeathPrecision] = useState(
      person?.lifeYears.death.precision || "unknown",
    ),
    [from, setFrom] = useState(
      relation?.fromPersonId || snapshot.people[0]?.id || "",
    ),
    [to, setTo] = useState(
      relation?.toPersonId || snapshot.people[1]?.id || "",
    ),
    [type, setType] = useState(relation?.type || "parent"),
    [editVersion] = useState(snapshot.version),
    [error, setError] = useState("");
  const isPerson = kind === "addPerson" || kind === "editPerson";
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (isPerson && !name.trim()) return setError("A name is required.");
    if (!isPerson && (!from || !to || from === to))
      return setError("Choose two different people.");
    onSave({
      operation: kind,
      entityId,
      baseVersion: editVersion,
      values: isPerson
        ? {
            displayNameEn: name.trim(),
            originalName: original.trim(),
            lifeYears: {
              birth: {
                value: birth || null,
                precision: birth
                  ? birthPrecision === "unknown"
                    ? "year"
                    : birthPrecision
                  : "unknown",
              },
              death: {
                value: death || null,
                precision: death
                  ? deathPrecision === "unknown"
                    ? "year"
                    : deathPrecision
                  : "unknown",
              },
            },
          }
        : { fromPersonId: from, toPersonId: to, type },
    });
  };
  return (
    <section className="graph-editor" aria-label="Edit family records">
      <div className="drawer-header">
        <h2>{entityId ? "Edit family record" : "Add to your family"}</h2>
        <button onClick={onClose} aria-label="Close editor">
          ×
        </button>
      </div>
      <form onSubmit={submit}>
        {!entityId && (
          <label className="field">
            What would you like to add?
            <select
              value={kind}
              onChange={(e) =>
                setKind(e.target.value as GraphMutation["operation"])
              }
            >
              <option value="addPerson">Person</option>
              <option value="addRelationship">Relationship</option>
            </select>
          </label>
        )}
        {isPerson ? (
          <>
            <label className="field">
              English display name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
            <label className="field">
              Original name
              <input
                value={original}
                onChange={(e) => setOriginal(e.target.value)}
              />
            </label>
            {(["birth", "death"] as const).map((k) => (
              <div className="date-fields" key={k}>
                <label className="field">
                  {k === "birth" ? "Birth" : "Death"}
                  <input
                    placeholder="Unknown"
                    value={k === "birth" ? birth : death}
                    onChange={(e) =>
                      (k === "birth" ? setBirth : setDeath)(e.target.value)
                    }
                  />
                </label>
                <label className="field">
                  Precision
                  <select
                    value={k === "birth" ? birthPrecision : deathPrecision}
                    onChange={(e) =>
                      (k === "birth" ? setBirthPrecision : setDeathPrecision)(
                        e.target.value as typeof birthPrecision,
                      )
                    }
                  >
                    {["unknown", "approximate", "year", "month", "day"].map(
                      (v) => (
                        <option key={v}>{v}</option>
                      ),
                    )}
                  </select>
                </label>
              </div>
            ))}
          </>
        ) : (
          <>
            <label className="field">
              From person (parent, for a parent link)
              <select value={from} onChange={(e) => setFrom(e.target.value)}>
                {snapshot.people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayNameEn}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Relationship
              <select
                value={type}
                onChange={(e) => setType(e.target.value as typeof type)}
              >
                <option value="parent">Parent of</option>
                <option value="partner">Partner of</option>
                <option value="sibling">Sibling of</option>
              </select>
            </label>
            <label className="field">
              To person
              <select value={to} onChange={(e) => setTo(e.target.value)}>
                {snapshot.people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayNameEn}
                  </option>
                ))}
              </select>
            </label>
            <p className="muted">
              This relationship will be recorded as your contribution, with the
              original edit preserved as evidence.
            </p>
          </>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <p className="muted">
          Edits are saved with history. Original evidence stays intact.
        </p>
        <button className="primary" disabled={busy}>
          Save {isPerson ? "person" : "relationship"}
        </button>
      </form>
    </section>
  );
}

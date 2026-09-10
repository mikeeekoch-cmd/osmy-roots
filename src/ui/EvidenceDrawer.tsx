import type { ProjectSnapshot, RootsApi, Source, GraphMutation } from "./types";
import { label, years } from "./model";
import { OriginalPhotos } from "./OriginalPhotos";
export function SourceEvidence({
  source,
  quote,
}: {
  source: Source;
  quote?: string;
}) {
  const original =
    quote ||
    source.originalText ||
    "Original file stored; text has not been extracted.";
  return (
    <article className="source-evidence">
      <span className={`origin ${source.origin}`}>{source.origin}</span>
      <h4>{source.title || source.originalLocator}</h4>
      {source.author && <small>From {source.author}</small>}
      {source.reconstructed && (
        <p className="source-origin-note">
          Reconstructed correspondence based on supplied family evidence. The
          dialogue is not an original family message.
        </p>
      )}
      {!!source.lineage?.length && (
        <p className="source-origin-note">
          English derivative. The translation retains its original evidence
          lineage.
        </p>
      )}
      {!!source.evidenceRootIds?.length && (
        <small>
          Copies with the same evidence root are counted as one source.
        </small>
      )}
      {source.kind === "human_edit" ? (
        <details>
          <summary>Inspect original saved entry</summary>
          <blockquote>{original}</blockquote>
        </details>
      ) : (
        <blockquote>{original}</blockquote>
      )}
      <small className="source-locator">{source.originalLocator}</small>
    </article>
  );
}
export function EvidenceDrawer({
  snapshot,
  api,
  selection,
  onClose,
  onEdit,
  onReviewProposal,
}: {
  snapshot: ProjectSnapshot;
  api: RootsApi;
  selection: { kind: "person" | "relationship" | "source"; id: string };
  onClose: () => void;
  onEdit: (operation: GraphMutation["operation"], id: string) => void;
  onReviewProposal: (id: string) => void;
}) {
  const person =
    selection.kind === "person"
      ? snapshot.people.find((p) => p.id === selection.id)
      : undefined;
  const relationship =
    selection.kind === "relationship"
      ? snapshot.relationships.find((r) => r.id === selection.id)
      : undefined;
  const directSource =
    selection.kind === "source"
      ? snapshot.sources.find((s) => s.id === selection.id)
      : undefined;
  const claims = snapshot.claims.filter((c) =>
    person
      ? c.subjectId === person.id || person.claimIds.includes(c.id)
      : relationship?.claimIds.includes(c.id),
  );
  const stories = person
    ? snapshot.stories.filter((s) => s.personId === person.id)
    : [];
  const sourceIds = new Set([
    ...claims.flatMap((c) => c.sourceIds),
    ...stories.flatMap((s) => s.sourceIds),
    ...snapshot.assets
      .filter((a) => person?.photoIds.includes(a.id))
      .map((a) => a.sourceId),
  ]);
  const sources = directSource
    ? [directSource]
    : snapshot.sources.filter((s) => sourceIds.has(s.id));
  const title =
    person?.displayNameEn ||
    (relationship
      ? `${snapshot.people.find((p) => p.id === relationship.fromPersonId)?.displayNameEn || "?"} → ${snapshot.people.find((p) => p.id === relationship.toPersonId)?.displayNameEn || "?"}`
      : directSource?.title || "Source evidence");
  return (
    <section className="evidence-drawer" aria-label="Selected evidence">
      <div className="drawer-header">
        <span className="eyebrow">{selection.kind} · Evidence & history</span>
        <button onClick={onClose} aria-label="Close evidence">
          ×
        </button>
      </div>
      <h2>{title}</h2>
      {person && (
        <>
          <p className="muted">
            {!snapshot.run && (
              <>
                {person.originalName}
                <br />
              </>
            )}
            {years(person)}
          </p>
          <OriginalPhotos ids={person.photoIds} snapshot={snapshot} api={api} />
          <button onClick={() => onEdit("editPerson", person.id)}>
            Edit person
          </button>
        </>
      )}
      {relationship && (
        <>
          <p>
            <span className="badge">{label(relationship.type)}</span>{" "}
            <span className="badge">{relationship.status}</span>
          </p>
          <button onClick={() => onEdit("editRelationship", relationship.id)}>
            Edit relationship
          </button>
        </>
      )}
      {claims.length > 0 && (
        <>
          <h3>Facts & open questions</h3>
          {claims.map((c) => (
            <article key={c.id} className={`claim ${c.status}`}>
              <span className="badge">
                {label(c.evidenceType)} · {c.status}
              </span>
              <p>
                <strong>
                  {c.predicate === "human_profile_edit"
                    ? "Saved person details"
                    : label(c.predicate)}
                  :
                </strong>{" "}
                {c.predicate === "human_profile_edit"
                  ? "Name and life dates recorded by a family contributor."
                  : c.value}
              </p>
              {c.predicate === "human_profile_edit" ? (
                <details>
                  <summary>Original saved entry</summary>
                  <blockquote>{c.value}</blockquote>
                  {c.spans.map((span, i) => (
                    <small key={i}>{span.locator}</small>
                  ))}
                </details>
              ) : (
                c.spans.map((span, i) => (
                  <div key={i}>
                    <blockquote>{span.quote}</blockquote>
                    <small>{span.locator}</small>
                  </div>
                ))
              )}
            </article>
          ))}
        </>
      )}
      {stories.length > 0 && (
        <>
          <h3>Stories in their own words</h3>
          {stories.map((s) => (
            <article className="story" key={s.id}>
              <span className="badge">
                {label(s.evidenceType)} · {s.status}
              </span>
              <p>{s.text}</p>
              <small>{s.attribution}</small>
              {s.spans.map((span, i) => (
                <details key={i}>
                  <summary>Original quote</summary>
                  <blockquote>{span.quote}</blockquote>
                  <small>{span.locator}</small>
                </details>
              ))}
            </article>
          ))}
        </>
      )}
      {person &&
        snapshot.proposals.some(
          (p) =>
            p.personId === person.id &&
            ["accepted", "corrected"].includes(p.status),
        ) && (
          <section>
            <h3>Reviewed interpretations</h3>
            {snapshot.proposals
              .filter(
                (p) =>
                  p.personId === person.id &&
                  ["accepted", "corrected"].includes(p.status),
              )
              .map((p) => (
                <article className="story" key={p.id}>
                  <p>{p.text}</p>
                  <button onClick={() => onReviewProposal(p.id)}>
                    Correct interpretation
                  </button>
                </article>
              ))}
          </section>
        )}
      <h3>Original evidence ({sources.length})</h3>
      {directSource && (
        <OriginalPhotos
          ids={snapshot.assets
            .filter(
              (a) =>
                a.sourceId === directSource.id &&
                a.mediaType.startsWith("image/"),
            )
            .map((a) => a.id)}
          snapshot={snapshot}
          api={api}
        />
      )}
      {sources.length ? (
        sources.map((s) => <SourceEvidence key={s.id} source={s} />)
      ) : (
        <p className="muted">
          No linked source yet. This remains an open evidence gap.
        </p>
      )}
      {snapshot.issues.length > 0 && (
        <details>
          <summary>
            Unresolved project questions ({snapshot.issues.length})
          </summary>
          {snapshot.issues.map((issue, i) => (
            <p key={i}>{issue}</p>
          ))}
        </details>
      )}
      <details className="history">
        <summary>Project change history ({snapshot.history.length})</summary>
        {snapshot.history
          .slice()
          .reverse()
          .map((h) => (
            <article key={h.eventId}>
              <strong>{label(h.action)}</strong>
              <small>
                {h.actor} · {new Date(h.at).toLocaleString()} · v
                {h.projectVersion}
              </small>
              <details>
                <summary>Before / after</summary>
                <pre>
                  {JSON.stringify(
                    { before: h.before, after: h.after },
                    null,
                    2,
                  )}
                </pre>
              </details>
            </article>
          ))}
      </details>
    </section>
  );
}

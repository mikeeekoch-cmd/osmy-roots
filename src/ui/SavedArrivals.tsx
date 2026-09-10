import type { ProjectSnapshot, RootsApi } from "./types";
import { OriginalPhoto } from "./OriginalPhotos";
export interface SavedDelta {
  version: number;
  personIds: string[];
  relationshipIds: string[];
  photoIds: string[];
  storyIds: string[];
  sourceIds: string[];
}
export function savedDelta(
  before: ProjectSnapshot,
  after: ProjectSnapshot,
): SavedDelta | null {
  if (before.projectId !== after.projectId || after.version <= before.version)
    return null;
  const changed = <T extends { id: string }>(old: T[], next: T[]) =>
    next
      .filter((item) => {
        const prior = old.find((p) => p.id === item.id);
        return !prior || JSON.stringify(prior) !== JSON.stringify(item);
      })
      .map((item) => item.id);
  const changedPeople = changed(before.people, after.people);
  const changedClaims = changed(before.claims, after.claims);
  const relationshipIds = changed(before.relationships, after.relationships);
  const photoIds = [...new Set(after.people.flatMap((p) => p.photoIds))].filter(
    (id) => !before.people.some((p) => p.photoIds.includes(id)),
  );
  const storyIds = changed(before.stories, after.stories);
  const personIds = [
    ...new Set([
      ...changedPeople,
      ...after.stories
        .filter((story) => storyIds.includes(story.id))
        .map((story) => story.personId),
      ...after.claims
        .filter(
          (claim) =>
            changedClaims.includes(claim.id) &&
            after.people.some((p) => p.id === claim.subjectId),
        )
        .map((claim) => claim.subjectId),
    ]),
  ];
  const linkedClaimIds = new Set([
    ...changedClaims,
    ...after.people
      .filter((p) => !before.people.some((old) => old.id === p.id))
      .flatMap((p) => p.claimIds),
    ...after.relationships
      .filter((r) => relationshipIds.includes(r.id))
      .flatMap((r) => r.claimIds),
  ]);
  const sourceIds = [
    ...new Set([
      ...after.claims
        .filter((c) => linkedClaimIds.has(c.id))
        .flatMap((c) => c.sourceIds),
      ...after.stories
        .filter((s) => storyIds.includes(s.id))
        .flatMap((s) => s.sourceIds),
      ...after.assets
        .filter((a) => photoIds.includes(a.id))
        .map((a) => a.sourceId),
    ]),
  ].filter((id) => after.sources.some((source) => source.id === id));
  return personIds.length ||
    relationshipIds.length ||
    photoIds.length ||
    storyIds.length
    ? {
        version: after.version,
        personIds,
        relationshipIds,
        photoIds,
        storyIds,
        sourceIds,
      }
    : null;
}
export function SavedArrivals({
  delta,
  snapshot,
  api,
  onSelect,
  onSource,
}: {
  delta: SavedDelta;
  snapshot: ProjectSnapshot;
  api: RootsApi;
  onSelect: (id: string) => void;
  onSource: (id: string) => void;
}) {
  const items = [
    delta.personIds.length &&
      `${delta.personIds.length} ${delta.personIds.length === 1 ? "person" : "people"}`,
    delta.relationshipIds.length &&
      `${delta.relationshipIds.length} ${delta.relationshipIds.length === 1 ? "connection" : "connections"}`,
    delta.photoIds.length &&
      `${delta.photoIds.length} ${delta.photoIds.length === 1 ? "photo" : "photos"}`,
    delta.storyIds.length &&
      `${delta.storyIds.length} ${delta.storyIds.length === 1 ? "story" : "stories"}`,
  ].filter(Boolean);
  return (
    <aside
      className="saved-arrivals"
      key={delta.version}
      aria-label="Saved family updates"
    >
      <div>
        <span role="status">Saved updates · {items.join(" · ")}</span>
        {delta.storyIds.slice(0, 1).map((id) => {
          const story = snapshot.stories.find((story) => story.id === id);
          return (
            story && (
              <button
                className="saved-story"
                key={id}
                onClick={() => onSelect(story.personId)}
              >
                {story.text.slice(0, 160)}
                {story.text.length > 160 ? "…" : ""}{" "}
                <small>· {story.status.replaceAll("_", " ")}</small>
              </button>
            )
          );
        })}
        {delta.sourceIds.length > 0 && (
          <div
            className="saved-update-sources"
            aria-label="Sources behind these updates"
          >
            {delta.sourceIds.slice(0, 3).map((id) => {
              const source = snapshot.sources.find((s) => s.id === id)!;
              return (
                <button
                  className="text-button"
                  key={id}
                  onClick={() => onSource(id)}
                >
                  {source.title || source.originalLocator} ↗
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div>
        {delta.photoIds.slice(0, 3).map((id) => {
          const person = snapshot.people.find((p) => p.photoIds.includes(id));
          return (
            <button
              key={id}
              onClick={() => person && onSelect(person.id)}
              aria-label={`View saved photo${person ? ` for ${person.displayNameEn}` : ""}`}
            >
              <OriginalPhoto
                src={api.assetUrl(snapshot.projectId, id)}
                alt="Newly linked source photograph"
              />
            </button>
          );
        })}
      </div>
    </aside>
  );
}

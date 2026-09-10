import type { ProjectSnapshot, RootsApi } from "./types";
import { OriginalPhoto } from "./OriginalPhotos";
export interface SavedDelta {
  version: number;
  personIds: string[];
  relationshipIds: string[];
  photoIds: string[];
  storyIds: string[];
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
  const personIds = changed(before.people, after.people);
  const relationshipIds = changed(before.relationships, after.relationships);
  const photoIds = [...new Set(after.people.flatMap((p) => p.photoIds))].filter(
    (id) => !before.people.some((p) => p.photoIds.includes(id)),
  );
  const storyIds = changed(before.stories, after.stories);
  return personIds.length ||
    relationshipIds.length ||
    photoIds.length ||
    storyIds.length
    ? { version: after.version, personIds, relationshipIds, photoIds, storyIds }
    : null;
}
export function SavedArrivals({
  delta,
  snapshot,
  api,
  onSelect,
}: {
  delta: SavedDelta;
  snapshot: ProjectSnapshot;
  api: RootsApi;
  onSelect: (id: string) => void;
}) {
  const items = [
    delta.personIds.length && `${delta.personIds.length} people`,
    delta.relationshipIds.length &&
      `${delta.relationshipIds.length} connections`,
    delta.photoIds.length && `${delta.photoIds.length} photos`,
    delta.storyIds.length && `${delta.storyIds.length} stories`,
  ].filter(Boolean);
  return (
    <aside
      className="saved-arrivals"
      key={delta.version}
      aria-label="Saved family updates"
    >
      <span role="status">Saved updates · {items.join(" · ")}</span>
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

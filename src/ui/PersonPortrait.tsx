import type { CSSProperties } from "react";
import type { Person, ProjectSnapshot, RootsApi } from "./types";
import { OriginalPhoto } from "./OriginalPhotos";
import { usableCrop } from "./PhotoComparison";
export function portraitForPerson(snapshot: ProjectSnapshot, personId: string) {
  const approved = snapshot.research?.portraits.find(p => p.personId === personId && p.reviewed && p.support.length && (p.kind === "solo" || p.kind === "reviewed_crop" && p.crop && usableCrop(p.crop)) && snapshot.assets.some(a => a.id === p.assetId && a.mediaType.startsWith("image/")));
  if (approved) return {assetId: approved.assetId, crop: approved.crop};
  if (snapshot.research) return undefined;
  // Legacy portraits are only used if a photo is not assigned to several people.
  const person = snapshot.people.find(p => p.id === personId);
  const assetId = person?.photoIds.find(id => snapshot.assets.some(a => a.id === id && a.mediaType.startsWith("image/")) && !snapshot.people.some(p => p.id !== personId && p.photoIds.includes(id)) && !snapshot.photoAnnotations?.some(a => a.assetId === id && (a.positions.length > 1 || (a.depictedPersonIds?.length || 0) > 1)));
  return assetId ? {assetId, crop: undefined} : undefined;
}
export function PersonPortrait({person, portrait, api, projectId}: {person: Person; portrait: ReturnType<typeof portraitForPerson>; api: RootsApi; projectId: string}) {
  const crop = portrait?.crop;
  const style: CSSProperties | undefined = crop ? {position: "absolute", width: `${100 / crop[2]}%`, height: `${100 / crop[3]}%`, left: `${-crop[0] / crop[2] * 100}%`, top: `${-crop[1] / crop[3] * 100}%`} : undefined;
  return portrait ? <span className={`supported-portrait ${crop ? "cropped" : ""}`} style={style}><OriginalPhoto src={api.assetUrl(projectId, portrait.assetId)} alt={`${person.displayNameEn}, source-supported portrait`} /></span> : <span>{person.displayNameEn.split(" ").map(n => n[0]).slice(0,2).join("")}</span>;
}

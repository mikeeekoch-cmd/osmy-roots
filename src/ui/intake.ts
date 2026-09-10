import type { AutofillDraft, IntakeProfile, ProjectInput } from "../../packages/contracts";
export const relativeRoles = ["father", "mother", "grandfather", "grandmother"] as const;
export const emptyProfile = (): IntakeProfile => ({self: {fullName: "", birthPlace: "", birthDate: {value: null, precision: "unknown"}}});
export function fieldValue(profile: IntakeProfile, path: string): string {
  const [role, field] = path.replace(/^profile\./, "").split(".");
  if (role === "self") return field === "birthDate" ? profile.self.birthDate?.value || "" : field === "fullName" || field === "birthPlace" ? profile.self[field] : "";
  if (!relativeRoles.includes(role as typeof relativeRoles[number])) return "";
  const relative = profile[role as typeof relativeRoles[number]];
  return field === "fullName" || field === "birthPlace" || field === "birthYear" || field === "side" ? relative?.[field] || "" : "";
}
export function updateProfile(profile: IntakeProfile, path: string, value: string): IntakeProfile {
  const [role, field] = path.replace(/^profile\./, "").split(".");
  if (role === "self") {
    if (field === "birthDate") return {...profile, self: {...profile.self, birthDate: {value: value || null, precision: !value ? "unknown" : /^\d{4}$/.test(value) ? "year" : /^\d{4}-\d{2}$/.test(value) ? "month" : /^\d{4}-\d{2}-\d{2}$/.test(value) ? "day" : "approximate"}}};
    if (field === "fullName" || field === "birthPlace") return {...profile, self: {...profile.self, [field]: value}};
  }
  if (relativeRoles.includes(role as typeof relativeRoles[number]) && ["fullName", "birthPlace", "birthYear", "side"].includes(field)) {
    if (field === "side" && !["maternal", "paternal", "unknown"].includes(value)) return profile;
    const key = role as typeof relativeRoles[number];
    return {...profile, [key]: {...{fullName: "", birthPlace: "", birthYear: "", side: "unknown"}, ...profile[key], [field]: value}};
  }
  return profile;
}
/** Apply supported empty fields only. Edits made while parsing also win. */
export function applyAutofill(profile: IntakeProfile, draft: AutofillDraft, touched: Set<string>) {
  let next = profile;
  const applied: string[] = [];
  for (const field of draft.fields) {
    const path = field.path.replace(/^profile\./, "");
    if (touched.has(path) || fieldValue(next, path) || field.conflicts.length || !field.support.length || !field.value.trim()) continue;
    const updated = updateProfile(next, path, field.value);
    if (updated !== next) applied.push(path);
    next = updated;
  }
  return {profile: next, applied};
}
export function profileInput(input: ProjectInput, profile: IntakeProfile): ProjectInput {
  const geography = profile.self.birthPlace || input.geography;
  return {...input, researchMode: "round3", profile, seedName: profile.self.fullName.trim(), birthPlace: profile.self.birthPlace, geography, geographyUnknown: !geography};
}

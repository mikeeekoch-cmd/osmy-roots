import { useRef, useState, type FormEvent } from "react";
import type { ProjectInput, RootsApi } from "./types";
import type { AutofillDraft } from "../../packages/contracts";
import { applyAutofill, emptyProfile, fieldValue, profileInput, relativeRoles, updateProfile } from "./intake";
import { ProviderConnections } from "./ProviderConnections";
import { FilePicker, validateFiles } from "./FilePicker";
export function validateInput(input: ProjectInput, fileCount: number): string | null {
  if (!input.seedName.trim()) return "Add a starting person or family name.";
  if (input.researchMode !== "round3" && !input.geography.trim() && !input.geographyUnknown)
    return "Add a family location or choose “I do not know.”";
  if (!fileCount) return "Add at least one family source file.";
  return null;
}
export function InputScreen({ onStart, busy, error, api }: {
  api?: RootsApi;
  onStart: (input: ProjectInput, files: File[]) => void;
  busy: boolean;
  error: string | null;
}) {
  const [input, setInput] = useState<ProjectInput>({ seedName: "", geography: "", geographyUnknown: false, context: "", preparedPacket: false, language: "en", aliases: [] });
  const [profile, setProfile] = useState(emptyProfile);
  const profileRef = useRef(profile); profileRef.current = profile;
  const touched = useRef(new Set<string>());
  const [autofill, setAutofill] = useState<AutofillDraft | null>(null);
  const [filling, setFilling] = useState(false);
  const [fillNotice, setFillNotice] = useState("");
  const fillLock = useRef(false);
  const edit = (path: string, value: string) => { touched.current.add(path); setProfile(p => updateProfile(p, path, value)); };
  const fill = async () => {
    if (fillLock.current || !api?.autofillFamilyDetails) return;
    fillLock.current = true; setFilling(true); setFillNotice("");
    try {
      const draft = await api.autofillFamilyDetails(profileInput(input, profileRef.current), files);
      const result = applyAutofill(profileRef.current, draft, touched.current);
      setProfile(result.profile); setAutofill(draft);
      setFillNotice(result.applied.length ? `${result.applied.length} supported fields filled. You can edit them in the form.` : "No empty fields could be filled without a conflict. Your edits are preserved.");
    } catch (error) { setFillNotice(error instanceof Error ? error.message : "Family details could not be read. Try again."); }
    finally { fillLock.current = false; setFilling(false); }
  };
  const [files, setFiles] = useState<File[]>([]);
  const [savedFiles, setSavedFiles] = useState<File[]>([]);
  const [reopen, setReopen] = useState(false);
  const [validation, setValidation] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const selected = reopen ? savedFiles : files;
    const issue = validateFiles(selected) || (reopen
      ? (!selected.some((f) => /\.json$/i.test(f.name)) ? "Select project.json from your downloaded family bundle, plus any original files." : null)
      : validateInput(profileInput(input, profile), selected.length));
    setValidation(issue);
    if (!issue) onStart(reopen ? { ...input, seedName: "Saved family project", geography: "", geographyUnknown: true } : profileInput(input, profile), selected);
  };
  return (
    <main className={`input-screen ${busy ? "is-preparing" : ""}`} aria-busy={busy}>
      {busy && <section className="start-preparation" role="status" aria-live="polite">
        <span className="preparation-symbol"><span className="spinner" /></span>
        <span className="eyebrow">Your family story starts here</span>
        <h1>{reopen ? "Opening your saved project" : "Preparing your family sources"}</h1>
        <p>{reopen ? "Reading the project and matching its original files." : `Uploading ${files.length} selected files and creating your project.`}</p>
        <p className="muted">Your sources stay attached to the people and stories they support.</p>
      </section>}
      <div className="intake-content" hidden={busy}>
        <div className="intro">
          <span className="eyebrow">Osmy Roots</span>
          <h1>Your family story,<br /><em>coming together.</em></h1>
          <p>Bring the photographs, family records and saved conversations.<br />Keep the stories and the sources behind them.</p>
        </div>
        <div className="intake-mode" role="group" aria-label="Choose how to begin">
          <button type="button" aria-pressed={!reopen} onClick={() => { setReopen(false); setValidation(null); }}>Start with family sources</button>
          <button type="button" aria-pressed={reopen} onClick={() => { setReopen(true); setValidation(null); }}>Open saved project</button>
        </div>
        <form className={`intake ${reopen ? "reopen-intake" : ""}`} onSubmit={submit} noValidate>
          <section className="intake-material">
            <span className="step-label">{reopen ? "Your saved family project" : "01 / Bring what you have"}</span>
            {reopen ? <>
              <p className="muted">Select project.json from your family-book ZIP. Add the original files from that bundle to restore photographs and evidence.</p>
              <FilePicker files={savedFiles} onChange={setSavedFiles} disabled={busy || filling} savedProject />
            </> : <>
              <FilePicker files={files} onChange={setFiles} disabled={busy || filling} />
              <ProviderConnections api={api} />
            </>}
          </section>
          <section className="intake-details">
            {!reopen && <>
              <span className="step-label">02 / Where should we begin?</span>
              <label className="field">Full name <span aria-hidden="true">*</span><input autoComplete="off" value={profile.self.fullName} onChange={e => edit("self.fullName", e.target.value)} placeholder="A full name" aria-required="true" /></label>
              <div className="intake-birth-fields"><label className="field">Birthplace <small>optional</small><input value={profile.self.birthPlace} onChange={e => edit("self.birthPlace", e.target.value)} placeholder="A village, region or country" /></label><label className="field">Birth date <small>optional</small><input value={profile.self.birthDate?.value || ""} onChange={e => edit("self.birthDate", e.target.value)} placeholder="Year, date or approximate year" /></label></div>
              <details className="optional"><summary>Family details <span>optional</span></summary><div className="relative-cards">
                {relativeRoles.map(role => <fieldset className="relative-card" key={role}><legend>{role[0].toUpperCase() + role.slice(1)}</legend>{(["fullName", "birthPlace", "birthYear"] as const).map(key => <label className="field" key={key}>{key === "fullName" ? "Full name" : key === "birthPlace" ? "Birthplace" : "Birth year"}<input value={fieldValue(profile, `${role}.${key}`)} onChange={e => edit(`${role}.${key}`, e.target.value)} /></label>)}{role.startsWith("grand") && <label className="field">Family side<select value={profile[role]?.side || "unknown"} onChange={e => edit(`${role}.side`, e.target.value)}><option value="unknown">Unknown</option><option value="maternal">Maternal</option><option value="paternal">Paternal</option></select></label>}</fieldset>)}
              </div></details>
              <button type="button" className="fill-family-button" disabled={filling || busy || !api?.autofillFamilyDetails} onClick={() => void fill()}>{filling ? "Reading family details…" : "Fill my family details"}</button>
              {!api?.autofillFamilyDetails && <small>Source autofill is unavailable in this connection.</small>}
              {fillNotice && <p className="autofill-notice" role="status">{fillNotice}</p>}
              {autofill && <details className="autofill-sources"><summary>Review autofill sources ({autofill.fields.length})</summary>{autofill.fields.map((f, i) => <article key={`${f.path}-${i}`}><strong>{f.path.replace(/^profile\./, "").replace(/^self\./, "Your ").replaceAll(".", " · ").replace("fullName", "full name").replace("birthPlace", "birthplace").replace("birthYear", "birth year").replace("birthDate", "birth date")}</strong><p>{f.value}</p>{f.conflicts.length > 0 && <p className="error">Conflicting values: {f.conflicts.join("; ")}. Kept for your review.</p>}{fieldValue(profile, f.path) !== f.value && <p>Your current value is preserved: {fieldValue(profile, f.path) || "blank"}.</p>}{f.support.map((span, j) => <blockquote key={j}>{span.quote}<small>{span.sourceId} · {span.locator}</small></blockquote>)}<button type="button" onClick={() => edit(f.path.replace(/^profile\./, ""), f.value)}>Use this value</button></article>)}</details>}

            </>}
            {(validation || error) && <p role="alert" className="error">{validation || error}</p>}
            <button className="primary start-button" disabled={busy || filling}>{reopen ? "Open saved project" : "Continue"} <span aria-hidden="true">↗</span></button>
            <p className="fine-print">Review the source-backed suggestions,<br />keep unknowns open, and add more at any time.</p>
          </section>
        </form>
      </div>
    </main>
  );
}

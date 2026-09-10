import { useState, type FormEvent } from "react";
import type { ProjectInput } from "./types";
import { FilePicker, validateFiles } from "./FilePicker";
export function validateInput(input: ProjectInput, fileCount: number): string | null {
  if (!input.seedName.trim()) return "Add a starting person or family name.";
  if (!input.geography.trim() && !input.geographyUnknown)
    return "Add a family location or choose “I do not know.”";
  if (!fileCount) return "Add at least one family source file.";
  return null;
}
export function InputScreen({ onStart, busy, error }: {
  onStart: (input: ProjectInput, files: File[]) => void;
  busy: boolean;
  error: string | null;
}) {
  const [input, setInput] = useState<ProjectInput>({ seedName: "", geography: "", geographyUnknown: false, context: "", preparedPacket: false, language: "en", aliases: [] });
  const [files, setFiles] = useState<File[]>([]);
  const [savedFiles, setSavedFiles] = useState<File[]>([]);
  const [reopen, setReopen] = useState(false);
  const [validation, setValidation] = useState<string | null>(null);
  const field = (key: keyof ProjectInput, value: string | boolean) => setInput((current) => ({ ...current, [key]: key === "aliases" ? String(value).split(",").map((s) => s.trim()).filter(Boolean) : value }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const selected = reopen ? savedFiles : files;
    const issue = validateFiles(selected) || (reopen
      ? (!selected.some((f) => /\.json$/i.test(f.name)) ? "Select project.json from your downloaded family bundle, plus any original files." : null)
      : validateInput(input, selected.length));
    setValidation(issue);
    if (!issue) onStart(reopen ? { ...input, seedName: "Saved family project", geography: "", geographyUnknown: true } : input, selected);
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
              <FilePicker files={savedFiles} onChange={setSavedFiles} disabled={busy} savedProject />
            </> : <>
              <FilePicker files={files} onChange={setFiles} disabled={busy} />
              <p className="photo-guidance">For group photographs, list people from left to right in your captions. Leave anyone you cannot identify as Unknown.</p>
              <div className="saved-source-cards" aria-label="Saved source copies">
                <article><span aria-hidden="true">▱</span><div><strong>Saved family folder</strong><small>Google Drive copies you select as files</small></div></article>
                <article><span aria-hidden="true">✉</span><div><strong>Saved family correspondence</strong><small>Email copies you select as files</small></div></article>
              </div>
            </>}
          </section>
          <section className="intake-details">
            {!reopen && <>
              <span className="step-label">02 / Where should we begin?</span>
              <label className="field">Starting person or family name <span aria-hidden="true">*</span><input autoComplete="off" value={input.seedName} onChange={(e) => field("seedName", e.target.value)} placeholder="A full name or family name" aria-required="true" /></label>
              <label className="field">Family geography<input value={input.geography} disabled={input.geographyUnknown} onChange={(e) => field("geography", e.target.value)} placeholder="A village, region or country" aria-required={!input.geographyUnknown} /></label>
              <label className="check"><input type="checkbox" checked={input.geographyUnknown} onChange={(e) => field("geographyUnknown", e.target.checked)} />I do not know the family location</label>
              <details className="optional"><summary>A few more details <span>optional</span></summary>
                {([["birthPlace", "Birthplace"], ["currentPlace", "Current place"], ["aliases", "Other names or spellings"]] as const).map(([key, text]) => <label className="field" key={key}>{text}<input value={key === "aliases" ? input.aliases.join(", ") : input[key] || ""} onChange={(e) => field(key, e.target.value)} /></label>)}
              </details>
            </>}
            {(validation || error) && <p role="alert" className="error">{validation || error}</p>}
            <button className="primary start-button" disabled={busy}>{reopen ? "Open saved project" : "Start the search"} <span aria-hidden="true">↗</span></button>
            <p className="fine-print">Review the source-backed suggestions,<br />keep unknowns open, and add more at any time.</p>
          </section>
        </form>
        <p className="input-footer">Family memories stay distinct from archival evidence.</p>
      </div>
    </main>
  );
}

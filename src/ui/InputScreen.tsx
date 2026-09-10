import { useState, type FormEvent } from "react";
import type { ProjectInput } from "./types";
import { FilePicker } from "./FilePicker";
import { PreparationState } from "./PreparationState";
export function validateInput(
  input: ProjectInput,
  fileCount: number,
): string | null {
  if (!input.seedName.trim()) return "Add your full name.";
  if (!input.geography.trim() && !input.geographyUnknown)
    return "Add a family location or choose I don't know.";
  if (!fileCount) return "Add your family files to begin.";
  return null;
}
export function InputScreen({
  onStart,
  busy,
  error,
}: {
  onStart: (input: ProjectInput, files: File[]) => void;
  busy: boolean;
  error: string | null;
}) {
  const [input, setInput] = useState<ProjectInput>({
    seedName: "",
    geography: "",
    geographyUnknown: false,
    context: "",
    preparedPacket: false,
    language: "en",
    aliases: [],
  });
  const [files, setFiles] = useState<File[]>([]);
  const [savedFiles, setSavedFiles] = useState<File[]>([]);
  const [validation, setValidation] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const issue = validateInput(input, files.length);
    setValidation(issue);
    if (!issue) {
      setOpening(false);
      onStart(input, files);
    }
  };
  const reopen = () => {
    if (!savedFiles.some((file) => /\.json$/i.test(file.name))) {
      setValidation(
        "Select the project.json from your downloaded book, with its original files.",
      );
      return;
    }
    setValidation(null);
    setOpening(true);
    onStart(
      {
        ...input,
        seedName: "Saved family project",
        geography: "",
        geographyUnknown: true,
      },
      savedFiles,
    );
  };
  return (
    <>
      {busy && (
        <PreparationState
          title={
            opening
              ? "Reopening your family story"
              : "Preparing your family story"
          }
          summary={
            opening
              ? "Opening your saved project and its original files."
              : "Sending your files and starting a saved project. Your first source checks will appear when they are ready."
          }
        />
      )}
      <main className="input-screen" hidden={busy}>
        <div className="intro">
          <span className="eyebrow">
            A little evidence. A lasting connection.
          </span>
          <h1>
            Your family story,
            <br />
            <em>coming together.</em>
          </h1>
          <p>
            Bring the photographs and records you have.
            <br />
            Keep the stories and the sources behind them.
          </p>
        </div>
        <form className="intake" onSubmit={submit} noValidate>
          <section className="intake-material">
            <span className="step-label">01 / Bring what you have</span>
            <FilePicker files={files} onChange={setFiles} disabled={busy} />
            <p className="photo-guidance">
              Name the people in each photo from left to right. Example:{" "}
              <strong>01__Alex_Morgan__Jamie_Morgan.jpg</strong>. If you are
              unsure, use Unknown. You can confirm the names after starting.
            </p>
          </section>
          <section className="intake-details">
            <span className="step-label">02 / Where should we begin?</span>
            <label className="field">
              Your full name <span aria-hidden="true">*</span>
              <input
                autoComplete="name"
                value={input.seedName}
                onChange={(e) =>
                  setInput({ ...input, seedName: e.target.value })
                }
                placeholder="Your full name"
                aria-required="true"
              />
            </label>
            <label className="field">
              Family location
              <input
                value={input.geography}
                disabled={input.geographyUnknown}
                onChange={(e) =>
                  setInput({ ...input, geography: e.target.value })
                }
                placeholder="A village, region or country"
                aria-required={!input.geographyUnknown}
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={input.geographyUnknown}
                onChange={(e) =>
                  setInput({ ...input, geographyUnknown: e.target.checked })
                }
              />
              I don't know the family location
            </label>
            {(validation || error) && (
              <p role="alert" className="error">
                {validation || error}
              </p>
            )}
            <button className="primary start-button" disabled={busy}>
              Start <span aria-hidden="true">↗</span>
            </button>
            <p className="fine-print">
              Review the evidence, keep unknowns open,
              <br />
              and add more while your story takes shape.
            </p>
          </section>
        </form>
        <details className="open-saved-project">
          <summary>Open saved project</summary>
          <p>
            Choose project.json and the originals from a previously downloaded
            book. Your reviewed work will reopen.
          </p>
          <FilePicker
            files={savedFiles}
            onChange={setSavedFiles}
            compact
            disabled={busy}
          />
          <button
            type="button"
            disabled={busy || !savedFiles.length}
            onClick={reopen}
          >
            Open project
          </button>
        </details>
        <p className="input-footer">
          Family memories stay distinct from archival evidence.
        </p>
      </main>
    </>
  );
}

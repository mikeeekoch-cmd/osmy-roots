import { RootsMark } from "./Brand";
export function PreparationState({
  title = "Preparing your family story",
  summary,
  active = true,
}: {
  title?: string;
  summary: string;
  active?: boolean;
}) {
  return (
    <section className="preparation-state" role="status" aria-live="polite">
      <div className={`preparation-mark ${active ? "active" : ""}`}>
        <RootsMark />
      </div>
      <span className="eyebrow">Osmy Roots</span>
      <h2>{title}</h2>
      <p>{summary}</p>
      {active && <span className="spinner" />}
      <small>Your evidence stays with every answer.</small>
    </section>
  );
}

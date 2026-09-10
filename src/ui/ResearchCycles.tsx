import type { CycleAction, ProjectSnapshot, ResearchJob } from "../../packages/contracts";
import { label } from "./model";
export function nextCycleAction(snapshot: ProjectSnapshot): "initial" | "deeper" | null {
  const research = snapshot.research;
  if (!research || research.intake.status !== "ready") return null;
  if (research.cycles.some(c => ["queued", "running", "paused", "failed", "cancelled"].includes(c.status))) return null;
  return research.cycles.length === 0 ? "initial" : research.cycles.length < 3 ? "deeper" : null;
}
export function ResearchCycles({snapshot, busy, available, onAction}: {snapshot: ProjectSnapshot; busy: boolean; available: boolean; onAction: (input: CycleAction) => void}) {
  const research = snapshot.research!;
  const active = research.cycles.find(c => ["queued", "running", "paused", "failed", "cancelled"].includes(c.status));
  const next = nextCycleAction(snapshot);
  const activeError = active?.error || research.jobs.find(job => job.cycleId === active?.id && job.status === "failed")?.error;
  const request = (action: CycleAction["action"]) => onAction({action, cycleId: active?.id, baseVersion: snapshot.version, requestId: crypto.randomUUID()});
  return <section className="research-cycle-controls" aria-label="Research rounds">
    <div><span className="eyebrow">{active ? `Research round ${active.ordinal}` : research.cycles.length ? `Round ${research.cycles.at(-1)!.ordinal} ${label(research.cycles.at(-1)!.status)}` : "Your sources are ready"}</span>
    <p>{activeError || (active ? active.status === "cancelled" ? "This round was cancelled. Retry resumes the same research round." : active.status === "failed" ? "This round could not finish. Retry to continue from its saved state." : active.status === "paused" ? "Research is paused. Resume this round when ready." : active.plan?.objectives[0] || "Preparing the next source checks and research plan." : next === "initial" ? "Start with the records you selected and the answers you saved." : next === "deeper" ? "Follow the remaining clues in another research round." : "Review the saved findings, questions and current family book.")}</p></div>
    <div className="cycle-actions">
      {next && <button className="primary" disabled={busy || !available} onClick={event => { if (event.detail < 2) request(next); }}>{busy ? "Starting…" : next === "initial" ? "Start research" : "Research deeper"}</button>}
      {next === "deeper" && <small>{research.cycles.length === 1 ? "First" : "Second"} deeper round</small>}
      {active && ["running", "queued"].includes(active.status) && <button disabled={busy || !available} onClick={event => { if (event.detail < 2) request("pause"); }}>Pause research</button>}
      {active?.status === "paused" && <button disabled={busy || !available} onClick={event => { if (event.detail < 2) request("resume"); }}>Resume research</button>}
      {(active?.status === "failed" || active?.status === "cancelled") && <button disabled={busy || !available} onClick={event => { if (event.detail < 2) request("retry"); }}>Retry this round</button>}
      {active && active.status !== "cancelled" && <button disabled={busy || !available} onClick={event => { if (event.detail < 2) request("cancel"); }}>Cancel this round</button>}
      {!available && <small>Research actions are unavailable in this connection.</small>}
    </div>
  </section>;
}
function Job({job, onSource}: {job: ResearchJob; onSource: (id: string) => void}) {
  return <li className={job.status}><strong>{job.objective}</strong><small>{job.tool} · {label(job.status)} · {job.origin}{job.attempt > 1 ? ` · Attempt ${job.attempt}` : ""}</small>{job.summary && <p>{job.summary}</p>}{job.error && <p className="error">{job.error}</p>}{job.query && <details><summary>Query and source scope</summary><p>{job.query}</p>{job.urls.map(url => <a key={url} href={/^https?:\/\//.test(url) ? url : undefined} target="_blank" rel="noreferrer">{url}</a>)}</details>}{job.sourceIds.map(id => <button className="text-button" key={id} onClick={() => onSource(id)}>Inspect source ↗</button>)}</li>;
}
export function CycleProgress({snapshot, busy, onSource}: {snapshot: ProjectSnapshot; busy: boolean; onSource: (id: string) => void}) {
  const research = snapshot.research!;
  const jobs = [...new Map(research.jobs.map(job => [job.id, job])).values()];
  const now = jobs.filter(j => j.status === "running"), next = jobs.filter(j => j.status === "queued");
  const totals = research.metrics?.totals;
  const latest = research.cycles.at(-1);
  const delta = research.metrics?.cycles.find(c => c.cycleId === latest?.id)?.delta;
  return <aside className="research-progress"><span className="eyebrow">Your family investigation</span><h2>Following the clues</h2>
    <section className="current-work" aria-live="polite"><h3>Now</h3>{now.length ? <ol className="activity">{now.map(j => <Job key={j.id} job={j} onSource={onSource} />)}</ol> : <p>{busy ? "Request sent. Waiting for the saved job state." : research.intake.status === "questions" ? "Your initial source checks." : latest?.status === "paused" ? "This research round is paused." : latest?.status === "failed" ? "This round needs attention. Retry to continue." : "Ready for your next action."}</p>}</section>
    {latest?.plan && <details open className="research-plan"><summary>Round {latest.ordinal} research plan</summary><ul>{latest.plan.objectives.map((objective, i) => <li key={i}>{objective}</li>)}</ul><small>{latest.plan.model} · {latest.plan.origin}</small></details>}
    <section><h3>Next</h3>{next.length ? <ol className="activity">{next.map(j => <Job key={j.id} job={j} onSource={onSource} />)}</ol> : <p className="muted">No queued tasks.</p>}</section>
    {totals ? <><div className="metrics">{([
      [totals.people, "People on map", delta?.people],
      [`${totals.sourcesProcessed} / ${totals.sourcesSelected}`, "Sources processed", delta?.sourcesProcessed],
      [totals.documentsRead, "Documents read", delta?.documentsRead],
      [`${totals.photosIndexed} / ${totals.photosReceived}`, "Photos indexed / received", delta?.photosIndexed],
      [`${totals.enhancedPhotosReady} / ${totals.oldPhotosSelected}`, "Old photos enhanced", delta?.enhancedPhotosReady],
      [totals.evidenceChecked, "Evidence checked", delta?.evidenceChecked],
      [totals.astraAnalyses, "Astra analyses", delta?.astraAnalyses],
      [totals.searchAttempts, "Search attempts", delta?.searchAttempts],
      [totals.pagesRetrieved, "Pages retrieved", delta?.pagesRetrieved],
      [totals.openQuestions, "Open questions", delta?.openQuestions],
    ] as const).map(([value, name, change]) => <div key={name}><strong>{value}</strong><span>{name}</span>{change !== undefined && <small>{change > 0 ? "+" : ""}{change} this round</small>}</div>)}</div><details><summary>Counting details · saved v{research.metrics!.asOfVersion}</summary><p>{totals.candidatePeople} candidates · {totals.reviewedPeople} reviewed people · {totals.sourcesFailed} failed sources</p><p>{totals.cachedPages} cached pages · {totals.uniqueDomains} unique domains · {totals.newFindings} new findings · {totals.reviewedAdditions} reviewed additions</p></details></> : <p className="muted">Source totals are awaiting the saved processing results.</p>}
    <h3>Completed & outcomes</h3>
    {[{id: "intake", name: "Intake preparation"}, ...research.cycles.map(c => ({id: c.id, name: `Round ${c.ordinal} · ${c.kind === "initial" ? "Initial research" : "Deeper research"}`}))].map(group => {
      const outcomes = jobs.filter(j => (group.id === "intake" ? j.stage === "intake" : j.cycleId === group.id) && !["running", "queued"].includes(j.status)).sort((a,b) => (a.completedAt || a.startedAt || "").localeCompare(b.completedAt || b.startedAt || ""));
      return outcomes.length ? <details key={group.id} open={group.id === latest?.id}><summary>{group.name} ({outcomes.length})</summary><ol className="activity">{outcomes.map(j => <Job key={j.id} job={j} onSource={onSource} />)}</ol></details> : null;
    })}
    <details className="processing-files"><summary>All source files ({snapshot.files.length})</summary>{snapshot.files.map(file => <article key={file.uploadId}><strong>{file.originalName}</strong><span className="badge">{label(file.status)}</span>{file.warnings.map((warning,i) => <p key={i}>{warning}</p>)}{file.sourceIds.map(id => <button key={id} className="text-button" onClick={() => onSource(id)}>Inspect source ↗</button>)}</article>)}</details>
  </aside>;
}

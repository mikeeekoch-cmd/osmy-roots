import { randomUUID } from "node:crypto";
import {
  type ProjectSnapshot,
  type ResearchJob,
  type ResearchCycle,
  type DemoManifestV3,
  type Source,
  SourceSchema,
  CycleActionSchema,
  BankAnswerInputSchema,
  GraphProposalReviewSchema,
} from "../../packages/contracts";
import { loadProject, updateProject, saveAsset } from "../state/store";
import { AppError, validateSpans, validateSnapshot } from "../state/validation";
import {
  digest,
  researchFingerprint,
  authoritativeMetrics,
} from "../state/research";
import { readStage, analyzeHeldOut, releaseGraph } from "./round2";
import { planResearch, analyzeResearchRecord } from "./research-astra";
import { searchLocalSources } from "../research/index.mjs";
import { dataModules } from "./data-modules";
import { readSelectedSources } from "../connectors/google";
import { event } from "../events";
const now = () => new Date().toISOString();
const tasks = new Map<string, Promise<unknown>>();
export interface ResearchDeps {
  plan?: typeof planResearch;
  analyze?: typeof analyzeResearchRecord;
  intakeAnalyze?: Parameters<typeof analyzeHeldOut>[1];
}
function proposalEvidenceType(
  s: ProjectSnapshot,
  spans: { sourceId: string }[],
) {
  const sources = spans.map((span) =>
    s.sources.find((source) => source.id === span.sourceId),
  );
  if (
    sources.some(
      (source) =>
        source &&
        (source.reconstructed || /chat|memory|recollection/.test(source.kind)),
    )
  )
    return "family_recollection" as const;
  if (
    sources.length &&
    sources.every((source) => source?.kind.includes("archive"))
  )
    return "archive_record" as const;
  return "family_document" as const;
}
function check(s: ProjectSnapshot) {
  if (!s.research || !s.run)
    throw new AppError(
      "This project uses the earlier research workflow.",
      409,
      "NOT_ROUND3",
    );
  return s.research;
}
function job(
  cycle: ResearchCycle | undefined,
  s: ProjectSnapshot,
  kind: ResearchJob["kind"],
  objective: string,
  extra: Partial<ResearchJob> = {},
): ResearchJob {
  return {
    id: `job-${randomUUID()}`,
    cycleId: cycle?.id,
    stage: cycle ? "research" : "intake",
    kind,
    tool:
      kind === "plan" || kind === "analyze"
        ? "gpt-6-astra"
        : kind === "local_search"
          ? "local-source-search"
          : kind === "crawl"
            ? "public-fetch"
            : kind,
    objective,
    status: "queued",
    attempt: 0,
    inputFingerprint: researchFingerprint(s),
    sourceIds: [],
    urls: [],
    resultIds: [],
    origin: "live",
    ...extra,
  };
}
export async function cycleAction(
  id: string,
  raw: unknown,
  deps: ResearchDeps = {},
) {
  const input = CycleActionSchema.parse(raw);
  const out = await updateProject(
    id,
    (s) => {
      const r = check(s);
      if (
        r.intake.status !== "ready" ||
        s.run!.answers.length !== 6 ||
        s.run!.modelStatus !== "completed"
      )
        throw new AppError(
          "Finish the six checks and the live recollection interpretation first.",
          409,
          "INTAKE_INCOMPLETE",
        );
      const active = r.cycles.find((c) =>
        ["queued", "running", "paused"].includes(c.status),
      );
      if (input.action === "initial" || input.action === "deeper") {
        if (active) return false;
        if (input.action === "initial" && r.cycles.length) return false;
        if (
          input.action === "deeper" &&
          (!r.cycles.length || r.cycles.at(-1)!.status !== "completed")
        )
          throw new AppError(
            "Complete the current research cycle first.",
            409,
            "CYCLE_INCOMPLETE",
          );
        if (r.cycles.length >= 3)
          throw new AppError(
            "This session includes one initial and two deeper research cycles.",
            409,
            "CYCLE_LIMIT",
          );
        if (input.baseVersion !== s.version)
          throw new AppError(
            "Refresh before starting research.",
            409,
            "STALE_VERSION",
          );
        const c: ResearchCycle = {
          id: `cycle-${randomUUID()}`,
          ordinal: r.cycles.length + 1,
          kind: input.action === "initial" ? "initial" : "deeper",
          requestId: input.requestId,
          inputFingerprint: researchFingerprint(s),
          status: "queued",
          createdAt: now(),
          jobIds: [],
        };
        const j = job(c, s, "plan", `Plan research round ${c.ordinal}`);
        r.jobs.push(j);
        c.jobIds.push(j.id);
        r.cycles.push(c);
        s.run!.phase = "growing";
      } else {
        const c = r.cycles.find((c) => c.id === input.cycleId);
        if (!c) throw new AppError("Research cycle not found.", 404);
        if (input.baseVersion !== s.version)
          throw new AppError(
            "Refresh before changing this cycle.",
            409,
            "STALE_VERSION",
          );
        if (input.action === "cancel" || input.action === "pause") {
          if (c.status === "completed") return false;
          c.status = input.action === "cancel" ? "cancelled" : "paused";
          for (const j of r.jobs.filter(
            (j) =>
              j.cycleId === c.id && ["queued", "running"].includes(j.status),
          )) {
            j.status = input.action === "cancel" ? "cancelled" : "paused";
            delete j.leaseToken;
            delete j.leaseUntil;
          }
          s.run!.phase = "review";
        } else if (input.action === "retry" || input.action === "resume") {
          if (!["failed", "paused", "cancelled"].includes(c.status))
            return false;
          if (
            r.cycles.some(
              (x) =>
                x.id !== c.id &&
                ["queued", "running", "paused"].includes(x.status),
            )
          )
            throw new AppError("Another cycle is active.", 409);
          c.status = "queued";
          delete c.error;
          delete c.completedAt;
          for (const j of r.jobs.filter(
            (j) =>
              j.cycleId === c.id &&
              ["failed", "blocked", "paused", "cancelled"].includes(j.status),
          )) {
            j.status = "queued";
            j.inputFingerprint = researchFingerprint(s);
            delete j.error;
            delete j.leaseUntil;
            delete j.leaseToken;
          }
          s.run!.phase = "growing";
        }
      }
      s.history.push({
        eventId: input.requestId,
        at: now(),
        actor: "local-user",
        action: `research:${input.action}`,
        before: null,
        after: { cycleId: r.cycles.at(-1)?.id },
        sourceIds: [],
        claimIds: [],
        projectVersion: s.version + 1,
      });
    },
    { isReplay: (s) => s.history.some((h) => h.eventId === input.requestId) },
  );
  kickResearch(id, deps);
  return out;
}
export function kickResearch(id: string, deps: ResearchDeps = {}) {
  if (tasks.has(id)) return;
  const task = executeResearch(id, deps)
    .catch(() => undefined)
    .finally(() => tasks.delete(id));
  tasks.set(id, task);
}
export async function pumpResearch(id: string, deps: ResearchDeps = {}) {
  const s = await loadProject(id);
  if (!s.research) return s;
  kickResearch(id, deps);
  return {
    ...s,
    research: { ...s.research, metrics: authoritativeMetrics(s) },
  };
}
export async function waitForResearch(id: string) {
  await tasks.get(id);
  return loadProject(id);
}
async function prepareIntake(id: string, deps: ResearchDeps) {
  let s = await loadProject(id);
  const r = check(s);
  if (s.run!.modelStatus === "pending" || s.run!.modelStatus === "running") {
    let jid: string | undefined, lease: string | undefined;
    await updateProject(id, (p) => {
      const r = check(p);
      let j = r.jobs.find((j) => j.stage === "intake" && j.kind === "analyze");
      if (
        j?.status === "running" &&
        Date.parse(j.leaseUntil || "") > Date.now()
      )
        return false;
      if (!j) {
        j = job(
          undefined,
          p,
          "analyze",
          "Interpret the supplied family recollection",
        );
        r.jobs.push(j);
        r.intake.jobIds.push(j.id);
      }
      jid = j.id;
      lease = randomUUID();
      j.status = "running";
      j.attempt++;
      j.startedAt = now();
      j.leaseUntil = new Date(Date.now() + 100000).toISOString();
      j.leaseToken = lease;
    });
    if (jid) {
      await analyzeHeldOut(id, deps.intakeAnalyze || {});
      s = await updateProject(id, (p) => {
        const r = check(p),
          j = r.jobs.find((j) => j.id === jid)!;
        if (j.leaseToken !== lease) return false;
        j.status = p.run!.modelStatus === "completed" ? "completed" : "failed";
        j.completedAt = now();
        delete j.leaseUntil;
        delete j.leaseToken;
        j.summary =
          j.status === "completed"
            ? "Saved the exact-source recollection interpretation."
            : "Recollection analysis needs a retry.";
        if (p.run!.analysis) {
          j.resultIds = [p.run!.analysis.id];
          for (const span of p.run!.analysis.spans) {
            const source = p.sources.find((x) => x.id === span.sourceId)!;
            const key = digest([
              source.evidenceRootIds || source.contentHash,
              span.quote,
            ]);
            if (!r.validationOutcomes.some((v) => v.key === key && v.method === "astra"))
              r.validationOutcomes.push({
                key,
                sourceId: source.id,
                method: "astra",
                outcome: "supported",
                at: now(),
              });
          }
        }
      });
    }
  }
  s = await loadProject(id);
  if (
    s.run!.answers.length === 6 &&
    s.run!.modelStatus === "completed" &&
    s.research!.intake.status !== "ready"
  )
    await updateProject(id, (p) => {
      p.research!.intake.status = "ready";
      p.research!.intake.completedAt = now();
      p.run!.phase = "review";
    });
}
export async function executeResearch(id: string, deps: ResearchDeps = {}) {
  await prepareIntake(id, deps);
  for (let n = 0; n < 24; n++) {
    let claimed: ResearchJob | undefined,
      base: ProjectSnapshot | undefined,
      cycle: ResearchCycle | undefined;
    await updateProject(id, (s) => {
      const r = check(s);
      const c = r.cycles.find(
        (c) => c.status === "queued" || c.status === "running",
      );
      if (!c) return false;
      const j = r.jobs.find(
        (j) =>
          j.cycleId === c.id &&
          (j.status === "queued" ||
            (j.status === "running" &&
              Date.parse(j.leaseUntil || "") < Date.now())),
      );
      if (!j) {
        const own = r.jobs.filter((j) => j.cycleId === c.id);
        if (own.some((j) => j.status === "running")) return false;
        c.status = own.some((j) => j.status === "failed")
          ? "failed"
          : "completed";
        c.completedAt = now();
        s.run!.phase = "review";
        return;
      }
      c.status = "running";
      c.startedAt ||= now();
      j.status = "running";
      j.attempt++;
      j.startedAt = now();
      j.leaseUntil = new Date(Date.now() + 70000).toISOString();
      j.leaseToken = randomUUID();
      j.inputFingerprint = researchFingerprint(s);
      claimed = structuredClone(j);
      base = structuredClone(s);
      cycle = structuredClone(c);
    });
    if (!claimed || !base || !cycle) return;
    const j: ResearchJob = claimed,
      s: ProjectSnapshot = base,
      c: ResearchCycle = cycle;
    try {
      const stage = await readStage(id),
        manifest = stage.manifest as DemoManifestV3;
      let result: Partial<ResearchJob> = {},
        apply: (p: ProjectSnapshot) => void = () => {};
      if (j.kind === "plan") {
        const scope = manifest.researchSources.filter(
            (x) => x.cycleOrdinal === c.ordinal,
          ),
          eligible = [...new Set(scope.flatMap((x) => x.sourceIds))].filter(
            (id) => s.sources.some((x) => x.id === id && x.originalText),
          );
        const sourceIds = eligible.length
          ? eligible
          : s.sources
              .filter(
                (x) =>
                  x.originalText &&
                  x.kind !== "stored_file" &&
                  !x.kind.includes("photo"),
              )
              .map((x) => x.id);
        const plan = await (deps.plan || planResearch)(s, c, sourceIds);
        result = {
          status: "completed",
          resultIds: [plan.id],
          summary: plan.objectives.join(" "),
        };
        apply = (p) => {
          const r = p.research!,
            saved = r.cycles.find((x) => x.id === c.id)!;
          saved.plan = plan;
          const queries = plan.queries.filter((q) => q.kind === "local_search");
          if (!queries.length)
            queries.push({
              kind: "local_search",
              query: scope[0]?.query || p.input.seedName,
              sourceIds,
            });
          for (const query of queries.slice(0, 2)) {
            const next = job(
              saved,
              p,
              "local_search",
              `Search supplied records: ${query.query}`,
              {
                query: query.query,
                sourceIds: query.sourceIds.length ? query.sourceIds : sourceIds,
              },
            );
            r.jobs.push(next);
            saved.jobIds.push(next.id);
          }
          for (const target of scope
            .filter((x) => x.kind === "public" && x.url)
            .slice(0, 2)) {
            const next = job(
              saved,
              p,
              "crawl",
              "Read the selected public record",
              { urls: [target.url!], query: target.query },
            );
            r.jobs.push(next);
            saved.jobIds.push(next.id);
          }
          if (
            p.input.publicRecordUrl &&
            !scope.some((x) => x.url === p.input.publicRecordUrl)
          ) {
            const next = job(
              saved,
              p,
              "crawl",
              "Read your supplied public record",
              { urls: [p.input.publicRecordUrl] },
            );
            r.jobs.push(next);
            saved.jobIds.push(next.id);
          }
        };
      } else if (j.kind === "local_search") {
        const sources = s.sources.filter((x) => j.sourceIds.includes(x.id));
        const found = await searchLocalSources({
          query: j.query || s.input.seedName,
          sources,
          limit: 4,
        });
        result = {
          status: found.hits.length ? "completed" : "no_match",
          resultIds: found.hits.map((h: any) => h.sourceId),
          summary: found.hits.length
            ? `Found ${found.hits.length} matching source passages.`
            : "No matching passages in the selected source scope.",
        };
        apply = (p) => {
          const r = p.research!,
            saved = r.cycles.find((x) => x.id === c.id)!;
          if (c.ordinal === 1 && !p.run!.initialSavedAt) {
            releaseGraph(p, stage, manifest.initialBranchIds);
            p.run!.initialSavedAt = now();
            event(p, {
              runId: id,
              operation: "normalize_entity",
              origin: "prepared",
              state: "completed",
              finding:
                "Added the supplied starting family branch after explicit research start.",
            });
          }
          const hitIds = new Set(found.hits.map((h: any) => h.sourceId));
          const imported = manifest.researchSources
            .filter(
              (scope) =>
                scope.cycleOrdinal === c.ordinal &&
                scope.kind === "local" &&
                scope.sourceIds.some((id) => hitIds.has(id)),
            )
            .flatMap((scope) => scope.personIds)
            .filter(
              (id) =>
                !p.people.some((person) => person.id === id) &&
                stage.graph.claims.some(
                  (claim) =>
                    claim.subjectId === id &&
                    claim.spans.some((span) => hitIds.has(span.sourceId)),
                ),
            );
          if (imported.length) {
            releaseGraph(p, stage, [...new Set(imported)]);
            result.resultIds = [...(result.resultIds || []), ...imported];
            result.summary = `Retrieved matching supplied records and imported ${new Set(imported).size} additional people from those records.`;
            event(p, {
              runId: id,
              operation: "normalize_entity",
              origin: "prepared",
              state: "completed",
              finding: result.summary,
            });
          }
          for (const sourceId of [
            ...new Set(found.hits.map((h: any) => h.sourceId)),
          ].slice(0, 2) as string[]) {
            if (
              r.jobs.some(
                (x) =>
                  x.cycleId === c.id &&
                  x.kind === "analyze" &&
                  x.sourceIds.includes(sourceId),
              )
            )
              continue;
            const next = job(
              saved,
              p,
              "analyze",
              "Analyze a retrieved family record",
              { sourceIds: [sourceId] },
            );
            r.jobs.push(next);
            saved.jobIds.push(next.id);
          }
        };
      } else if (j.kind === "crawl") {
        const out = await dataModules.fetchPublicRecord({ url: j.urls[0] });
        const source = out.source;
        result = {
          status:
            out.status === "ok" && source
              ? "completed"
              : out.status === "blocked"
                ? "blocked"
                : "no_match",
          summary: source
            ? "Retrieved the selected public page."
            : out.error || "Public source is unavailable.",
          origin: source?.origin === "cached" ? "cached" : "live",
          urls: source ? [source.url || out.finalUrl || j.urls[0]] : [],
          resultIds: source ? [source.id] : [],
        };
        apply = (p) => {
          if (!source) return;
          const existing = p.sources.find(
            (x) => x.contentHash === source.contentHash,
          );
          if (!existing) p.sources.push(SourceSchema.parse(source));
          const next = job(
            c,
            p,
            "analyze",
            "Analyze the retrieved public record",
            { sourceIds: [existing?.id || source.id] },
          );
          p.research!.jobs.push(next);
          p.research!.cycles.find((x) => x.id === c.id)!.jobIds.push(next.id);
        };
      } else if (j.kind === "analyze") {
        const source = s.sources.find((x) => x.id === j.sourceIds[0]);
        if (!source) throw new AppError("Analysis source no longer exists.");
        const out = await (deps.analyze || analyzeResearchRecord)(s, c, source);
        validateSpans(out.proposal.support, s);
        result = {
          status: "completed",
          resultIds: [out.proposal.id],
          summary: out.proposal.summary,
        };
        apply = (p) => {
          const r = p.research!,
            existing = r.graphProposals.find(
              (x) => x.deduplicationKey === out.proposal.deduplicationKey,
            );
          if (!existing) {
            r.graphProposals.push(out.proposal);
            r.questionBank.push({
              id: `question-${randomUUID()}`,
              cycleId: c.id,
              subject: out.proposal.summary,
              prompt: out.question || "What can you confirm about this source?",
              uncertainty: out.uncertainty,
              support: out.proposal.support,
              personIds: out.personIds,
              candidatePersonIds: out.candidatePersonIds,
              proposalId: out.proposal.id,
              priority: r.questionBank.some((x) => x.cycleId === c.id)
                ? "later"
                : "immediate",
              status: "open",
              answers: [],
              createdAt: now(),
            });
          } else result.resultIds = [existing.id];
          for (const span of out.proposal.support) {
            const key = digest([out.proposal.evidenceRootIds, span.quote]);
            if (!r.validationOutcomes.some((v) => v.key === key && v.method === "astra"))
              r.validationOutcomes.push({
                key,
                sourceId: span.sourceId,
                cycleId: c.id,
                method: "astra",
                outcome: "supported",
                at: now(),
              });
          }
        };
      } else
        result = {
          status: "blocked",
          summary: "The requested retrieval adapter is not available.",
        };
      await updateProject(
        id,
        (p) => {
          const r = check(p),
            current = r.jobs.find((x) => x.id === j.id)!;
          if (
            current.leaseToken !== j.leaseToken ||
            current.status !== "running"
          )
            return false;
          if (researchFingerprint(p) !== j.inputFingerprint)
            throw new AppError(
              "Reviewed evidence changed during this job. Retry against the current version.",
              409,
              "STALE_JOB",
            );
          apply(p);
          Object.assign(current, result, { completedAt: now() });
          delete current.leaseToken;
          delete current.leaseUntil;
          if (result.status === "completed" && j.kind !== "plan") {
            const cycle = r.cycles.find((x) => x.id === c.id)!;
            cycle.firstResultAt ||= now();
          }
        },
        { invalidateBook: j.kind !== "plan" },
      );
    } catch (error) {
      await updateProject(id, (p) => {
        const r = check(p),
          current = r.jobs.find((x) => x.id === j.id)!;
        if (current.leaseToken !== j.leaseToken) return false;
        current.status = "failed";
        current.completedAt = now();
        current.error =
          error instanceof AppError
            ? error.message
            : "The research operation failed. Retry remains available.";
        delete current.leaseToken;
        delete current.leaseUntil;
      });
    }
  }
}
export async function answerBankQuestion(id: string, raw: unknown) {
  const input = BankAnswerInputSchema.parse(raw);
  if (input.action === "correct" && !input.text?.trim())
    throw new AppError("Enter the correction.");
  return updateProject(
    id,
    (s) => {
      const r = check(s),
        q = r.questionBank.find((q) => q.id === input.questionId);
      if (!q) throw new AppError("Question not found.", 404);
      q.answers.push({ ...input, savedAt: now() });
      q.status = input.action === "skip" ? "skipped" : "answered";
      const dependentId = `bank-claim-${q.id}`;
      const previous = s.claims.find((c) => c.id === dependentId);
      if (previous) previous.status = "superseded";
      const subject = q.personIds.find((id) =>
        s.people.some((p) => p.id === id),
      );
      if (subject && ["confirm", "correct"].includes(input.action)) {
        const value = input.action === "correct" ? input.text! : q.subject;
        const sourceId = `answer-${input.requestId}`,
          locator = `Human answer ${input.requestId}`;
        if (!s.sources.some((x) => x.id === sourceId))
          s.sources.push({
            id: sourceId,
            kind: "human_edit",
            originalLocator: locator,
            originalText: value,
            contentHash: digest(value),
            origin: "live",
            author: "Local user",
            messageTimestamp: now(),
            parentAttachmentId: null,
          });
        const claim = {
          id: dependentId,
          subjectId: subject,
          predicate: "reviewed_research_answer",
          value,
          sourceIds: [
            ...new Set([...q.support.map((x) => x.sourceId), sourceId]),
          ],
          spans: [...q.support, { sourceId, locator, quote: value }],
          status: "accepted" as const,
          evidenceType: "user_correction" as const,
          version: (previous?.version || 0) + 1,
        };
        s.claims = s.claims.filter((c) => c.id !== dependentId);
        s.claims.push(claim);
        const person = s.people.find((p) => p.id === subject)!;
        if (!person.claimIds.includes(dependentId))
          person.claimIds.push(dependentId);
      }
      if (input.action === "unknown")
        q.uncertainty = "The user could not resolve this question.";
      if (input.action === "correct") {
        const sourceId = `answer-${input.requestId}`,
          text = input.text!;
        if (!s.sources.some((x) => x.id === sourceId))
          s.sources.push({
            id: sourceId,
            kind: "human_edit",
            originalLocator: `Human answer ${input.requestId}`,
            originalText: text,
            contentHash: digest(text),
            origin: "live",
            author: "Local user",
            messageTimestamp: now(),
            parentAttachmentId: null,
          });
        const proposal = r.graphProposals.find((p) => p.id === q.proposalId);
        if (proposal) proposal.status = "superseded";
      }
      s.history.push({
        eventId: input.requestId,
        at: now(),
        actor: "local-user",
        action: `question:${input.action}`,
        before: null,
        after: input,
        sourceIds: q.support.map((x) => x.sourceId),
        claimIds: [],
        projectVersion: s.version + 1,
      });
    },
    {
      baseVersion: input.baseVersion,
      invalidateBook: true,
      isReplay: (s) => s.history.some((h) => h.eventId === input.requestId),
    },
  );
}
export async function reviewGraphProposal(id: string, raw: unknown) {
  const input = GraphProposalReviewSchema.parse(raw);
  return updateProject(
    id,
    (s) => {
      const r = check(s),
        p = r.graphProposals.find((p) => p.id === input.proposalId);
      if (!p) throw new AppError("Graph change not found.", 404);
      if (!["pending", "unknown"].includes(p.status))
        throw new AppError("This graph change was already reviewed.", 409);
      validateSpans(p.support, s);
      if (input.action === "accept") {
        for (const person of p.people) {
          if (s.people.some((x) => x.id === person.id))
            throw new AppError("A proposed identity already exists.", 409);
          validateSpans(person.support, s);
          const cid = `name-${person.id}`;
          s.claims.push({
            id: cid,
            subjectId: person.id,
            predicate: "documented_identity",
            value: person.displayNameEn,
            sourceIds: [...new Set(person.support.map((x) => x.sourceId))],
            spans: person.support,
            status: "accepted",
            evidenceType: proposalEvidenceType(s, person.support),
            version: 1,
          });
          s.people.push({
            id: person.id,
            displayNameEn: person.displayNameEn,
            originalName: person.originalName,
            lifeYears: { birth: person.birth, death: person.death },
            claimIds: [cid],
            storyIds: [],
            photoIds: [],
            recordStatus: "reviewed",
            importedSourceRefs: person.support.map((x) => x.sourceId),
          });
        }
        for (const rel of p.relationships) {
          validateSpans(rel.support, s);
          if (
            s.relationships.some(
              (x) =>
                x.fromPersonId === rel.fromPersonId &&
                x.toPersonId === rel.toPersonId &&
                x.type === rel.type &&
                x.status !== "rejected",
            )
          )
            continue;
          const cid = `evidence-${rel.id}`;
          s.claims.push({
            id: cid,
            subjectId: rel.fromPersonId,
            predicate: `relationship_${rel.type}`,
            value: JSON.stringify({
              from: rel.fromPersonId,
              to: rel.toPersonId,
            }),
            sourceIds: [...new Set(rel.support.map((x) => x.sourceId))],
            spans: rel.support,
            status: "accepted",
            evidenceType: proposalEvidenceType(s, rel.support),
            version: 1,
          });
          s.relationships.push({
            id: rel.id,
            fromPersonId: rel.fromPersonId,
            toPersonId: rel.toPersonId,
            type: rel.type,
            claimIds: [cid],
            status: "accepted",
          });
        }
        p.status = "accepted";
        validateSnapshot(s);
      } else p.status = input.action === "reject" ? "rejected" : "unknown";
      p.reviewRequestId = input.requestId;
      s.history.push({
        eventId: input.requestId,
        at: now(),
        actor: "local-user",
        action: `graph-proposal:${input.action}`,
        before: { status: "pending" },
        after: { proposalId: p.id, status: p.status },
        sourceIds: p.support.map((x) => x.sourceId),
        claimIds: [],
        projectVersion: s.version + 1,
      });
    },
    {
      baseVersion: input.baseVersion,
      invalidateBook: true,
      isReplay: (s) => s.history.some((h) => h.eventId === input.requestId),
    },
  );
}
export async function importProviderSources(
  id: string,
  provider: string,
  ids: string[],
  baseVersion: number,
) {
  const before = await loadProject(id);
  if (before.version !== baseVersion)
    throw new AppError(
      "Refresh before importing sources.",
      409,
      "STALE_VERSION",
    );
  const files = await readSelectedSources(provider, ids);
  const result = await dataModules.ingestContribution({ files });
  for (const bytes of result.assetBytes)
    await saveAsset(id, bytes.assetId, bytes.bytes);
  return updateProject(
    id,
    (s) => {
      for (const source of result.sources)
        if (!s.sources.some((x) => x.id === source.id)) s.sources.push(source);
      for (const asset of result.assets)
        if (!s.assets.some((x) => x.id === asset.id)) s.assets.push(asset);
      for (const file of result.files)
        if (!s.files.some((x) => x.uploadId === file.uploadId))
          s.files.push(file);
      const r = check(s),
        j = job(
          undefined,
          s,
          provider === "gmail" ? "gmail_read" : "drive_read",
          "Import explicitly selected Google sources",
          {
            status: "completed",
            attempt: 1,
            startedAt: now(),
            completedAt: now(),
            sourceIds: result.sources.map((x) => x.id),
            resultIds: result.sources.map((x) => x.id),
            summary: `Read ${files.length} selected Google files.`,
          },
        );
      r.jobs.push(j);
      r.intake.jobIds.push(j.id);
    },
    { baseVersion, invalidateBook: true },
  );
}

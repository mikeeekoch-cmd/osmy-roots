# Runtime contract handoff

Contract checkpoint: e838039, branch codex/engineering. Fetch that branch. The default-branch push was blocked by environment approval review, so main does not yet contain this scaffold.

Shared T0: 16:27:53 UTC; P0 integration 17:22:53; freeze 17:37:53; deadline 17:57:53 on 2026-09-10.

Import types from packages/contracts/index.ts (alias @/contracts). Synthetic development snapshot/proposal: packages/contracts/fixtures.ts. This fixture is never a live AI response.

Natalia: export RootsApp({api}:{api:RootsApi}) from src/ui/index.tsx. All methods return complete snapshots. Poll getSnapshot while operations run; events have origin/state/sequence. Files are browser File[] on RootsApi, normalized InputFile[] only inside server modules. Keep pending proposal details separate from accepted stories.

Claude: export importPreparedFamily and ingestContribution from server/ingestion/index.ts; searchLocalSources and fetchPublicRecord from server/research/index.ts; buildFamilyBundle from server/export/index.ts. The signatures are in DataModules. Return assetBytes separately from metadata. No raw bytes, URL or absolute local path belongs in project JSON. Request additive types/dependencies through your status.

Routes chosen by the lead: POST /api/projects; GET /api/projects/:id; POST /api/projects/:id/contributions; POST /api/projects/:id/review; POST /api/projects/:id/graph; POST /api/projects/:id/download; GET /api/projects/:id/assets/:assetId. Create/contribution use multipart FormData with JSON input and repeated files fields; review/graph use JSON. Return {error,code} on failure, 409 for stale versions. The lead's adapter hides routes from UI.

Dependencies pinned: Next 16.3.4, React 19.2.8, Zod 4.5.4, OpenAI 7.13.0; TypeScript/tsx. pnpm dev binds 127.0.0.1:3000. Server-only OPENAI_API_KEY and OPENAI_MODEL=gpt-6-astra go in ignored .env.local. No Supabase required.

Private Scope Review, including Engineering handoff, refreshed at its 16:24:37 UTC version. It agrees with repository P0 ownership and two-screen scope. Existing family story evidence is provenance enrichment, not a promised new ancestor. Private identifiers and URLs remain outside this handoff.

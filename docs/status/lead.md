# Codex Mike status

- Shared T0: 2026-09-10 16:27:53 UTC / 12:27:53 EDT.
- Contracts due T+10: 16:37:53 UTC / 12:37:53 EDT.
- Integrated P0 due T+55: 17:22:53 UTC / 13:22:53 EDT.
- Feature freeze T+70: 17:37:53 UTC / 13:37:53 EDT.
- Shared deadline T+90: 17:57:53 UTC / 13:57:53 EDT. No worker resets this clock.
- Branch: codex/engineering. Base: 4d1c86a (latest main at fetch).
- Contracts: packages/contracts/index.ts; worker module signatures and RootsApi included. Schema version roots-v1.
- Dependency choices: Next.js, React, Zod, official OpenAI SDK; pure async worker functions with Uint8Array bytes. Lead pins versions in lockfile.
- Run: pnpm install; copy .env.example to .env.local and configure server key; pnpm dev.
- Working: contract/scaffold implementation underway; no end-to-end pass claimed yet.
- Blocked: no application OPENAI_API_KEY in environment at kickoff; requested local configuration from Mike. Private scope refresh pending.
- Worker handoff: Natalia exports RootsApp from src/ui/index.tsx; Claude exports modules from server/ingestion/index.ts, server/research/index.ts and server/export/index.ts. Please consume published types without editing them; request additive changes here.
- Scope: local single-user storage; text/JSON/photos first; prepared/synthetic sources always labeled. OAuth, cloud, universal chat imports, broad crawling, restoration and standalone editable HTML map deferred.
- P1 gate: CLOSED until integrated P0 has passed; fix integration first.

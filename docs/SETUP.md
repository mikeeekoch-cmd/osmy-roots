# Local prototype setup

Use Node.js 24 or 25, pnpm 11 and Git. Each contributor has a separate checkout. The shared handoff branch is codex/engineering; see docs/status/lead.md for the exact tested checkpoint.

```sh
git clone https://github.com/mikeeekoch-cmd/osmy-roots.git
cd osmy-roots
git switch codex/engineering
pnpm install --frozen-lockfile
cp .env.example .env.local
# Set OPENAI_API_KEY locally. Never paste it into chat or commit the file.
pnpm dev
```

Open http://127.0.0.1:3000. The process binds to loopback. Stop it with Ctrl+C. Start the same checkout again to reopen saved projects.

The server uses OPENAI_MODEL=gpt-6-astra and the official Responses SDK. API Platform credit is required; Codex/ChatGPT balance is separate. An absent key, exhausted API credit or model failure produces a visible failed operation while original sources remain saved. No canned proposal substitutes for a failed live request.

ROOTS_DATA_DIR defaults to the ignored .roots-data directory. Project JSON uses atomic writes and serialized transactions; assets are private files resolved by project/asset ID. Do not put private family inputs or output books anywhere tracked by Git. This prototype is single-user local software. Cloud, OAuth, database accounts and deployment are deferred.

```sh
pnpm typecheck
pnpm test
pnpm build
# Opt-in real API calls using the public synthetic example:
pnpm test:live
```

pnpm test uses explicit test adapters for orchestration tests. It does not prove a live model response. pnpm test:live requires the connected ingestion/export modules and makes actual billed model calls, then checks ZIP integrity and editable-JSON reimport. See lead status for checks actually completed.

The prepared-example checkbox loads a fictional five-generation family with a placeholder portrait and a birth-year discrepancy. To use a private family, upload its tree/project JSON and matching original media. Normalized legacy assertions cite the supplied tree, with warnings when original primary references are absent. Native chat ZIP/audio/video remain stored-only unless a tested parser is explicitly listed.

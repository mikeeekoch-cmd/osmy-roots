<p align="center"><img src="assets/roots-mark.svg" alt="Osmy Roots" width="120" /></p>
<h1 align="center">Osmy Roots</h1>

Roots is a local family-history prototype. Add a source, inspect Astra's interpretation and exact quotation, review the proposed change, and download the current illustrated book with an editable project and original evidence.

Built for the OpenAI GPT-6 Astra NYC Hackathon, September 10, 2026. The integrated local route has passed two real model-to-book runs. See [readiness](docs/READINESS.md) and [lead status](docs/status/lead.md) for measured checks and the tested commit.

## Run locally

```sh
git clone https://github.com/mikeeekoch-cmd/osmy-roots.git
cd osmy-roots
git switch codex/engineering
pnpm install --frozen-lockfile
cp .env.example .env.local
# Configure OPENAI_API_KEY locally, with funded API Platform credit.
pnpm dev
```

Open http://127.0.0.1:3000. Use Node.js 24 or 25 and pnpm 11. The server binds to loopback; credentials, saved projects and originals stay in ignored local files. Full instructions: [setup](docs/SETUP.md).

## What works

The input form opens a research workspace with progress, a family map and a human contribution panel. Text and JSON are parsed; photos and unsupported formats retain their original bytes and honest processing status. Local search uses the supplied sources. A bounded, allowlisted public-fetch adapter returns actual retrieval results or explicit failures.

The official OpenAI Responses SDK runs gpt-6-astra on a new source. Proposals carry validated person IDs and exact source quotations. Accept, correct, reject and unknown persist with history. Manual person/relationship edits and one-level undo preserve evidence; stale writes, self-parent links and ancestry cycles are rejected. A memory remains a memory after acceptance.

Download generates current cited prose and packages a four-page illustrated English PDF, readable HTML, complete editable JSON, sources, notes and every saved original. Reopening with original files works in a separate local store. The app never substitutes a fixed PDF or a canned answer for a failed live call.

## Demo and boundaries

Follow the [2-3 minute demo](docs/DEMO.md). The built-in example is a fictional five-generation family with a placeholder portrait and conflicting birth years. It proves the software route, not a real archive discovery. Private family records can be imported locally and are excluded from this public repository.

Cloud deployment, authentication, OAuth, native Telegram/WhatsApp parsing, DOCX/PDF extraction, OCR, restoration, broad crawling and a standalone editable HTML map are deferred. The HTML book is read-only; project.json is the editable record. There is no demonstrated ancestor match from external retrieval.

## Checks and ownership

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm test:live # Makes real billed API calls using fictional evidence.
```

The regular suite includes explicit model fixtures; live checks run separately. The stack is Next.js, React, TypeScript, Zod, the official OpenAI SDK, local atomic JSON storage, native SVG/CSS and Claude's dependency-free PDF/ZIP modules.

Codex Mike owns Astra, state, contracts and integration. Codex Natalia owns UI and animations. Claude Code Mike owns ingestion, retrieval and export. [Build log](docs/BUILD-LOG.md), [shared contracts](docs/PROTOTYPE-CONTRACT.md), [scope priorities](docs/SCOPE-PRIORITIES.md) and [execution plan](docs/EXECUTION.md) preserve the implementation record.

Code and original repository documentation use the [MIT license](LICENSE). This does not grant rights to third-party records or uploaded family material.

## Next demo improvement round

The [round-2 owner prompts](docs/round-2/README.md) specify the next seven-question, English-only, progressively growing three-minute demo. They are an implementation handoff; the new journey is not yet included in the verified behavior above.

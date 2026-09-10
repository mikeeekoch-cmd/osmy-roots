<p align="center"><img src="assets/roots-mark.svg" alt="Osmy Roots" width="120" /></p>
<h1 align="center">Osmy Roots</h1>
<p align="center"><strong>Bring what you have. Discover the connections. Keep the stories.</strong></p>
<p align="center">Turn scattered family photos, memories and records into an evidence-backed family tree and a family book.</p>

Prepared for the OpenAI GPT-6 Astra NYC Hackathon, September 10, 2026.

**Status: 90-minute engineering sprint authorized.** This repository contains documentation, a license, an environment template and a development readiness command. The application and deployment were not implemented at the preparation checkpoint. Follow [the current 90-minute plan](docs/EXECUTION.md) and owner statuses for actual progress. Planned behavior below is the product target.

## Why Roots

A family history rarely arrives as a complete tree. It arrives as a photograph with a name on the back, a relative's voice message, two conflicting dates and a story someone remembers. Roots connects those fragments while keeping the evidence and the storyteller visible.

## The experience we are building

1. **Input.** Add a starting name, family geography (or “unknown”), and files, context or a prepared packet. Click Start the search.
2. **Research workspace.** Follow real progress on the left, inspect and edit the family map in the center, and answer questions or add new clues on the right. Photos, stories, citations and history stay with each person and relationship.
3. **Download from the workspace.** One action saves an illustrated PDF and HTML book, editable map, structured project, sources, notes and original media.

There are only two screens. Research planning runs internally. Astra proposes interpretations; human review commits supported changes. Corrections flag affected relationships and book passages.
Memories, documentary evidence and uncertain interpretations remain distinct. Roots does not promise to discover an ancestor from every photo.

## Planned stack

| Component | Choice |
| --- | --- |
| Web and server | Next.js App Router, React, TypeScript, Node.js 24 |
| Styling and tree | Tailwind CSS, React Flow, elkjs |
| AI | Official OpenAI SDK, Responses API, `gpt-6-astra` |
| Data and files | Supabase Postgres, Auth and private Storage |
| Contracts | Zod and shared TypeScript types |
| Sources | User-selected material and bounded archive retrieval |
| Export | Illustrated PDF/HTML plus editable map, JSON, sources and originals in one ZIP |
| Validation | Vitest for consequential logic, Playwright for the core journey |
| Deployment target | Node web service; Render proposed, account unverified |

The 90-minute sprint uses local persistence unless cloud infrastructure already works. Supabase/Auth, broad retrieval and deployment are optional. The lead checks the existing stack at the first milestone.

## Get ready locally

Install Git, Node.js 24, pnpm 11 and GitHub CLI. Then:

```sh
git clone https://github.com/mikeeekoch-cmd/osmy-roots.git
cd osmy-roots
cp .env.example .env.local
# Set required values locally. Never commit .env.local.
pnpm run doctor
```

`doctor` reports missing tools and environment values without revealing secrets. `pnpm run doctor:api` additionally checks model metadata with a configured key; it does not prove inference or billing. There is **no `pnpm dev` command yet**. See [setup](docs/SETUP.md).

## Engineering map

| Document | Purpose |
| --- | --- |
| [Product](docs/PRODUCT.md) | User journey, MVP and acceptance criteria |
| [Architecture](docs/ARCHITECTURE.md) | Evidence model, run state and corrections |
| [V3 contract](docs/CONTRACT-V3.json) | Shared data, review, progress and export envelopes |
| [Execution](docs/EXECUTION.md) | Current 90-minute plan, three owners and scope cuts |
| [Launch prompts](docs/prompts/) | Codex Mike, Codex Natalia and Claude Code Mike |
| [Setup](docs/SETUP.md) | Local environment and deployment verification |
| [Readiness](docs/READINESS.md) | Verified capabilities and remaining dependencies |
| [Demo](docs/DEMO.md) | Demo script and submission preparation |
| [ArtLens lessons](docs/ARTLENS-REFERENCE.md) | Reference patterns and changes for Roots |
| [Build log](docs/BUILD-LOG.md) | Preparation versus implemented event work |
| [Agent instructions](AGENTS.md) | Shared context and collaboration rules |

## Demo and contributions

A working app URL, one-minute video and verified results will be added when available. This project does not claim an award or completed functionality. Pre-existing family research is private reference material and is not included here. Only explicitly cleared demo assets may be published.

Code and original repository documentation are licensed under [MIT](LICENSE). This does not grant rights to third-party records or uploaded family material.

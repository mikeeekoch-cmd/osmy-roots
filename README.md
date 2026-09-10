<p align="center"><img src="assets/roots-mark.svg" alt="Osmy Roots" width="120" /></p>
<h1 align="center">Osmy Roots</h1>
<p align="center"><strong>Bring what you have. Discover the connections. Keep the stories.</strong></p>
<p align="center">Turn scattered family photos, memories and records into an evidence-backed family tree and a family book.</p>

Prepared for the OpenAI GPT-6 Astra NYC Hackathon, September 10, 2026.

**Status: engineering preparation.** This repository contains documentation, a license, an environment template and a development readiness command. The application and deployment are not implemented yet. Planned behavior below is the build target.

## Why Roots

A family history rarely arrives as a complete tree. It arrives as a photograph with a name on the back, a relative's voice message, two conflicting dates and a story someone remembers. Roots connects those fragments while keeping the evidence and the storyteller visible.

## The experience we are building

```text
Photos + names + messages + memories
                  ↓
       Proposed family map + stories
                  ↓
        Review, clarify and investigate
                  ↓
      Supported connections + family chapter
                  ↓
        Correct a clue → review affected output
```

1. **Bring what you have.** Upload a small batch of images/text and paste a memory. A questionnaire is optional.
2. **See your family take shape.** Astra extracts people, dates, possible relationships and attributed stories, each linked to its original source.
3. **Follow a useful clue.** Compare archive candidates, inspect contradictions and answer a focused question when needed.
4. **Review the connection.** Accept or reject a proposal. Similar names stay separate until supported.
5. **Keep the story.** Build an editable illustrated chapter with citations. Correcting a clue flags affected relationships and passages for review.

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
| Export | Print-styled chapter and structured JSON |
| Validation | Vitest for consequential logic, Playwright for the core journey |
| Deployment target | Node web service; Render proposed, account unverified |

These choices must be checked at the first build milestone. No database or hosting service is provisioned by this repository.

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
| [Execution](docs/EXECUTION.md) | First milestone, ownership and coding prompts |
| [Setup](docs/SETUP.md) | Local environment and deployment verification |
| [Readiness](docs/READINESS.md) | Verified capabilities and remaining dependencies |
| [Demo](docs/DEMO.md) | Demo script and submission preparation |
| [ArtLens lessons](docs/ARTLENS-REFERENCE.md) | Reference patterns and changes for Roots |
| [Build log](docs/BUILD-LOG.md) | Preparation versus implemented event work |
| [Agent instructions](AGENTS.md) | Shared context and collaboration rules |

## Demo and contributions

A working app URL, one-minute video and verified results will be added when available. This project does not claim an award or completed functionality. Pre-existing family research is private reference material and is not included here. Only explicitly cleared demo assets may be published.

Code and original repository documentation are licensed under [MIT](LICENSE). This does not grant rights to third-party records or uploaded family material.

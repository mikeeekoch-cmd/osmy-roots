# Round 2: prepare the presenter demo

The implementation specification is [DEMO-READY-SCOPE.md](DEMO-READY-SCOPE.md). It records all intake, questions, staging, language, artifact, ownership and release requirements from Mike's latest feedback. These files are prompts for execution, not a report that the changes are already built.

Start the lead prompt first, then start Natalia and Claude immediately. They can work independently on UI and private artifact preparation while the lead publishes the shared contracts. All three fetch origin/codex/engineering, including code baseline 556953f. Do not start from the older main alone.

| Owner            | Full executable prompt                                                      |
| ---------------- | --------------------------------------------------------------------------- |
| Codex Mike       | [04_CODEX_MIKE_DEMO_READY.md](../prompts/04_CODEX_MIKE_DEMO_READY.md)       |
| Codex Natalia    | [05_CODEX_NATALIA_DEMO_READY.md](../prompts/05_CODEX_NATALIA_DEMO_READY.md) |
| Claude Code Mike | [06_CLAUDE_MIKE_DEMO_READY.md](../prompts/06_CLAUDE_MIKE_DEMO_READY.md)     |

Baseline was rechecked while preparing this handoff: typecheck PASS, 74 tests PASS, production build PASS with two existing local-store tracing warnings. Existing P0 and partial P1 are ready as documented in READINESS.md. The new seven-question, staged English file-pack journey still needs implementation and its own acceptance pass.

The demo's three-minute target runs from Mike pressing Start through successful book download. It does not start when the app opens, files are chosen, or prompts are published. No global Demo mode banner is required; ordinary source provenance remains available, and connected/live-search claims require real operations.

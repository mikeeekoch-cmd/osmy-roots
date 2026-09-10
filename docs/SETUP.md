# Setup and access

## This repository now

Node.js 24, pnpm 11, Git and GitHub CLI are needed for development. The initial package has no application dependencies or web server. `pnpm run doctor` is ready to run without installing dependencies; a nonzero exit means prerequisites are missing.

```sh
gh auth status
git clone https://github.com/mikeeekoch-cmd/osmy-roots.git
cd osmy-roots
cp .env.example .env.local
pnpm run doctor
```

Populate `.env.local` locally. Never place keys in chat, issues, README or shared Drive packages.

| Variable | Purpose |
| --- | --- |
| OPENAI_API_KEY | Project API access and billing; server only |
| OPENAI_MODEL | `gpt-6-astra` |
| NEXT_PUBLIC_SUPABASE_URL | Chosen Supabase project URL |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Browser/user-scoped client with RLS; not a privileged key |
| SUPABASE_SECRET_KEY | Only if privileged server operations require it; bypasses user protections unless carefully scoped |
| APP_URL | Actual local or deployed origin |
| OSMY_CONTEXT_FOLDER_URL | Private developer context location |

The OpenAI account used by a coding tool does not automatically provide an application API key. `pnpm run doctor:api` checks model metadata only. The first build must separately exercise a tiny Responses request and record its actual outcome. Verify event credits in the correct API project.

For Supabase, create/select the project, apply the repository migrations after they exist, configure Auth and a private bucket, and verify owner-scoped writes and reads. A successful login to the dashboard is not a database test. [API keys](https://supabase.com/docs/guides/api/api-keys), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## First application implementation

Scaffold Next.js without overwriting repository docs or resetting Git. Add compatible pinned dependencies for React, Tailwind, Zod, OpenAI, Supabase, React Flow and elkjs. Add real `dev`, `build`, `start`, `typecheck` and test commands, then verify them before documenting them as working. The proposed structure is in ARCHITECTURE.md.

## Deployment

Proposed target: Render Node web service connected to this repository. Configure build/start commands only after they work locally. Keep durable files/data in Supabase. Configure environment values directly in the hosting service and verify the actual deployed workflow and commit. No hosting account, service or paid plan has been created by this preparation.

Free Render services sleep when idle and have an ephemeral filesystem; validate startup before the demo. [Render free-service limits](https://render.com/docs/free). An existing suitable hosting account may be used instead after the integration owner agrees.

## Second laptop

Authenticate its CLI independently, clone this exact repository, read the latest private handoff and use an assigned `codex/` branch. Do not copy this laptop's credentials, `.tools`, `node_modules` or absolute paths. Fetch remote changes before work; inspect a dirty worktree before pulling. Do not force-reset local changes.

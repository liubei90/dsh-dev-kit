# Agent Note: Bootstrap the runtime stack for the first feature

Status: proposed

## Problem

apps/api and apps/web are placeholders: api exports a createServer stub that only prints a line, web exports a mountApp stub that writes one string into the DOM. No HTTP framework, database, or UI framework exists anywhere in the repository, so the planned user-account feature ([feature proposal](../feature/2026-09-02-user-accounts-and-login.md)) cannot start until this repo adopts a runtime stack. Framework, persistence, and frontend choices set package topology, build wiring, dev workflow, and contract placement for every later feature, so they are architecture decisions made once and recorded.

## Proposal

apps/api becomes a Fastify application: src/index.ts stays the entry, and a server factory composes feature route modules and plugins; route files stay thin and push logic into service and repository layers per the root AGENTS.md conventions (控制器薄、服务层承载业务).

Persistence is SQLite through better-sqlite3 behind a repository layer: raw parameterized SQL only (never string concatenation), all table access confined to apps/api repositories so a later switch to PostgreSQL stays contained; the connection reads DATABASE_PATH from the environment and defaults to a gitignored local file apps/api/data/dev.sqlite, and tests use an in-memory database.

Schema changes ship as ordered SQL migration files in apps/api/migrations (NNNN_name.sql) applied by a small runner that records applied files in a schema_migrations table; the runner runs at API startup and via a pnpm migrate script, and the tracking table keeps both idempotent.

apps/web becomes a Vite + React application in place: the package keeps its @devkit/web name, and its src layout gains a Vite entry (index.html, src/main.tsx, JSX components); its tsconfig compiles JSX against DOM libs under the repository's strict flags; its dev script switches from tsx watch to vite; web imports contract types from @devkit/shared through the package exports exactly as api does.

The shared contract stays in packages/shared: the ApiEnvelope type already there grows into the shared auth DTO types and validation helpers this feature needs, still dependency-free pure TypeScript.

Configuration is environment-driven: every tunable (database path, JWT secret, TTL) comes from env vars documented in .env.example, none hardcoded, per the root AGENTS.md rule 无硬编码可调参数.

Root orchestration keeps its shape: tsc -b builds and typechecks all three packages, vitest include patterns already cover apps and packages, and lefthook plus CI need only lockfile changes, not structural ones.

## Alternatives considered

- **Express instead of Fastify** — rejected: Fastify's schema validation, plugin model, and TS-typed request/response fit the contract-first conventions (shared DTOs, ApiEnvelope) better, and its ecosystem includes the JWT plugin the feature uses.
- **An ORM (Drizzle or Prisma) instead of raw SQL** — rejected for now: two tables do not justify the dependency and generation surface; repositories centralize SQL so an ORM stays a contained later decision if the data model grows.
- **Node's built-in node:sqlite instead of better-sqlite3** — rejected: the engine floor is Node 20.19 where node:sqlite is experimental and flag-gated; better-sqlite3 ships prebuilt binaries and a synchronous API that keeps repositories simple.
- **Vue or a framework-less web app instead of React** — rejected: React is the chosen product direction and the repository's component and i18n skills (vercel-react-best-practices, vercel-composition-patterns, web-design-guidelines) target it.
- **PostgreSQL instead of SQLite** — rejected for this stage: SQLite keeps local and CI runs zero-configuration against a real database, satisfying the layered testing standard; migrations and repositories stay portable so Postgres becomes an environment change, not a rewrite.
- **No runtime stack decision yet** — rejected: the user-account feature and every feature after it blocks on it; deferring only moves the same decision into a larger diff.

## Acceptance criteria

pnpm install on a clean checkout succeeds and pnpm run typecheck, pnpm run test, pnpm run lint, and pnpm run doc-sync pass with the new stack. api boots a real Fastify server whose route modules and repository layer are wired, and a migration file applies through the runner leaving its schema_migrations record. web serves a Vite app whose tsconfig passes the repository typecheck with DOM and JSX support. No tunable is hardcoded outside env-driven configuration, and .env.example lists every key the feature reads.

## Risks

better-sqlite3 is a native dependency: an environment without a prebuilt binary for its Node version must compile it, which can fail on CI images; pinning the version and verifying install on the CI Node 22 image covers this before merge.

Adding Vite changes how web resolves @devkit/shared (package exports under a bundler); the shared package keeps a static exports map, and the typecheck gate runs web through tsc -b to catch resolution drift.

React and Vite add a large dependency and tooling surface to apps that were dependency-free; the mitigation is the repository's React skills and keeping components thin with logic in typed modules.

The stack is chosen before the product shape is known; repositories, route modules, and the shared contract keep the seams small enough that framework-level regrets stay local to one app. The [feature proposal](../feature/2026-09-02-user-accounts-and-login.md) that motivated this choice carries the user-visible behavior and its own risks.

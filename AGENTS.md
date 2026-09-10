# AGENTS.md

Instructions for coding agents working in this repository.

## Commands

```bash
npm run dev              # dev server, Turbopack, port 3000 (service worker disabled)
npm run build             # prod build (webpack) — required if the change touches the service worker
npm start                 # serve the prod build on :3000
npm run typecheck         # tsc --noEmit
npm run lint               # eslint
npm run lint:strict        # eslint --max-warnings=13
npm run format:check       # prettier --check
npm run validate           # format:check + lint:strict + typecheck + test, in parallel — run before considering work done
npm run test               # vitest (watch mode)
npx vitest run <path>      # run a single unit test file
npx vitest run <path> -t "<name>"  # run a single test by name
npm run e2e                 # playwright (automatically starts dev server if not running)
npx playwright test <path>  # run a single e2e spec
npm run dead-code           # knip — unused exports/files
npm run unused-deps          # depcheck
npm run ast-grep             # ast-grep scan — repo-specific structural lint rules (.ast-grep/rules), advisory
```

Playwright automatically manages the dev server via the `webServer` block in `playwright.config.ts`.

The service worker (Serwist) is **disabled** under `npm run dev` (Turbopack skips the Serwist wrapper entirely). To reproduce SW/offline/PWA behavior you must `npm run build && npm start`. See [`.claude/skills/verify/SKILL.md`](.claude/skills/verify/SKILL.md) for driving the app end-to-end, including how to seed guest mode for Playwright without racing the auth guard.

`npm run prepare` (runs on `npm install` via husky) also copies `sql-wasm.wasm` into `public/` — required for the uhabits `.db` import feature (parsed client-side via `sql.js`).

## Architecture

Kagelin (codename Kanso) is a Next.js 16 App Router monolith backed by Supabase (Postgres + Auth + Realtime), designed local-first with cloud sync layered on top.

**Two directories split routing from logic:**

- `app/` — routes, layouts, API routes only. Should stay thin: compose components from `src/components/`, don't embed business logic.
- `src/components/` — presentation, grouped by product domain (`habits/`, `tasks/`, `calendar/`, `stats/`, …), plus `ui/` (Shadcn/Radix primitives, kebab-case files) and `providers/` (app-wide context).
- `src/lib/` — everything else: `hooks/` (React Query data-access hooks — components should not call `supabase.from(...)` directly), `mutations/` (optimistic-update mutation hooks), `store/` (Zustand — `timerStore.ts`, `uiStore.ts`), `sync/`, `caldav/`, `calendar-oauth/`, `webdav/`, `import/` (uhabits), `schemas/` (Zod), `types/`.
- `supabase/schema.sql` is the source of truth for the DB. Every table enforces `user_id = auth.uid()` via RLS — access control is a Postgres concern, not a middleware one.

**State is split by nature, not by feature**: server-owned data (tasks, habits, events) lives in TanStack Query with IndexedDB persistence; ephemeral/local UI and the focus timer live in Zustand. The timer specifically reconciles against server time (`serverClock.ts`) rather than trusting device clocks, so it survives tab suspension and cross-device handoff.

**Three user tiers gate what "sync" means** — this vocabulary is load-bearing, see [`CONTEXT.md`](CONTEXT.md) before touching anything sync-related:

- **Guest**: local-only (`localStorage`/IndexedDB), no `auth.uid()`. CalDAV only (client-held credentials); no Google/Outlook OAuth (requires server-anchored identity).
- **Registered (free)**: cloud-persisted, on-demand calendar sync (browser talks directly to Google/MS APIs using the user's own OAuth quota — keeps this tier free to run).
- **Premium (paid)**: adds realtime cross-device mirroring over Supabase Realtime and background/scheduled server-side sync.

## Where to look for more

- [`CONTEXT.md`](CONTEXT.md) — canonical domain glossary (Habit vs Entry, Streak vs Score, Goal vs Frequency, Series/Occurrence, Stats vs Insights, calendar sync terms). Read before naming anything in these domains; conflicting terminology must be resolved, not shrugged off.
- [`docs/adr/`](docs/adr/) — architecture decisions with the rejected alternatives and consequences (client-side calendar token handling, the server-anchored timer model, habit color overrides, frequency-aware streak computation). Check here before "fixing" something that looks like a bug but was a deliberate tradeoff.
- [`README.md`](README.md) — product feature list and shortcuts, useful for understanding user-facing scope.

## Conventions

- Path alias `@/*` → `./src/*` and `./*`.
- Prettier: 2-space indent, double quotes, semicolons, trailing commas everywhere. Enforced pre-commit via husky + lint-staged.
- Unused vars/params: prefix with `_` (linter ignores `^_`).
- A catch block that only does `console.*` is a lint error — rethrow, surface to the UI, or report to Sentry instead of swallowing it silently.
- React Compiler is on (`eslint-plugin-react-compiler` set to error) — manual `useMemo`/`useCallback` should generally be unnecessary; a compiler bailout is a smell worth checking rather than papering over.
- **Code Search Constraint**: for _structural_ searches on source files (`.ts`, `.tsx`, `.js`, `.jsx`) — a call pattern, a JSX shape, a catch block, a hook's argument list — use `ast-grep` via `Bash` (`npx ast-grep run -p '<pattern>' -l ts <path>`), not grep; it matches by AST so formatting and string contents that look like code don't fool it. Plain grep/rg is fine for simple lexical lookups (where is `addEvent` called, does this file import `X`) and for non-code files (`.md`, `.json`, `.env`). `npm run ast-grep` runs the repo's custom `.ast-grep/rules/` lint rules (advisory only, not yet part of `validate`); see [`.scratch/tooling/ast-grep-usage-research.md`](.scratch/tooling/ast-grep-usage-research.md) for pattern syntax and more advanced usage.

## Agent skills

### Issue tracker

Issues and specs live as markdown files under `.scratch/<feature-slug>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical role names used as-is (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at repo root, with supplementary docs in `.scratch/codebase/`. See `docs/agents/domain.md`.

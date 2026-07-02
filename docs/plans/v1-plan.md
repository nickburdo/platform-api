# Version 1 — Implementation Plan

> Status: **Approved** (2026-07-01)
>
> Source of truth for scope: `../roadmap.md`
> Supporting documents: `../architecture.md`, `../models.md`, `../api.md`, `../development.md`, `../deployment.md`, `../decisions.md`
>
> This document breaks Version 1 down into concrete, sequenced engineering tasks. It does not introduce any new scope beyond what is already documented — it only makes the roadmap actionable.

---

# Goal

Ship a deployable REST API, without authentication, covering:

- Job Tracker (full CRUD + metadata)
- Health Monitor (Glucose, Blood Pressure, Weight, Symptoms, Dashboard)
- Demo data support (`isDemo`)
- Seed data
- Validation
- Deployment to Cloudflare

Out of scope for V1 (deferred to later versions per roadmap):

- Authentication / authorization (V2)
- Google login, OpenAPI/Swagger, monitoring (V3)

---

# Decisions

Resolved during planning discussion (2026-07-01):

1. **ID generation** — plain UUID. The route handler generates it (`const id = crypto.randomUUID()`) and passes it into the service/repository alongside the create payload — repositories never generate IDs themselves.
2. **Table / column naming convention** — `snake_case` for actual SQL columns (`created_at`, `measured_at`, `remote_type`, ...). Drizzle schema definitions keep `camelCase` JS property names (matching `models.md`/API field names) mapped explicitly to `snake_case` DB column names.
3. **Wrangler config format** — `wrangler.jsonc`.
4. **Search implementation for Job Tracker** — plain SQL `LIKE '%term%'` across `company`, `position`, `source`, `notes`. No FTS5 in V1 (that stays a documented Future Extension).
5. **Currency field** — free-text string, defaults to `"USD"` when not provided on create.
6. **`remoteType` field** — enum: `REMOTE` | `HYBRID` | `OFFICE`. `models.md` and `api.md` need to be updated to reflect this (currently documented as a bare string) — tracked in the Documentation Updates section below.
7. **Error `details` shape** — for validation errors, `details` mirrors Zod's flattened field-error map, as originally proposed.
8. **CORS** — enabled with no origin restriction (`Access-Control-Allow-Origin: *`). Safe here because auth (from V2 onward) uses `Authorization: Bearer <token>`, not cookies, so cross-origin credential/CSRF concerns don't apply. CORS is a browser-only mechanism — Postman/CLI/mobile clients are unaffected either way.
9. **Rate limiting / abuse protection for writes** — deferred to V2+, once roles exist and abuse can be scoped to guest accounts. No throttling infrastructure in V1, consistent with "simplicity first."
10. **Default `isDemo` value for records created via the API in V1** — `true`. Since V1 has no authentication, every API-created record (and every seeded record) is treated as demo data. `isDemo` only starts distinguishing real vs. demo data once V2 introduces roles and admin accounts.
11. **Two separate databases** — `job-tracker-db` (one table: `job_applications`) and `health-monitor-db` (four tables: `glucose_measurements`, `blood_pressure_measurements`, `weight_measurements`, `symptom_entries`). Each database gets its own folder with its own Drizzle schema, DB client, and migrations directory. The two domains never share a database, a schema file, or a migration history.
12. **Cloud-only D1, no local database** — all `wrangler d1` operations (migrations, seed, ad-hoc queries) run against the cloud database using **`--remote`**. Note: Wrangler has no `--global` flag — the two options are `--local` (a local SQLite emulation file) and `--remote` (the actual Cloudflare-hosted D1 instance). Since local DBs are explicitly out, every command in this plan uses `--remote`, and `wrangler dev` also runs against the remote D1 bindings (`wrangler dev --remote`) rather than a local emulation, so development always exercises the real cloud database.
13. **Seed via `seed.sql`, not a TS script** — each database folder contains a `seed.sql` fixture file (not the `scripts/seed.ts` + `tsx` approach generically suggested in `development.md`). Seeding principle: for every table in that database, first `DELETE FROM <table> WHERE is_demo = 1`, then `INSERT` the fixture demo rows. This makes seeding idempotent/repeatable without touching any non-demo data that might exist in the same tables. Executed via `wrangler d1 execute <db-name> --remote --file=<path-to-seed.sql>`.
14. **Worker name** — `platform-api` (matches repo/project name).
15. **Compatibility date** — `2026-07-01` (project start date).
16. **ESLint config format** — flat config (`eslint.config.js`, ESLint 9+), not legacy `.eslintrc.json`. Note: the repo was fully reset before this plan's execution started, so there is no pre-existing `.eslintrc`/`.prettierrc`/`package.json`/`tsconfig.json` to "verify" as Section 1 originally assumed — all of it is created fresh.
17. **Seed sequencing** — Seed Data moves to run right after Section 2 (Database Schema), instead of after Routes/Middleware. Seeding has no actual dependency on the application code layers (Validation, Repositories, Services, Routes, Middleware) — `seed.sql` is applied directly via `wrangler d1 execute --file=...` and only requires that the tables already exist. Running it immediately after migrations lets the database carry realistic demo data through the rest of implementation, so manual testing against real-looking data is possible from Section 4 onward instead of waiting until the end.
18. **Seed data source: real Prisma fixtures** — the user provided real reference data from a previous Postgres/Prisma implementation of the same product, under `docs/seed/job-tracker/` (`schema.prisma`, `seed.ts`) and `docs/seed/health-monitor/` (`schema.prisma`, `seed.mjs`). These are used as the actual content for `seed.sql` in Section 3, adapted as follows:
    - IDs: the Prisma source has none checked in (Prisma generates `cuid()` at insert time) — fixed, hardcoded UUIDs are generated and written directly into `seed.sql` (per Decision #13).
    - Column naming: mapped to our `snake_case` convention (Decision #2); the Prisma field `ignore` becomes our `ignored` (same boolean semantics, renamed for API consistency with `api.md`).
    - `updated_at`: not present in the Prisma source (it only tracks `createdAt`) — seeded rows set `updated_at = created_at`.
    - `SymptomEntry` in the Prisma source has no `ignore`/`reason` fields at all — seeded rows default to `ignored = 0, reason = ''`, since our schema (Decision below, Section 2.2) requires these columns on every Health Monitor table regardless.
    - `remoteType`: source uses free-text `'Remote'` / `'Hybrid'` / `'On-site'` — mapped to our enum (Decision #6) as `REMOTE` / `HYBRID` / `OFFICE` respectively.
    - Relationships: none exist in the source schemas, so nothing to drop.
19. **Glucose model changes shape: `fastingValue`/`afterMealValue` instead of a single `value`** — the real Prisma source tracks glucose readings as two separate nullable fields (`fastingValue`, `afterMealValue`), with **exactly one of the two ever populated per record**, never both, never neither. This is more clinically meaningful than a single undifferentiated `value` and reflects actual usage, so the V1 data model changes to match, **before** any migration has been generated (Section 2 hasn't run yet, so this costs nothing to change now):
    - `glucose_measurements` gets `fasting_value` (nullable number) and `after_meal_value` (nullable number) instead of `value`
    - New cross-field validation rule: exactly one of `fastingValue`/`afterMealValue` must be present on create (both present or both absent is a `400`); whichever is present must be `> 0`
    - `models.md` and `api.md` need updating to reflect this (tracked in Documentation Updates)
20. **Seed dates are relative to run time, not fixed** — `seed.sql` computes `measured_at`/`happened_at`/`applied_at`/`next_follow_up_at`/`created_at`/`updated_at` using SQLite's `strftime('%Y-%m-%dT%H:%M:%f', 'now', '±N days') || 'Z'` instead of hardcoded ISO strings baked in at authoring time. This matches the original Prisma seed scripts' behavior (they compute `daysAgo()`/`daysFromNow()` at run time) and keeps demo data looking current every time it's reseeded, rather than drifting further into the past as real time passes. Only `id` is fixed/hardcoded (Decision #13) — dates are intentionally not.
21. **`date_from`/`date_to` query format and boundary** — accept **only** `YYYY-MM-DD` (matches every example in `api.md`; no full ISO-8601 datetime accepted in the query string, validated via a strict regex in Zod). `date_to` is inclusive of the entire day: the repository/service layer (Section 5) widens it to end-of-day (`< date_to + 1 day`, or equivalently `<= date_to 23:59:59.999`) before comparing against `measured_at`/`happened_at`, rather than treating it as an exact midnight instant. This widening happens outside Zod (which only validates the string format) — flagged here so Section 5 implements it consistently for all four Health Monitor resources and the dashboard.
22. **Automated unit tests adopted, starting now** — supersedes `development.md`'s "Version 1 relies primarily on manual API testing." User decision: add `vitest`, starting with the Zod schemas already built in Section 4 (retroactively) and extending to Services/Repositories as they're built in Sections 5–6. Postman/manual testing (Section 9) remains in place *in addition to*, not instead of, automated tests — Section 9 and the Definition of Done are updated to require both. Test files are co-located next to their source (`*.schema.test.ts` beside `*.schema.ts`), not a parallel `tests/` tree — simplest option, standard Vitest convention. Repositories touch real D1 bindings directly; whether that needs `@cloudflare/vitest-pool-workers` or manual mocking is deferred until Section 5 is actually implemented, since no repository code exists yet to decide against.
23. **Repository tests use `@cloudflare/vitest-pool-workers`** — repositories run tests inside a real `workerd` runtime against an ephemeral, Miniflare-backed D1 instance (not a hand-rolled `D1Database` mock). Migrations from `src/db/job-tracker/migrations` and `src/db/health-monitor/migrations` are applied to their respective ephemeral test databases before each test file runs. This is orthogonal to Decision #12 (cloud-only, no local dev database) — that decision is about the actual development/deployment workflow, not disposable per-test-run fixtures that never persist and are never used outside `vitest`.
    - Installed version (`0.17.0`) uses a Vite-plugin API (`cloudflareTest()` from the package root), **not** the older `defineWorkersConfig` from a `/config` subpath documented in older Cloudflare examples — that subpath doesn't exist in this version.
    - Two separate Vitest configs: `vitest.config.ts` (plain Node environment, schema/util tests, `*.test.ts` excluding `*.repo.test.ts`) and `vitest.workers.config.ts` (Workers pool, `*.repo.test.ts` only). `npm test` runs both (`test:unit` then `test:repo`); repository test files must end in `.repo.test.ts` to land in the right project.
    - Migrations are read from disk at config-build time via `readD1Migrations()` and injected as JSON bindings (`TEST_JOB_TRACKER_MIGRATIONS`, `TEST_HEALTH_MONITOR_MIGRATIONS`); `src/db/test-setup.ts` (a Vitest `setupFiles` entry) applies them to the two D1 bindings via `applyD1Migrations()` from `cloudflare:test` before each test file runs.
    - **Storage isolation is per test *file*, not per individual `it()`** — confirmed empirically (rows created in one test were still visible in a later test in the same file, inflating counts). Every repository test file needs its own `beforeEach` that clears the relevant table(s) before each test; don't rely on the pool resetting state between `it()` blocks.
    - Typing `env` from `cloudflare:test` requires the project's own generated `worker-configuration.d.ts` (`npm run cf-typegen` → `wrangler types`), not just `@cloudflare/workers-types` — the latter provides ambient global types (`D1Database`, etc.) but not a project-specific `Env` interface with our actual binding names. `worker-configuration.d.ts` is generated, gitignored, and excluded from ESLint/Prettier, matching how `src/db/*/migrations` and `docs/` are already treated. Wrangler's own CLI output suggests migrating off `@cloudflare/workers-types` entirely in favor of generated runtime types — **not done here**, out of scope for Section 5, revisit separately if desired.
24. **Repositories live under `src/db/<domain>/`, not a top-level `src/repositories/`** — a high-effort code review (2026-07-01) caught that Section 5's repository files were silently placed inside `src/db/job-tracker/` and `src/db/health-monitor/`, contradicting Section 1's original approved scaffold (which showed a separate top-level `repositories/` folder) with no plan revision recorded at the time — a violation of `CLAUDE.md`'s "no deviation without revision" rule. Resolved by accepting the as-built location and correcting Section 1's scaffold retroactively (rather than moving 12 files), since repositories are colocated with the `client.ts`/`schema.ts` they use and import paths are already shorter this way. `src/repositories/.gitkeep` is removed as dead scaffolding.
25. **Code review fixes (2026-07-01)** — a high-effort review after Section 5 found and fixed, in order of severity:
    - `updateJobApplicationSchema`: `.partial()` didn't strip `.default()` from `status`/`currency`, so a PATCH omitting them silently reset them to `SAVED`/`USD`. Fixed by moving the defaults out of the shared base shape and applying them only in `createJobApplicationSchema` via `.extend()`.
    - `updateGlucoseMeasurement`: a partial update setting only `fastingValue` (or only `afterMealValue`) could leave a row with both populated if the other was already set from a prior write, violating Decision #19. Fixed by having the repository null out the untouched value field whenever the other one is patched.
    - `blood-pressure.schema.ts`: `systolic`/`diastolic` had no lower bound, so negative/zero values passed as long as `systolic > diastolic` held. Fixed by adding `.positive()` to both, matching every sibling numeric field in the codebase.
    - `job-applications.repository.ts`: the `search` term was interpolated unescaped into a SQL `LIKE` pattern, so a literal `_`/`%` in a search term acted as a SQL wildcard (confirmed live: searching `"co_op"` also matched `"coXop"`). Fixed by escaping `\`, `%`, `_` in the term and adding an explicit `ESCAPE '\'` clause via a raw `sql` template (`drizzle-orm`'s `like()` helper has no escape-clause support).
    - `common.schema.ts`: the `date_from`/`date_to` regex only checked digit-grouping shape, so calendar-invalid dates (month 13, Feb 30, Feb 29 on a non-leap year) passed validation and silently produced wrong query bounds instead of a `400`. Fixed by adding a round-trip-through-`Date` refine.
    - Deduplicated the four near-identical Health Monitor `buildFilters` functions into one shared helper (`src/utils/repository-filters.ts`), and the two identical job-applications/blood-pressure cross-field `{ check, options }` refine rules into one shared `common.schema.ts` helper (glucose's rule stayed separate — its shape is genuinely different, per the review's own verification).
    - `getJobApplicationsMeta(db, isDemo?: boolean)` took `isDemo` as a bare positional argument while every other list function takes it as a `params` object field — changed to `getJobApplicationsMeta(db, params?: { isDemo?: boolean })` for consistency.
26. **`reason` is required (non-empty) whenever `ignored: true`** — `api.md`'s ignore/unignore examples always pair `ignored: true` with a real `reason` and `ignored: false` with `reason: ""`, but nothing enforced this relationship. User decision when starting Section 6: make it required. Added as a shared `reasonRequiredWhenIgnoredRule` in `common.schema.ts`, applied to all four Health Monitor update schemas (glucose, blood-pressure, weight, symptom). No constraint on `reason` when `ignored` is false/absent — restoring with `reason: ""` remains the client's choice, not something this rule enforces.
27. **`dashboard.service.ts` delegates to `dashboard.repository.ts` directly, not the four sibling services** — the plan originally described the dashboard service as "aggregating the four Health Monitor services," but in V1 those services add no read-time transformation over their repositories (no `isDemo` scoping happens on reads yet, per Decision #10) — composing through them would be a redundant extra layer with byte-identical behavior to calling the already-built, already-tested `dashboard.repository.ts` composition directly. Revisit if a future version's services start adding real read-time logic (e.g. V2 auth-based scoping), at which point the dashboard service should switch to composing the sibling services so that logic isn't bypassed.
28. **Code review fixes (2026-07-01, second pass, after Section 6)** — a second high-effort review found and fixed 9 issues, in order of severity:
    - **Reverted `optionalFieldOrderRule`** (introduced in Decision #25's cleanup) back to three explicit, un-abstracted `{ check, options }` rules in `job-applications.schema.ts`/`blood-pressure.schema.ts`. The generic's `getA`/`getB` getter-function signature type-checked identically no matter which field was passed as "A" vs "B" — live-reproduced by swapping `salaryRangeRule`'s getters and confirming `tsc` raised no error, silently inverting the rule's direction. The original consolidation this reverts was itself a Decision #25 cleanup fix — a case of a DRY-motivated refactor introducing a subtler type-safety gap than the duplication it removed. Explicit inline field access is the fix, not a smarter generic.
    - **Moved the Glucose "exactly one of fastingValue/afterMealValue" invariant (Decision #19) from `glucose.repository.ts` to `glucose.service.ts`** — it's business logic per `development.md` ("Repositories should not contain business rules"), and the Service layer added in Section 6 is where it belongs. The repository is a plain passthrough again, matching the other three Health Monitor repositories.
    - **Added a defensive runtime check for Decision #26** (`reason` required when `ignored: true`) inside all four Health Monitor services, via a new shared `assertReasonRequiredWhenIgnored()` in `src/services/health-monitor-shared.ts`. Previously the invariant was Zod-only with no Route layer yet built to guarantee Zod always runs first — a direct service call could silently persist an ignored record with no reason. The service now throws regardless of caller.
    - **Deduplicated the "stamp isDemo/ignored/reason/timestamps on create, bump updatedAt on update" logic**, copy-pasted across all four Health Monitor services, into shared `withCreateStamps()`/`withUpdateStamp()` helpers in the same new `src/services/health-monitor-shared.ts`.
    - **Added `isDemo` support to `getJobApplicationsMeta` and `dashboard.service.ts`**, the two remaining places that couldn't scope by `isDemo` even though every other list/meta function in the codebase already could — for `dashboard.service.ts`, `isDemo` is a service-level parameter alongside (not inside) `dateRangeQuerySchema`, since it's never client-supplied.
    - **Deduplicated repo/service test setup boilerplate** (`let db; beforeEach(() => { db = createXDb(...); await db.delete(table) })`, repeated identically across all 12 `.repo.test.ts`/`.service.test.ts` files) into `freshJobTrackerDb()`/`freshHealthMonitorDb(...tables)` in new `src/db/job-tracker/test-helpers.ts` / `src/db/health-monitor/test-helpers.ts`.
    - **Widened a flaky-prone test's timing margin** from 5ms to 50ms (`job-applications.service.test.ts`'s `updatedAt` test) — services have no injectable clock, so the test relies on real wall-clock time passing between two `new Date().toISOString()` calls; 5ms was too tight a margin against JS `Date` resolution and scheduler jitter.
    - **Fixed a `Column` type import** in `job-applications.repository.ts` (imported as a value, used only as a type) to match the `type Column` style already used in the sibling `repository-filters.ts` — cosmetic today (no `verbatimModuleSyntax`/lint rule catches it), but a latent inconsistency introduced in the same original diff.
    - Also removed a leftover untracked scratch file (`src/db/job-tracker/probe.repo.test.ts`) accidentally left behind by a prior review's live-verification step.
29. **Sections 7 + 8 are planned and implemented as one block** (user decision, 2026-07-02) — Section 7.5's cross-cutting concerns (consistent envelope, 400/404/500 handling) are unimplementable without Section 8's error middleware, so both sections share this plan revision (Decisions #29–#36) and land together.
30. **DB clients are injected by a global middleware into typed `c.var`** — `src/middleware/db.ts` instantiates both Drizzle clients once per request (`createJobTrackerDb(c.env.JOB_TRACKER_DB)`, `createHealthMonitorDb(c.env.HEALTH_MONITOR_DB)`) and stores them in Hono Variables (`c.var.jobTrackerDb`, `c.var.healthMonitorDb`). The combined `AppEnv = { Bindings; Variables }` type lives in `app.ts`. Route handlers never touch `c.env` directly — one place to evolve for V2 auth-scoped access.
31. **Request validation via `@hono/zod-validator`** (new runtime dependency; installed version must support Zod 4 — peer `^3.25 || ^4`). One shared hook reuses the existing `zodErrorToResponse()` (Decision #7 shape), so every failed validation returns the documented 400 body; handlers read typed input via `c.req.valid('json' | 'query' | 'param')`. Two implementation notes surfaced while wiring this: (a) in Zod 4 the hook receives the core `$ZodError` (no `.flatten()` method), so `zodErrorToResponse()` now takes `$ZodError` and flattens via the top-level `z.flattenError()`; (b) root-level issues — `.strict()`'s unrecognized-keys error and object-wide refines like the empty-PATCH rule — have no field to attach to in Decision #7's field-error map, so they surface in `details` under `_errors` (the same root key Zod itself uses in its tree format).
32. **Body schemas are `.strict()`** — all create/update (JSON body) schemas reject any unknown key with a 400, covering server-managed fields (`id`, `createdAt`, `updatedAt`, `isDemo`, plus `ignored`/`reason` on Health Monitor create) and field-name typos alike. Resolves Section 7.2's open "reject vs strip" question as **reject with 400**. Query schemas deliberately stay non-strict — unknown query params are ignored, per common URL semantics.
33. **Empty `PATCH {}` returns 400** — all five update schemas get an "at least one field present" refine; a no-op patch that would only bump `updatedAt` is treated as a client error, not silently accepted.
34. **Error handling uses Hono's `app.onError` + `app.notFound`**, not a hand-rolled try/catch middleware: `SyntaxError` from JSON body parsing → 400 `Invalid JSON body`; anything else → `console.error` with method/path/error and a generic 500 (`Internal server error`, no stack traces / SQL leaked); unknown routes → 404 in the same `{ error: { message } }` envelope. Implementation note: Hono's own json body parser (inside the validator) wraps a malformed body in an `HTTPException(400, 'Malformed JSON in request body')` rather than letting the `SyntaxError` propagate, so `onError` also re-shapes any `HTTPException` into the envelope with its own status/message (Hono's default would be a plain-text response) — live-verified via `wrangler dev --remote`.
35. **Logging is a custom one-line middleware** (`src/middleware/logging.ts`): `method path status durationMs` — exactly the fields Section 8 lists. Not `hono/logger` (prints two lines per request in its own format).
36. **Route tests via `app.request()` against real D1** in the Workers pool, co-located as `*.routes.test.ts`; the pattern is added to `vitest.workers.config.ts` and excluded from the unit config. Extends Decision #22's per-layer testing to the HTTP layer (statuses, envelope shape, strict-400s, 404s, ignore/restore round-trips).
37. **Code review fixes (2026-07-02, third pass, after Sections 7–8)** — a high-effort review (8 finder angles, adversarial verification) found **no correctness bugs**; two quality findings survived verification and were fixed:
    - `validationHook`'s parameter re-typed from the loose `{ success: boolean; error?: $ZodError }` to the discriminated union `{ success: true } | { success: false; error: $ZodError }`, mirroring Zod's `safeParse` contract. The loose type would have allowed a future refactor to skip the `error` check, return `undefined` on a failed validation, and fall through to zValidator's default response (raw Zod result instead of the documented envelope).
    - The per-file `DataEnvelope`/`ListEnvelope`/`ErrorEnvelope` test interfaces (duplicated across 6 route test files) consolidated into exports from `src/routes/test-helpers.ts`.
    - Verification also explicitly *rejected* five candidates as non-issues, recorded here so they aren't re-litigated: per-request Drizzle client construction on `/health` (negligible allocation, documented design per Decision #30); the `$ZodError<Record<string, unknown>>` cast in `zodErrorToResponse` (provably the minimal bridge — generic invariance leaves no cast-free alternative); the conditional `_errors` key (documented Decision #31 semantics); the repeated `errorBody('Resource not found')` literal across 7 handlers (stable string, structure already centralized in `errorBody()`, explicit-over-helper philosophy); `requestJson`'s `'POST' | 'PATCH'` method union (matches the V1 API surface exactly).

---

# 1. Infrastructure

Reference: `architecture.md`, `development.md`, `deployment.md`

- [x] Initialize `package.json` with dependencies: `hono`, `zod`, `drizzle-orm`, `drizzle-kit`, `wrangler`, dev deps: `typescript`, `tsx`, `eslint`, `prettier`, `@cloudflare/workers-types`
- [x] Create `tsconfig.json` targeting Workers runtime
- [x] Create `wrangler.jsonc` defining:
  - Worker name
  - compatibility date
  - **two** D1 bindings: e.g. `JOB_TRACKER_DB` → `job-tracker-db`, `HEALTH_MONITOR_DB` → `health-monitor-db`
- [x] Create Cloudflare Worker (`wrangler.jsonc` + `src/index.ts` entrypoint)
- [x] Create the two Cloudflare D1 databases:
  ```bash
  wrangler d1 create job-tracker-db
  wrangler d1 create health-monitor-db
  ```
  Record both database IDs in `wrangler.jsonc`, one per binding.
  Created: `job-tracker-db` = `148da606-715a-477a-8988-106fd2c0b18c`, `health-monitor-db` = `45d37615-ed40-4dab-a544-7c39440fb15a` (region EEUR).
- [x] Configure Drizzle with **two independent configs**, one per database:
  - `drizzle.job-tracker.config.ts` → schema `src/db/job-tracker/schema.ts`, migrations out dir `src/db/job-tracker/migrations`, binding `JOB_TRACKER_DB`
  - `drizzle.health-monitor.config.ts` → schema `src/db/health-monitor/schema.ts`, migrations out dir `src/db/health-monitor/migrations`, binding `HEALTH_MONITOR_DB`
- [x] Set up `eslint.config.js` (flat config), `.prettierrc` — created fresh, repo has none of this yet (Decision #16)
- [x] Set up `.env.example` documenting any local-only variables (none required for V1 besides the two D1 bindings)
- [x] Scaffold project structure with **two independent database folders**, one per domain — no shared schema or client between them:
  ```text
  src/
  ├── app.ts
  ├── index.ts
  ├── db/
  │   ├── job-tracker/
  │   │   ├── client.ts
  │   │   ├── schema.ts
  │   │   ├── seed.sql
  │   │   ├── migrations/
  │   │   └── *.repository.ts
  │   └── health-monitor/
  │       ├── client.ts
  │       ├── schema.ts
  │       ├── seed.sql
  │       ├── migrations/
  │       └── *.repository.ts
  ├── routes/
  ├── services/
  ├── schemas/
  ├── middleware/
  └── utils/
  ```
  Updated per Decision #24 — repository files live colocated under `src/db/<domain>/`, not in a separate top-level `src/repositories/` (the original scaffold here was wrong; corrected retroactively after a code review caught the drift).
- [x] Implement `src/app.ts` — Hono app instance (routers/global middleware are added in Sections 6–7, not part of infrastructure)
- [x] Implement `src/index.ts` — Worker entrypoint exporting `fetch`
- [x] Implement `src/db/job-tracker/client.ts` — Drizzle client bound to the `JOB_TRACKER_DB` binding (schema-less for now; `schema.ts` lands in Section 2)
- [x] Implement `src/db/health-monitor/client.ts` — Drizzle client bound to the `HEALTH_MONITOR_DB` binding (schema-less for now; `schema.ts` lands in Section 2)
- [x] Local development runs against the cloud databases, not a local emulation: `wrangler dev --remote` — smoke-tested, Worker boots with both D1 bindings attached and responds over HTTP

---

# 2. Database Schema (Drizzle)

Reference: `models.md`

Two independent databases, each with its own Drizzle schema file. DB columns use `snake_case`; Drizzle schema definitions expose `camelCase` JS properties mapped to those columns (e.g. `createdAt: text('created_at')`). Fields listed below use the DB column names.

## 2.1 Common columns (applied to every table in both databases)

- `id` (string, primary key — UUID generated by the route handler via `crypto.randomUUID()`, not by the database)
- `created_at` (ISO-8601 string, per `models.md`'s "no Unix timestamps" rule)
- `updated_at`
- `is_demo` (boolean, server-controlled)

## 2.2 `health-monitor-db` — schema: `src/db/health-monitor/schema.ts`

All four tables additionally get:
- `ignored` (boolean, default `false`)
- `reason` (string, nullable)

- [x] `glucose_measurements`
  - `measured_at`, `fasting_value` (number, nullable), `after_meal_value` (number, nullable), `note` (nullable)
  - constraint (service-level, per Decision #19): exactly one of `fasting_value`/`after_meal_value` is present, and it must be `> 0`
  - index added on `measured_at` (not explicitly listed above, but a natural consequence of every list endpoint filtering by `date_from`/`date_to`)
- [x] `blood_pressure_measurements`
  - `measured_at`, `systolic`, `diastolic`, `pulse`, `note` (nullable)
  - constraint: `systolic > diastolic`, `pulse > 0` (enforced in Zod/service layer, not DB — D1/SQLite has limited CHECK support via Drizzle)
  - index added on `measured_at`
- [x] `weight_measurements`
  - `measured_at`, `value` (number, `value > 0`), `note` (nullable)
  - index added on `measured_at`
- [x] `symptom_entries`
  - `happened_at`, `type` (string), `intensity` (number, 1–10), `note` (nullable)
  - indexes added on `happened_at` and `type`

## 2.3 `job-tracker-db` — schema: `src/db/job-tracker/schema.ts`

- [x] `job_applications` (the only table in this database)
  - `company` (required), `position` (required), `vacancy_url` (nullable)
  - `status` (enum `JobApplicationStatus`, required, default `SAVED`)
  - `source` (nullable), `salary_min` (nullable), `salary_max` (nullable)
  - `currency` (string, default `"USD"`)
  - `location` (nullable)
  - `remote_type` (enum: `REMOTE` | `HYBRID` | `OFFICE`, nullable)
  - `notes` (nullable)
  - `applied_at` (nullable), `next_follow_up_at` (nullable)
  - constraint (service-level): `salary_min <= salary_max`, `applied_at <= next_follow_up_at`
  - indexes: on `status`, `company` (used for filtering), and `is_demo`

## 2.4 Migrations

Each database has its own, independent migration history — generated and applied separately, always against the cloud database.

- [x] Generate: `drizzle-kit generate --config drizzle.job-tracker.config.ts` and `drizzle-kit generate --config drizzle.health-monitor.config.ts`
  - Generated: `src/db/job-tracker/migrations/0000_glorious_cammi.sql`, `src/db/health-monitor/migrations/0000_far_alice.sql`
- [x] Review generated SQL by hand for both — matches schema exactly, no surprises
- [x] Apply to the cloud database (no local target exists per Decision #12):
  ```bash
  wrangler d1 migrations apply job-tracker-db --remote
  wrangler d1 migrations apply health-monitor-db --remote
  ```
  Required adding `migrations_dir` per D1 binding in `wrangler.jsonc` (`src/db/job-tracker/migrations`, `src/db/health-monitor/migrations`) — `wrangler d1 migrations apply` otherwise looks for a single top-level `migrations/` folder, which doesn't fit our two-database-per-folder layout.
- [x] Verify schema with `wrangler d1 execute job-tracker-db --remote --command "PRAGMA table_info(job_applications)"` and the equivalent per health-monitor table — all columns confirmed present in the cloud databases

---

# 3. Seed Data

Reference: `development.md`, Decision #13, Decision #17 (sequencing)

Seed is plain SQL, not a TypeScript script, and lives next to each database's schema. Runs immediately after the migrations in Section 2 are applied — no dependency on Sections 4–8 below.

- [x] `src/db/job-tracker/seed.sql` — 16 job applications adapted from `docs/seed/job-tracker/seed.ts` (Decision #18), covering all 9 `JobApplicationStatus` values
- [x] `src/db/health-monitor/seed.sql` — 10 rows each in `glucose_measurements`, `blood_pressure_measurements`, `weight_measurements`, `symptom_entries` (40 total), adapted from `docs/seed/health-monitor/seed.mjs` (Decision #18), spread across the last 30 days
- [x] Every row in both files sets `is_demo = 1`
- [x] Seed fixture rows use **fixed, hardcoded UUIDs** written directly into the SQL (not generated at seed time) — this keeps re-running the seed reproducible (same IDs every time) and makes manual Postman testing easier to script against stable IDs. Dates, by contrast, are computed relative to run time via SQLite functions, not fixed (Decision #20).
- [x] Because seed deletes only `is_demo = 1` rows before inserting, it never touches non-demo data and is always safe to re-run
- [x] Run via `wrangler d1 execute`, one command per database:
  ```bash
  wrangler d1 execute job-tracker-db --remote --file=./src/db/job-tracker/seed.sql
  wrangler d1 execute health-monitor-db --remote --file=./src/db/health-monitor/seed.sql
  ```
- [x] Add matching `package.json` scripts: `db:seed:job-tracker`, `db:seed:health-monitor`, combined `db:seed`
- [x] Seed is always an explicit, manual command — never runs automatically as part of deployment
- [x] Executed against both cloud databases and verified: 16 rows in `job_applications`, 10 rows in each of the 4 Health Monitor tables; glucose rows confirmed to have exactly one of `fasting_value`/`after_meal_value` populated, never both

---

# 4. Validation (Zod schemas)

Reference: `development.md`, `models.md`, `api.md`

For each resource, three schema kinds:

- [x] **Create schema** (`POST` body) — excludes server-managed fields (`id`, `createdAt`, `updatedAt`, `isDemo`, and for Health Monitor also `ignored`/`reason`); for Job Tracker, `currency` defaults to `"USD"` when omitted and `remoteType` is validated against the enum `REMOTE` | `HYBRID` | `OFFICE`
- [x] **Update schema** (`PATCH` body) — all fields optional, plus the ignore/unignore pair (`ignored`, `reason`) for Health Monitor
- [x] **Query schema** — per-resource query params:
  - Job Tracker: `page`, `limit`, `status`, `company`, `search` (`src/schemas/job-applications.schema.ts`)
  - Health Monitor (all 4 resources + dashboard): `date_from`, `date_to` — shared `dateRangeQuerySchema` in `src/schemas/common.schema.ts`, per Decision #21 (`YYYY-MM-DD` only)
- [x] **Path param schema**: `id` (string, non-empty) for all `:id` routes — `idParamSchema` in `src/schemas/common.schema.ts`

Cross-field validation (implemented as Zod `.refine()`):

- [x] Job Tracker: `salaryMin <= salaryMax`, `appliedAt <= nextFollowUpAt`
- [x] Blood Pressure: `systolic > diastolic`, `pulse > 0`
- [x] Glucose: exactly one of `fastingValue`/`afterMealValue` present (not both, not neither), and it must be `> 0` (Decision #19) — runtime-verified with `safeParse` against both/neither/one-present/negative cases
- [x] Weight: `value > 0`
- [x] Symptom: `intensity` between 1 and 10 inclusive

- [x] Wire a global validation-error handler that maps Zod errors to the documented `400` error response shape — `zodErrorToResponse()` in `src/utils/validation.ts`, using Zod's `.flatten().fieldErrors` as `details` (Decision #7); runtime-verified to produce `{ error: { message: "Validation error", details: {...} } }`

---

# 5. Repositories

Reference: `development.md` (repositories only execute queries, no business rules)

- [x] `job-applications.repository.ts` — uses the `src/db/job-tracker/client.ts` Drizzle client (bound to `JOB_TRACKER_DB` / `job-tracker-db`)
  - `listJobApplications({ page, limit, status, company, search, isDemo })` → rows + total count (`isDemo` added for symmetry with the Health Monitor repos, even though nothing in V1 can produce `isDemo: false` yet — kept optional so Section 6 Services can pass it once it matters)
  - `findJobApplicationById(id)`
  - `createJobApplication(data)`, `updateJobApplication(id, data)`, `deleteJobApplication(id)` — all use Drizzle's `.returning()`, confirmed working against real D1
  - `getJobApplicationsMeta(isDemo?)` → distinct companies + per-status counts + total; rate math (`interviewRate` etc.) is deliberately left to Section 6 (Services), per that section's own plan text
  - 12 repo tests (`.repo.test.ts`, real D1 via `@cloudflare/vitest-pool-workers`)
- [x] `glucose.repository.ts`, `blood-pressure.repository.ts`, `weight.repository.ts`, `symptoms.repository.ts` — all use the `src/db/health-monitor/client.ts` Drizzle client (bound to `HEALTH_MONITOR_DB` / `health-monitor-db`)
  - `list(...)` accepts `{ date_from, date_to, isDemo }`, widening `date_to` to end-of-day via `src/utils/date-range.ts` (Decision #21) — verified against real D1 with a record at 23:30 on the boundary date
  - `findById(id)`, `create(data)`, `update(id, data)` (used for both regular updates and ignore/unignore)
  - 18 repo tests total across the four files
- [x] Dashboard repository (`dashboard.repository.ts`) — composes the four Health Monitor `list()` calls over the same date range via `Promise.all`; no query logic of its own. No cross-database joins are needed anywhere in V1 since Job Tracker and Health Monitor never reference each other's data. 2 repo tests.
- [x] Shared `src/utils/date-range.ts` (`toDateRangeBounds`) — not in the original plan text verbatim, added because all four Health Monitor repos + dashboard needed the same end-of-day widening logic (Decision #21); 5 unit tests.

---

# 6. Services (business logic)

Reference: `development.md`

- [x] `job-applications.service.ts`
  - Sets `isDemo: true` on every created record (no auth in V1 — see Decision #10), stamps `createdAt`/`updatedAt`
  - `listJobApplications` returns `{ rows, meta: { page, limit, total, totalPages } }`, matching the `api.md` response envelope directly
  - Computes `JobsStats` (`total`, `interviews`, `interviewRate`, `offers`, `offerRate`, `rejections`, `rejectionRate`) per rules in `api.md` from the repository's raw `statusCounts`
    - interview-related statuses: `SCREENING`, `TECHNICAL_INTERVIEW`, `FINAL_INTERVIEW`
    - rates are `0` (not `NaN`) when `total` is `0` — verified with a dedicated test
  - Pagination default/max enforcement (`limit <= 100`) is already fully handled by `paginationQuerySchema` (Section 4) — nothing left for the service to normalize
  - No cross-field rules deferred from the schema layer — Section 4 + the code-review fixes already cover everything (salary range, follow-up ordering)
  - 7 tests (`.service.test.ts`, real D1)
- [x] `glucose.service.ts`, `blood-pressure.service.ts`, `weight.service.ts`, `symptom.service.ts`
  - Sets `isDemo: true`, `ignored: false`, `reason: ''` on every created record, stamps `createdAt`/`updatedAt`
  - Ignore/restore semantics are just the validated patch (including `ignored`/`reason`) passed through to the repository's `update` — no special-casing needed since Decision #26's `reasonRequiredWhenIgnoredRule` already guarantees a valid `reason` by the time the service sees it
  - 4 + 3 + 3 + 3 = 13 tests (`.service.test.ts`, real D1)
- [x] `dashboard.service.ts`
  - Delegates to `dashboard.repository.ts`'s existing composition rather than the four sibling services (Decision #27)
  - 1 test (`.service.test.ts`, real D1)

---

# 7. Routes (HTTP layer)

Reference: `api.md` (exact contract), `development.md` (routes are thin — validate, call service, respond), Decisions #29–#36 (this revision, approved 2026-07-02)

Structure: one sub-router per resource under `src/routes/` (`health.routes.ts`, `jobs.routes.ts`, `glucose.routes.ts`, `blood-pressure.routes.ts`, `weight.routes.ts`, `symptoms.routes.ts`, `dashboard.routes.ts`), each a `new Hono<AppEnv>()` mounted in `app.ts` via `app.route(...)`. Handlers take DB clients from `c.var` (Decision #30) and validated input from `c.req.valid(...)` (Decision #31). Success responses are written inline (`c.json({ data }, 200 | 201)` — no wrapper over a one-liner); the shared error body builder lives in `src/utils/responses.ts`.

## 7.0 Preparation

- [x] Install `@hono/zod-validator` (Zod 4-compatible version); `npm run typecheck` still passes
- [x] Retro-tighten Section 4 schemas: `.strict()` on all 10 body schemas (create + update × 5 resources) per Decision #32, plus the "at least one field" refine on the 5 update schemas per Decision #33 — with unit tests for both behaviors added to the existing co-located `*.schema.test.ts` files (+14 unit tests; two pre-existing "accepts an empty update" tests inverted to match Decision #33)
- [x] `src/utils/responses.ts` — `errorBody(message, details?)`, shared by `onError`/`notFound`/handler-level 404s
- [x] Shared zValidator hook in `src/utils/validation.ts`, reusing `zodErrorToResponse()`

## 7.1 Health

- [x] `GET /health` → `{ data: { status: "ok" } }` (`health.routes.ts`), no auth, no DB access; route test (app-level route tests live in `src/app.routes.test.ts`: health, unknown-path 404, malformed-JSON 400, CORS header, envelope shape)

## 7.2 Job Tracker (`jobs.routes.ts`)

- [x] `GET /jobs/meta` → `{ companies, statuses, stats }` — registered **before** `/:id` so `meta` never matches as an id
- [x] `GET /jobs` — query: `page`, `limit`, `status`, `company`, `search` → paginated list + `meta`; `search` matches `company`/`position`/`source`/`notes` via SQL `LIKE '%term%'`
- [x] `GET /jobs/:id` → single resource, or 404 envelope when the service returns `undefined`
- [x] `POST /jobs` → route generates `const id = crypto.randomUUID()` (Decision #1), passes `{ id, ...validatedBody }` to the service → `201` + created resource; unknown/server-managed fields in the body → 400 (Decision #32)
- [x] `PATCH /jobs/:id` → partial update; `{}` → 400 (Decision #33)
- [x] `DELETE /jobs/:id` → physical delete, `200` + `{ data: { success: true } }` per `api.md` (not 204); 404 if missing
- [x] Route tests (`jobs.routes.test.ts`): status codes, envelope shape, strict-400, 404, `meta`-vs-`:id` routing — 12 tests

## 7.3 Health Monitor

Four explicit routers — deliberate near-copies (~40 lines each), **not** a generic router factory: Decision #28's lesson (a clever generic silently type-checking wrong) outweighs the duplication here.

For each of `glucose.routes.ts`, `blood-pressure.routes.ts`, `weight.routes.ts`, `symptoms.routes.ts`:

- [x] `GET /<resource>` — query: `date_from`, `date_to` (Decision #21), no pagination
- [x] `POST /<resource>` — route generates `id` via `crypto.randomUUID()`, passes it to the service alongside the validated body → `201`
- [x] `PATCH /<resource>/:id` — update fields, or ignore/restore via `{ ignored, reason }`; 404 for unknown id
- [x] Route tests per resource, including the ignore/restore round-trip; glucose responses use `fastingValue`/`afterMealValue` (Decision #19 — `api.md` update stays tracked in Documentation Updates) — 7 + 5 + 5 + 5 = 22 tests

## 7.4 Dashboard

- [x] `GET /dashboard` (`dashboard.routes.ts`) — query: `date_from`, `date_to` → aggregated `DashboardData`; route test — 2 tests

## 7.5 Cross-cutting route concerns

- [x] Consistent response envelope (`data` / `data + meta` / `error`) — `errorBody()` helper + route-test assertions on every endpoint
- [x] 404 handling for unknown IDs across all resources (handlers) and for unknown paths (`app.notFound`, Decision #34)
- [x] 400 handling for validation failures across all resources via the shared zValidator hook (Decision #31)
- [x] 500 handler that never leaks internals (stack traces, SQL errors) in responses, but does log them — `app.onError` (Decision #34, implemented in Section 8)
- [x] Vitest wiring: `*.routes.test.ts` included in `vitest.workers.config.ts`, excluded from the unit config (Decision #36); shared `src/routes/test-helpers.ts` drives the fully-wired app via `app.request(path, init, env)`
- [x] Full gate green: `npm run typecheck && npm run lint && npm test`
- [x] Manual smoke via `wrangler dev --remote`: `/health` + one full CRUD round-trip (POST → GET → PATCH → DELETE → 404) against the real cloud `job-tracker-db`, verified 2026-07-02. Note: PowerShell's `Invoke-RestMethod` consistently got 503 "worker restarted mid-request" from the remote-preview proxy on non-GET requests — `curl.exe` works fine; use curl for manual smoke tests against `wrangler dev --remote`.
- [x] Update this plan's checkboxes and test counts

---

# 8. Middleware

Reference: Decisions #30, #34, #35; CORS per Decision #8. Registration order in `app.ts`: CORS → logger → db-inject → routers; `onError`/`notFound` attached at app level.

- [x] `src/middleware/db.ts` — per-request Drizzle clients into typed `c.var` (Decision #30)
- [x] `src/middleware/error.ts` — `onError` handler (`HTTPException` → envelope with its status; `SyntaxError` → 400 `Invalid JSON body`; otherwise log + generic 500) and `notFound` handler (404 envelope) — Decision #34
- [x] `src/middleware/logging.ts` — one line per request: `method path status durationMs`, no sensitive data (Decision #35)
- [x] CORS middleware — `hono/cors` with defaults (`Access-Control-Allow-Origin: *`, Decision #8), registered directly in `app.ts`

---

# 9. Testing

Reference: `development.md`, Decision #22 (automated tests adopted)

## 9.1 Automated Unit Tests (Vitest)

- [x] Install and configure `vitest` (`vitest.config.ts`, `npm test` → `vitest run`)
- [x] `src/schemas/common.schema.test.ts` — `idParamSchema`, `dateRangeQuerySchema` (format + range + boundary equality + calendar validity), `paginationQuerySchema` (defaults, coercion, bounds) — 15 tests
- [x] `src/schemas/job-applications.schema.test.ts` — defaults, required fields, enum rejection, salary range, follow-up ordering, partial update (including the Decision #25 default-reset regression test), query schema — 15 tests
- [x] `src/schemas/glucose.schema.test.ts` — exactly-one-of `fastingValue`/`afterMealValue` (both/neither/one/negative/zero), ignore-only update, update rejects setting both — 12 tests
- [x] `src/schemas/blood-pressure.schema.test.ts` — systolic/diastolic ordering, pulse bounds (including the Decision #25 lower-bound regression tests), partial update skips the cross-field check unless both sides present — 12 tests
- [x] `src/schemas/weight.schema.test.ts` — positive value enforcement on create and update — 6 tests
- [x] `src/schemas/symptom.schema.test.ts` — intensity bounds (1–10 inclusive) — 7 tests
- [x] `src/utils/validation.test.ts` — `zodErrorToResponse()` produces the documented `{ error: { message, details } }` shape, bucketed by field — 2 tests
- [x] `src/utils/date-range.test.ts` — end-of-day widening — 5 tests
- [x] Repository tests (`*.repo.test.ts`, Section 5, real D1 via `@cloudflare/vitest-pool-workers`) — 36 tests across 6 files, including the Decision #25 regressions (glucose partial-update invariant, LIKE-wildcard escaping)
- [x] Service tests (`*.service.test.ts`, Section 6, real D1 via the same Workers pool) — 19 tests across 6 files
- [x] Route tests (`*.routes.test.ts`, Section 7, real D1 via `app.request()` in the same Workers pool) — Decision #36 — 41 tests across 7 files (`app.routes.test.ts` + 6 under `src/routes/`)
- [x] Full suite green: 199 tests total (97 unit + 102 against real D1) across 28 files (`npm test`), after Sections 7–8

## 9.2 Manual Testing (Postman)

- [ ] Build Postman/Bruno collection matching the structure in `development.md`:
  ```text
  Platform API
  ├── Health
  ├── Job Tracker (List, Details, Create, Update, Delete, Meta)
  └── Health Monitor (Glucose, Blood Pressure, Weight, Symptoms, Dashboard)
  ```
- [ ] Per endpoint, verify:
  - [ ] successful request
  - [ ] validation error (400)
  - [ ] resource not found (404)
  - [ ] invalid identifier
  - [ ] empty result set
  - [ ] demo data behavior (`isDemo` present and correct)
- [ ] Verify pagination edges: page 0/negative, limit > 100, last page, empty page
- [ ] Verify filtering: unknown `status`, unknown `company`, partial `search` match
- [ ] Verify ignore/restore round-trip for each Health Monitor resource
- [ ] Verify `/jobs/meta` stats math against a known seeded dataset

No automated test suite is planned for V1 per `development.md` ("Version 1 relies primarily on manual API testing") — confirm this still holds or whether we want to add automated tests now while the surface is small.

---

# 10. Deployment

Reference: `deployment.md`

- [ ] `wrangler login` / `wrangler whoami` verified
- [ ] Both D1 databases created in Cloudflare (`job-tracker-db`, `health-monitor-db`), both IDs wired into `wrangler.jsonc`
- [ ] Migrations applied to the cloud database for both:
  ```bash
  wrangler d1 migrations apply job-tracker-db --remote
  wrangler d1 migrations apply health-monitor-db --remote
  ```
- [ ] Seed executed against both cloud databases (demo data only):
  ```bash
  wrangler d1 execute job-tracker-db --remote --file=./src/db/job-tracker/seed.sql
  wrangler d1 execute health-monitor-db --remote --file=./src/db/health-monitor/seed.sql
  ```
- [ ] `wrangler deploy`
- [ ] Post-deploy verification of every endpoint listed in `deployment.md`'s checklist
- [ ] Confirm `/health` responds `200`

There is no separate "local" environment step anywhere in this flow — development, seeding, and deployment all target the same pair of cloud D1 databases (Decision #12).

---

# Documentation Updates Required

- [ ] `models.md` — change `JobApplication.remoteType` from a free string to the enum `REMOTE` | `HYBRID` | `OFFICE`; document `currency` default (`"USD"`)
- [ ] `api.md` — reflect the same `remoteType`/`currency` changes in request/response examples
- [ ] `models.md` — change `GlucoseMeasurement`: replace `value` with `fastingValue` (nullable) and `afterMealValue` (nullable); document the "exactly one of the two" validation rule (Decision #19)
- [ ] `api.md` — update the Glucose resource's request/response examples to use `fastingValue`/`afterMealValue` instead of `value`
- [ ] `architecture.md` — the "High Level Architecture" diagram and the Technology Stack table currently describe a single "Cloudflare D1 Database." Needs updating to show two separate D1 databases (`job-tracker-db`, `health-monitor-db`), one per bounded domain, with no cross-database access.
- [ ] `development.md` — the "Database," "Migrations," "Seed Data," and "Recommended Scripts" sections currently describe one database (`platform-api`), a single `--local`/`--remote` migration pair, and a `scripts/seed.ts` + `tsx` seed approach. All of this needs rewriting to reflect: two databases, cloud-only workflow (`--remote` everywhere, no `--local`), and `seed.sql`-per-database instead of a TS seed script.
- [ ] `deployment.md` — the "Database" and "Seed Data" sections need the same two-database, remote-only, `seed.sql`-based rewrite.

---

# Definition of Done

From `roadmap.md`, plus automated tests per Decision #22:

- [ ] API matches `api.md`
- [ ] Models match `models.md`
- [x] CRUD is implemented
- [x] Validation is implemented
- [x] Automated unit tests pass (`npm test`) — currently covers all Zod schemas; extends to Repositories/Services as they're built
- [ ] Seed is available
- [ ] Manual Postman verification complete
- [ ] Deployment works
- [ ] Documentation is updated

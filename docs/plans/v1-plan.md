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
  │   │   └── migrations/
  │   └── health-monitor/
  │       ├── client.ts
  │       ├── schema.ts
  │       ├── seed.sql
  │       └── migrations/
  ├── routes/
  ├── services/
  ├── repositories/
  ├── schemas/
  ├── middleware/
  └── utils/
  ```
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

- [ ] `glucose_measurements`
  - `measured_at`, `value` (number, `value > 0`), `note` (nullable)
- [ ] `blood_pressure_measurements`
  - `measured_at`, `systolic`, `diastolic`, `pulse`, `note` (nullable)
  - constraint: `systolic > diastolic`, `pulse > 0` (enforced in Zod/service layer, not DB — D1/SQLite has limited CHECK support via Drizzle)
- [ ] `weight_measurements`
  - `measured_at`, `value` (number, `value > 0`), `note` (nullable)
- [ ] `symptom_entries`
  - `happened_at`, `type` (string), `intensity` (number, 1–10), `note` (nullable)

## 2.3 `job-tracker-db` — schema: `src/db/job-tracker/schema.ts`

- [ ] `job_applications` (the only table in this database)
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

- [ ] Generate: `drizzle-kit generate --config drizzle.job-tracker.config.ts` and `drizzle-kit generate --config drizzle.health-monitor.config.ts`
- [ ] Review generated SQL by hand for both
- [ ] Apply to the cloud database (no local target exists per Decision #12):
  ```bash
  wrangler d1 migrations apply job-tracker-db --remote
  wrangler d1 migrations apply health-monitor-db --remote
  ```
- [ ] Verify schema with `wrangler d1 execute job-tracker-db --remote --command "PRAGMA table_info(job_applications)"` and the equivalent per health-monitor table

---

# 3. Seed Data

Reference: `development.md`, Decision #13, Decision #17 (sequencing)

Seed is plain SQL, not a TypeScript script, and lives next to each database's schema. Runs immediately after the migrations in Section 2 are applied — no dependency on Sections 4–8 below.

- [ ] `src/db/job-tracker/seed.sql`
  ```sql
  DELETE FROM job_applications WHERE is_demo = 1;
  INSERT INTO job_applications (id, company, position, status, ..., is_demo) VALUES
    ('<fixed-uuid-1>', 'Google', 'Frontend Developer', 'APPLIED', ..., 1),
    ...;
  ```
  - A realistic spread across all `JobApplicationStatus` values, multiple companies, enough volume to exercise pagination (e.g. 40–80 records)
- [ ] `src/db/health-monitor/seed.sql`
  ```sql
  DELETE FROM glucose_measurements WHERE is_demo = 1;
  DELETE FROM blood_pressure_measurements WHERE is_demo = 1;
  DELETE FROM weight_measurements WHERE is_demo = 1;
  DELETE FROM symptom_entries WHERE is_demo = 1;

  INSERT INTO glucose_measurements (...) VALUES (...);
  INSERT INTO blood_pressure_measurements (...) VALUES (...);
  INSERT INTO weight_measurements (...) VALUES (...);
  INSERT INTO symptom_entries (...) VALUES (...);
  ```
  - Measurements spread across several weeks, enough volume to exercise date-range filtering and the dashboard aggregation
- [ ] Every row in both files sets `is_demo = 1`
- [ ] Seed fixture rows use **fixed, hardcoded UUIDs** written directly into the SQL (not generated at seed time) — this keeps re-running the seed reproducible (same IDs every time) and makes manual Postman testing easier to script against stable IDs
- [ ] Because seed deletes only `is_demo = 1` rows before inserting, it never touches non-demo data and is always safe to re-run
- [ ] Run via `wrangler d1 execute`, one command per database:
  ```bash
  wrangler d1 execute job-tracker-db --remote --file=./src/db/job-tracker/seed.sql
  wrangler d1 execute health-monitor-db --remote --file=./src/db/health-monitor/seed.sql
  ```
- [ ] Add matching `package.json` scripts, e.g. `db:seed:job-tracker`, `db:seed:health-monitor` (and optionally a combined `db:seed` running both)
- [ ] Seed is always an explicit, manual command — never runs automatically as part of deployment

---

# 4. Validation (Zod schemas)

Reference: `development.md`, `models.md`, `api.md`

For each resource, three schema kinds:

- [ ] **Create schema** (`POST` body) — excludes server-managed fields (`id`, `createdAt`, `updatedAt`, `isDemo`, and for Health Monitor also `ignored`/`reason`); for Job Tracker, `currency` defaults to `"USD"` when omitted and `remoteType` is validated against the enum `REMOTE` | `HYBRID` | `OFFICE`
- [ ] **Update schema** (`PATCH` body) — all fields optional, plus the ignore/unignore pair (`ignored`, `reason`) for Health Monitor
- [ ] **Query schema** — per-resource query params:
  - Job Tracker: `page`, `limit`, `status`, `company`, `search`
  - Health Monitor (all 4 resources + dashboard): `date_from`, `date_to`
- [ ] **Path param schema**: `id` (string, non-empty) for all `:id` routes

Cross-field validation (implemented as Zod `.refine()` or in the service layer — decide during implementation):

- [ ] Job Tracker: `salaryMin <= salaryMax`, `appliedAt <= nextFollowUpAt`
- [ ] Blood Pressure: `systolic > diastolic`, `pulse > 0`
- [ ] Glucose / Weight: `value > 0`
- [ ] Symptom: `intensity` between 1 and 10 inclusive

- [ ] Wire a global validation-error handler that maps Zod errors to the documented `400` error response shape

---

# 5. Repositories

Reference: `development.md` (repositories only execute queries, no business rules)

- [ ] `job-applications.repository.ts` — uses the `src/db/job-tracker/client.ts` Drizzle client (bound to `JOB_TRACKER_DB` / `job-tracker-db`)
  - `list({ page, limit, status, company, search })` → rows + total count
  - `findById(id)`
  - `create(data)`
  - `update(id, data)`
  - `delete(id)`
  - `getMeta()` helper queries: distinct companies, distinct statuses in use, aggregate counts for stats
- [ ] `glucose.repository.ts`, `blood-pressure.repository.ts`, `weight.repository.ts`, `symptoms.repository.ts` — all use the `src/db/health-monitor/client.ts` Drizzle client (bound to `HEALTH_MONITOR_DB` / `health-monitor-db`)
  - `list({ dateFrom, dateTo, isDemo })`
  - `findById(id)`
  - `create(data)`
  - `update(id, data)` (used for both regular updates and ignore/unignore)
- [ ] Dashboard repository (or a composed service call) — fetch all four Health Monitor lists (same `health-monitor-db` client) filtered by the same date range. No cross-database joins are needed anywhere in V1 since Job Tracker and Health Monitor never reference each other's data.

---

# 6. Services (business logic)

Reference: `development.md`

- [ ] `job-applications.service.ts`
  - Sets `isDemo: true` on every created record (no auth in V1 — see Decision #10)
  - Computes `JobsStats` (`total`, `interviews`, `interviewRate`, `offers`, `offerRate`, `rejections`, `rejectionRate`) per rules in `api.md`
    - interview-related statuses: `SCREENING`, `TECHNICAL_INTERVIEW`, `FINAL_INTERVIEW`
  - Normalizes pagination params (`page`, `limit`, default/max enforcement: `limit <= 100`)
  - Validates cross-field rules not expressible in Zod alone (if any deferred from schema layer)
- [ ] `glucose.service.ts`, `blood-pressure.service.ts`, `weight.service.ts`, `symptoms.service.ts`
  - Sets `isDemo: true` on every created record
  - Handles ignore/restore semantics
- [ ] `dashboard.service.ts`
  - Aggregates the four Health Monitor services into `DashboardData`

---

# 7. Routes (HTTP layer)

Reference: `api.md` (exact contract), `development.md` (routes are thin — validate, call service, respond)

## 7.1 Health

- [ ] `GET /health` → `{ data: { status: "ok" } }`, no auth, no DB access unless required, fast

## 7.2 Job Tracker

- [ ] `GET /jobs` — query: `page`, `limit`, `status`, `company`, `search` → paginated list + `meta`; `search` matches `company`/`position`/`source`/`notes` via SQL `LIKE '%term%'`
- [ ] `GET /jobs/:id` → single resource or `404`
- [ ] `POST /jobs` → route generates `const id = crypto.randomUUID()`, passes `{ id, ...validatedBody }` to the service → `201` + created resource; rejects server-managed fields present in body (or silently strips them — decide: **reject with 400** is more explicit and safer)
- [ ] `PATCH /jobs/:id` → partial update, all fields optional
- [ ] `DELETE /jobs/:id` → physical delete, `{ data: { success: true } }`
- [ ] `GET /jobs/meta` → `{ companies, statuses, stats }`

## 7.3 Health Monitor

For each of Glucose, Blood Pressure, Weight, Symptoms:

- [ ] `GET /<resource>` — query: `date_from`, `date_to`, no pagination
- [ ] `POST /<resource>` — route generates `id` via `crypto.randomUUID()`, passes it to the service alongside the validated body
- [ ] `PATCH /<resource>/:id` — update fields, or ignore/restore via `{ ignored, reason }`

## 7.4 Dashboard

- [ ] `GET /dashboard` — query: `date_from`, `date_to` → aggregated `DashboardData`

## 7.5 Cross-cutting route concerns

- [ ] Consistent response envelope (`data` / `data + meta` / `error`) enforced via a shared response helper in `utils/`
- [ ] 404 handling for unknown IDs across all resources
- [ ] 400 handling for validation failures across all resources
- [ ] 500 handler that never leaks internals (stack traces, SQL errors) in responses, but does log them

---

# 8. Middleware

- [ ] Global error-handling middleware (catches thrown errors, maps to `{ error: { message, details } }`)
- [ ] Logging middleware (method, path, status, duration — no sensitive data)
- [ ] CORS middleware — `Access-Control-Allow-Origin: *`, no origin restriction (safe: auth uses `Authorization: Bearer`, not cookies)

---

# 9. Testing

Reference: `development.md`

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
- [ ] `architecture.md` — the "High Level Architecture" diagram and the Technology Stack table currently describe a single "Cloudflare D1 Database." Needs updating to show two separate D1 databases (`job-tracker-db`, `health-monitor-db`), one per bounded domain, with no cross-database access.
- [ ] `development.md` — the "Database," "Migrations," "Seed Data," and "Recommended Scripts" sections currently describe one database (`platform-api`), a single `--local`/`--remote` migration pair, and a `scripts/seed.ts` + `tsx` seed approach. All of this needs rewriting to reflect: two databases, cloud-only workflow (`--remote` everywhere, no `--local`), and `seed.sql`-per-database instead of a TS seed script.
- [ ] `deployment.md` — the "Database" and "Seed Data" sections need the same two-database, remote-only, `seed.sql`-based rewrite.

---

# Definition of Done (from `roadmap.md`, unchanged)

- [ ] API matches `api.md`
- [ ] Models match `models.md`
- [ ] CRUD is implemented
- [ ] Validation is implemented
- [ ] Seed is available
- [ ] Deployment works
- [ ] Documentation is updated

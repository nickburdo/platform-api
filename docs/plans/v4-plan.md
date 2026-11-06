# Version 4 — Implementation Plan

> Status: **Approved** (2026-11-06) — execution: subagent-driven.
> Depends on: Version 3 (`v3-plan.md`, Complete 2026-07-03)
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Spec:** `../superpowers/specs/2026-11-06-v4-multi-user-auth-design.md` (Approved 2026-11-06). Read it before any task — this plan argues from its decisions U1–U16 / C1–C11 and does not repeat their rationale.
> Supporting documents: `../architecture.md`, `../models.md`, `../api.md`, `../development.md`, `../deployment.md`, `../decisions.md`

**Goal:** turn the single-admin API into a small multi-user service — open registration by username, login by password or Google (no email anywhere), per-user data, read-only demo for guests, self-service account deletion.

**Architecture:** the boolean `isDemo` partition is replaced by an owner scope `ownerId: string | null` (`null` = demo) carried from the identity middleware through services into repositories, filtered on a new `user_id` column. Writes are gated by a `requireUser` middleware placed before body validation. Google Sign-In keys accounts by OpenID `sub` and returns the token to an allow-listed frontend via a URL fragment.

**Tech Stack:** Cloudflare Workers, Hono 4, Drizzle ORM + drizzle-kit (SQLite/D1), Zod 4, `jose`, Vitest + `@cloudflare/vitest-pool-workers` (real D1), `@asteasolutions/zod-to-openapi`.

---

## Global Constraints

- Process per `CLAUDE.md`: docs-first (Task 1 lands before any code), no deviation without plan revision, every new non-obvious technical choice made during implementation is appended as a numbered Decision below.
- Per-commit gate: `npm run typecheck && npm run lint && npm run test:unit && npm run test:repo`; plus `npm run openapi:generate` when schemas/routes change.
- Tests: written **alongside** the code, not test-first (user's global rule: no TDD); scope per U15 — update the existing suite and add tests for every spec §4 anti-goal.
- After each task: `/code-review` (high) → fix confirmed/plausible findings in a separate `fix:` commit. `feat:`/`fix:`/`docs:` commits are never amended.
- Deploy **only on an explicit "deploy"/"деплой"** from the user (Task 9).
- All code comments in English.
- Username: `^[A-Za-z0-9_-]{3,32}$`, unique case-insensitively. Password: 8–128 chars. Google scope: exactly `openid`.
- Allowed frontend origins: `https://health-monitor-new.pages.dev`, `https://job-tracker-new.pages.dev`, plus `http(s)://localhost:<any>` and `http(s)://127.0.0.1:<any>`.
- Exact messages: `Authentication required` (401, guest on a user-only route), `Invalid or expired token` (401, bad/expired token or deleted user), `Invalid credentials` (401, login), `Username is already taken` (409), `Invalid or expired state` (401, Google callback), `redirect must be an allowed frontend URL` (400), `Google account is already linked` (409), `Password is already set` (409). Fragment results: `#token=`, `#linked=google`; error codes `access_denied`, `google_failed`, `google_already_used`.

## Review Focus

1. **Guest sends an invalid body to a write route** → must get `401 Authentication required`, not `400` (guard runs before `zValidator`). Pinned in Tasks 3 and 4.
2. **Usernames differing only in case** — `Nick` registered, then `nick` registers → `409`; login as `NICK` with the right password succeeds. Pinned in Task 2.
3. **Token of a deleted account used on a plain GET** → `401 Invalid or expired token`, never a silent fallback to guest/demo data. Pinned in Task 5.
4. **Look-alike redirects** — `https://job-tracker-new.pages.dev.evil.com/x`, `https://evil.com/?r=https://job-tracker-new.pages.dev`, `//evil.com`, `javascript:alert(1)`, `http://job-tracker-new.pages.dev/x` (scheme downgrade), a redirect that already contains `#` → all `400`, no redirect. Pinned in Task 6.
5. **User presses "Cancel" on Google's consent screen** (callback gets `error=access_denied&state=…`, no `code`) → `302` to `<redirect>#error=access_denied`, not a `400` JSON page. Pinned in Task 6.

---

# Decisions

Implementation-level decisions made while writing this plan (the product decisions live in the spec). Proposed for approval together with the plan.

1. **Owner scope type.** `type OwnerId = string | null` — `null` means demo. Every repository/service function that took `isDemo: boolean` now takes `ownerId: OwnerId`. A single helper `ownerFilter(column, ownerId)` returns `isNull(column)` for `null` and `eq(column, ownerId)` otherwise; it is the only place this branch exists.
2. **Identity shape.** `type Identity = { scope: 'guest' } | { scope: 'user'; userId: string }`; `ownerIdOf(identity): OwnerId` replaces `scopeIsDemo`.
3. **`requireUser` middleware** (`src/middleware/auth.ts`) is mounted per route, as the first handler on every write route and on `GET/DELETE /auth/me`, before any `zValidator` — that ordering is what makes Review Focus #1 hold.
4. **User existence check** happens inside `resolveIdentity` (one `findUserById` on `auth-db` per authenticated request). Missing user → `401 Invalid or expired token` (same message as a bad token: the frontend reaction is identical).
5. **Username casing.** Stored as entered (displayed as entered); uniqueness and lookup are case-insensitive via a unique expression index on `lower(username)` and `lower(username) = lower(?)` lookups. Safe because usernames are ASCII-only.
6. **Registration race.** The service does not pre-check availability; it inserts and maps a SQLite `UNIQUE constraint failed` error to `409` — race-free.
7. **`users` invariant** enforced in the DB: `CHECK (password_hash IS NOT NULL OR google_sub IS NOT NULL)`.
8. **`auth-db` migration** is generated by drizzle-kit and then hand-edited so it drops and recreates `users` **without copying rows** (the V2 admin row cannot satisfy `username NOT NULL`, and U8 says it is removed). The meta snapshot stays as generated.
9. **Business-DB migrations** are drizzle-kit generated table rebuilds; existing rows are copied with `user_id = NULL` (all are demo — re-verified in Task 9 per C11).
10. **`userId` is not exposed** in business responses (and `isDemo` disappears from them). Services strip it with one shared `omitUserId(row)` helper in `src/utils/owner.ts`. The client never needs it, and it keeps responses identical in shape for guest and user.
11. **Google `sub` source:** the `id_token` returned by Google's token endpoint, decoded with `jose`'s `decodeJwt` (no signature check). Verified 2026-11-06 against Google's OpenID Connect docs: `sub` is always present; tokens received directly from the token endpoint over HTTPS with the client secret "really come from Google and are valid". Still checked: `iss ∈ {https://accounts.google.com, accounts.google.com}`, `aud === GOOGLE_CLIENT_ID`, non-empty `sub`. The userinfo call is removed. **Scope `openid` alone verified live on 2026-11-06**: Google's authorize endpoint accepted it (sign-in page), while an invalid scope is rejected with `invalid_scope`.
12. **Allowlist config:** `ALLOWED_FRONTEND_ORIGINS` — a comma-separated string in `wrangler.jsonc` `vars` (also picked up by the test pool, which already reads `wrangler.jsonc`). Matching: parse with `new URL`; scheme must be `http:`/`https:`; no `#` in the redirect; `url.origin` must equal an allowed origin exactly, or hostname is `localhost`/`127.0.0.1`.
13. **Redirect travels in the signed `state`** (claim `redirect`), so the callback trusts only what it signed itself.
14. **Callback query schema** accepts `{ state, code?, error? }`. Invalid `state` → `401` JSON (redirect unknown). Valid `state` + `error=access_denied` → `#error=access_denied`; any other failure (no `code`, other `error`, exchange failure) → `#error=google_failed`, with the cause logged via `console.error` + request context.
15. **Generated username:** `user-` + 6 lowercase hex chars (`crypto.getRandomValues`); on a unique-constraint collision retry up to 5 times, then throw (→ `google_failed`).
16. **Account deletion repositories:** `deleteJobApplicationsByUserId(db, userId)` and `deleteHealthDataByUserId(db, userId)` (one `db.batch` over the four tables), called before `deleteUserById`. Returns `204`.
17. **`scripts/create-admin.ts` is deleted** together with its docs, and the `tsconfig`/lint references to it.
18. **Google Cloud Console** (manual, user, Task 9): remove the `email` scope from the consent screen, and **publish the OAuth app ("In production")** — in Testing mode only manually listed test users could sign in, which would block every visitor. With only the non-sensitive `openid` scope no Google verification review is expected; the user confirms in the console.
19. **Linking flow state.** `issueOAuthState(secret, { redirect, intent: 'login' } | { redirect, intent: 'link', userId })`; `verifyOAuthState` returns the same union or `null`. The callback re-checks at link time that the user still exists and still has no `google_sub` (the 10-minute state window allows a concurrent change); failure → `#error=google_failed`.
20. **Link endpoint is `POST` with a JSON body** returning the Google URL, because a browser navigation cannot carry the `Authorization` header and a JWT must never be put into a URL.
21. **Set-password endpoint** `POST /auth/me/password` updates `password_hash` (and `username` if given) in one `UPDATE … WHERE id = ? AND password_hash IS NULL`; zero affected rows → `409 Password is already set`; unique violation on username → `409 Username is already taken`.

---

# File Map

| File | Change |
|---|---|
| `src/db/auth/schema.ts`, `users.repository.ts`, `test-helpers.ts`, `migrations/0001_*.sql` | new `users` shape, repo functions |
| `src/db/job-tracker/schema.ts`, `job-applications.repository.ts`, `seed.sql`, `migrations/0001_*.sql` | `user_id` replaces `is_demo` |
| `src/db/health-monitor/schema.ts`, 4 repositories, `dashboard.repository.ts`, `seed.sql`, `migrations/0001_*.sql`, new `account-data.repository.ts` | same |
| `src/utils/owner.ts` (new) | `OwnerId`, `ownerFilter`, `omitUserId` |
| `src/utils/repository-filters.ts` | `isDemo` → `ownerId` |
| `src/utils/jwt.ts` | drop `role` claim |
| `src/utils/oauth-state.ts` | `redirect` claim |
| `src/utils/frontend-origins.ts` (new) | allowlist parsing/matching |
| `src/middleware/auth.ts` | `Identity`, `ownerIdOf`, `requireUser`, existence check |
| `src/schemas/auth.schema.ts` | `registerSchema`, `loginSchema`, `googleStartQuerySchema`, `googleCallbackQuerySchema` |
| `src/services/auth.service.ts` | register/login/getMe/loginWithGoogle/deleteAccount |
| `src/services/google-oauth.service.ts` | `sub` from `id_token` |
| all business services + routes | `ownerId`, `requireUser` |
| `src/routes/auth.routes.ts` | new endpoints, redirect flow |
| `src/routes/test-helpers.ts` | `seedUserAndGetToken` |
| `src/openapi/registry.ts`, `openapi.json` | contract update |
| `http/*.http`, `http-client.env.json` | register/login by username, user-scoped flows |
| `wrangler.jsonc`, `src/app.ts`, `worker-configuration.d.ts` | `ALLOWED_FRONTEND_ORIGINS` |
| `scripts/create-admin.ts` | deleted |
| docs (Task 1) | see Task 1 |

---

### Task 1: Docs-first pass

**Files:** Modify `docs/api.md`, `docs/models.md`, `docs/architecture.md`, `docs/decisions.md`, `docs/roadmap.md`, `docs/development.md`, `docs/deployment.md`, `docs/google-console.md`, `README.md`. Create `docs/frontend-guide.md`, `docs/connecting-a-frontend.md`.

- [ ] **Step 1:** `api.md` — rewrite Authentication + demo-data sections to the guest/user model; contracts of `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `DELETE /auth/me`, `POST /auth/me/password`, `POST /auth/google/link`, `GET /auth/google?redirect=`, `GET /auth/google/callback` exactly per spec §7.3 and the Global Constraints messages; remove `isDemo` from every example; add `401 Authentication required` to every write endpoint's `### Errors`.
- [ ] **Step 2:** `models.md` — `User` (`id`, `username`, `passwordHash?`, `googleSub?`, timestamps, invariant), `userId` replaces `isDemo` on all five entities, demo = `userId IS NULL`.
- [ ] **Step 3:** `architecture.md` — identity resolution diagram (guest / user / 401 incl. existence check), no roles; `auth-db` holds all users.
- [ ] **Step 4:** `decisions.md` — new **ADR-014 "Open multi-user model with username accounts, no email"** (Accepted), mark ADR-012 and ADR-013 "Superseded by ADR-014".
- [ ] **Step 5:** `roadmap.md` — add a `# Version 4` section (goal, task checklist mirroring this plan, Definition of Done) and move "single-tenant" wording out of present tense.
- [ ] **Step 6:** `development.md` — remove the bootstrap-script workflow; document `ALLOWED_FRONTEND_ORIGINS`, test helper `seedUserAndGetToken`, the new demo rule (`user_id IS NULL`).
- [ ] **Step 7:** `deployment.md` — V4 deploy procedure exactly as Task 9 (pre-migration safety query, migration order, deploy, reseed, verification), remove admin bootstrap section.
- [ ] **Step 8:** `google-console.md` — scope `openid` only; new section "Publish the app (In production)" with why (Decision 18).
- [ ] **Step 9:** create `docs/frontend-guide.md` with all 8 points of spec §9 plus the two optional linking flows (U16), including the exact messages and fragment error codes from Global Constraints.
- [ ] **Step 10:** create `docs/connecting-a-frontend.md` per spec §10 (origin format examples, pre-allowed localhost, `npx wrangler deploy`, verification by opening `/auth/google?redirect=…`, "Google Console: no change").
- [ ] **Step 11:** `README.md` — Version 4 in Current Features; links to both new guides; docs tree.
- [ ] **Step 12:** Commit `docs: V4 docs-first pass — multi-user auth (ADR-014)`.

### Task 2: auth-db users, tokens, identity, register/login/me

**Files:** Modify `src/db/auth/schema.ts`, `src/db/auth/users.repository.ts`, `src/db/auth/test-helpers.ts`, `src/utils/jwt.ts`, `src/middleware/auth.ts`, `src/schemas/auth.schema.ts`, `src/services/auth.service.ts`, `src/routes/auth.routes.ts`, `src/routes/test-helpers.ts`; create `src/db/auth/migrations/0001_*.sql`; delete `scripts/create-admin.ts`. Tests: the matching `*.test.ts` files.

**Interfaces — Produces:**
- `users` columns: `id`, `username`, `passwordHash: string | null`, `googleSub: string | null`, `createdAt`, `updatedAt`.
- `findUserByUsername(db, username): Promise<User | undefined>` (case-insensitive), `findUserByGoogleSub(db, sub)`, `findUserById(db, id)`, `insertUser(db, row: NewUser): Promise<User>` (throws on unique violation), `deleteUserById(db, id): Promise<void>`.
- `isUniqueViolation(err: unknown): boolean` in `src/db/auth/users.repository.ts`.
- `issueToken(userId, secret)` / `verifyToken(token, secret): Promise<{ sub: string } | null>`.
- `Identity`, `ownerIdOf(identity): OwnerId`, `requireUser` (Hono middleware), `resolveIdentity` with existence check.
- `PublicUser = { id; username; hasPassword: boolean; createdAt; updatedAt }`, `toPublicUser(user)`.
- `register(db, input, secret): Promise<LoginResult | 'username_taken'>`, `login(db, input, secret): Promise<LoginResult | null>`, `getMe(db, userId)`.
- `seedUserAndGetToken({ username?, password? }): Promise<{ userId; token; username; password }>` (replaces `seedAdminAndGetToken`).
- `src/utils/owner.ts`: `type OwnerId = string | null`, `ownerFilter(column: Column, ownerId: OwnerId): SQL`, `omitUserId<T extends { userId: unknown }>(row: T): Omit<T, 'userId'>`.

- [ ] **Step 1:** Update `users` schema per spec §8 + Decisions 5, 7; run `npx drizzle-kit generate --config drizzle.auth.config.ts`; hand-edit the SQL to drop/recreate without row copy (Decision 8). Expected: `0001_*.sql` contains `DROP TABLE` of the old table, `CREATE TABLE users` with the CHECK, unique index on `lower("username")`, unique index on `google_sub`.
- [ ] **Step 2:** Implement the repository functions and `isUniqueViolation` (matches `UNIQUE constraint failed` in the error chain — inspect `err.cause` too, D1 wraps it).
- [ ] **Step 3:** `src/utils/owner.ts` as specified.
- [ ] **Step 4:** `jwt.ts` — remove `role` everywhere; `verifyToken` requires only non-empty `sub`.
- [ ] **Step 5:** `middleware/auth.ts` — new `Identity`, existence check (Decision 4), `requireUser` → `401 Authentication required` for guests, `ownerIdOf`. Keep a temporary `scopeIsDemo(identity) = identity.scope !== 'user'` so business routes compile until Tasks 3–4 remove it.
- [ ] **Step 6:** Schemas — `registerSchema` (`username` regex + 3–32, `password` 8–128, `.strict()`, human messages for missing keys per V3 Section 4 pattern), `loginSchema` (`username` and `password` non-empty strings, `.strict()`; no format rule so a malformed username simply yields `401`).
- [ ] **Step 7:** Service — `register` (hash, insert, map unique violation → `'username_taken'`, issue token), `login` by username (keep the dummy-hash timing equalisation; a user with `passwordHash === null` fails like a wrong password), `getMe`, `toPublicUser`.
- [ ] **Step 8:** Routes — `POST /auth/register` (`201` / `409 Username is already taken`), `POST /auth/login`, `GET /auth/me` behind `requireUser`. Leave Google routes compiling (adapted in Task 6).
- [ ] **Step 9:** Delete `scripts/create-admin.ts` and any references (`scripts/tsconfig.json` include list, docs already handled in Task 1).
- [ ] **Step 10:** Tests (update existing + add):
  - repo: `findUserByUsername` is case-insensitive; inserting `Nick` then `nick` throws and `isUniqueViolation(err) === true`; inserting a row with both `passwordHash` and `googleSub` null throws.
  - jwt: token without `role` verifies; token with empty `sub` → `null`.
  - schema: `register` rejects `ab`, 33 chars, `nick!`, password of 7 chars; accepts `Nick_01-x` / 8-char password; `{}` yields human messages (covered by `no-raw-zod-messages.test.ts` once `registerSchema` is added to its list).
  - routes: `register → 201` with `data.token` and `data.user = { id, username: 'Nick', hasPassword: true, … }` and no `passwordHash`/`googleSub`/`email`/`role` keys; register `nick` after `Nick` → `409 Username is already taken`; login `NICK`/right password → `200`; wrong password, unknown user, Google-only user (inserted with `googleSub`, no password) → all `401 Invalid credentials`; `GET /auth/me` without token → `401 Authentication required`, with token → `200`; a validly signed token for a `userId` not in `auth-db` → `401 Invalid or expired token` on `GET /jobs` (Review Focus #3 baseline).
- [ ] **Step 11:** Run the gate. Expected: all green (business tests still use `scopeIsDemo` and pass via `seedUserAndGetToken`).
- [ ] **Step 12:** Commit `feat: V4 Task 2 - username accounts, register/login, user identity`.

### Task 3: Job Tracker owner scope

**Files:** Modify `src/db/job-tracker/schema.ts`, `job-applications.repository.ts`, `seed.sql`; create `src/db/job-tracker/migrations/0001_*.sql`; modify `src/services/job-applications.service.ts`, `src/routes/jobs.routes.ts`. Tests: matching repo/service/route tests.

**Interfaces:** Consumes `OwnerId`, `ownerFilter`, `omitUserId`, `ownerIdOf`, `requireUser`. Produces `deleteJobApplicationsByUserId(db: JobTrackerDb, userId: string): Promise<void>`; every existing repo/service function's `isDemo` parameter becomes `ownerId: OwnerId`; `GetJobApplicationsMetaParams = { ownerId: OwnerId }` (required — no unscoped meta any more).

- [ ] **Step 1:** Schema: drop `isDemo` + its index, add `userId: text('user_id')` + index `job_applications_user_id_idx`; `npx drizzle-kit generate --config drizzle.job-tracker.config.ts`. Expected: table rebuild that copies all columns except `is_demo`.
- [ ] **Step 2:** Repository: replace every `eq(isDemo, …)` with `ownerFilter(jobApplications.userId, ownerId)`; add `deleteJobApplicationsByUserId`.
- [ ] **Step 3:** Service: `ownerId` in, `omitUserId` on every returned row; create sets `userId: ownerId`.
- [ ] **Step 4:** Routes: `requireUser` first on `POST /`, `PATCH /:id`, `DELETE /:id`; pass `ownerIdOf(c.var.identity)`.
- [ ] **Step 5:** `seed.sql`: `DELETE … WHERE user_id IS NULL`, drop `is_demo` from the column list/values, update the header comment.
- [ ] **Step 6:** Tests (update existing + add):
  - guest: `GET /jobs` returns only demo rows; `POST /jobs` with a **valid** body → `401 Authentication required`; `POST /jobs` with body `{}` → `401` (Review Focus #1); `PATCH`/`DELETE` on a demo id → `401`.
  - two users A and B: A creates a job; B's `GET /jobs` does not contain it; B's `GET/PATCH/DELETE /jobs/<A's id>` → `404`; A's `GET /jobs` contains no demo rows; `/jobs/meta` for A counts only A's rows.
  - responses contain neither `userId` nor `isDemo`.
  - body `{ …, userId: 'x' }` → `400` (strict schema).
  - repo: `deleteJobApplicationsByUserId(A)` removes A's rows, leaves B's and demo rows.
- [ ] **Step 7:** Gate, then commit `feat: V4 Task 3 - Job Tracker per-user scope`.

### Task 4: Health Monitor owner scope

**Files:** Modify `src/db/health-monitor/schema.ts`, the four resource repositories, `dashboard.repository.ts`, `seed.sql`, `src/utils/repository-filters.ts`; create `src/db/health-monitor/account-data.repository.ts`, `src/db/health-monitor/migrations/0001_*.sql`; modify the four services, `dashboard.service.ts`, `health-monitor-shared.ts`, the four routes, `dashboard.routes.ts`, `src/middleware/auth.ts` (remove `scopeIsDemo`). Tests: matching files.

**Interfaces:** Produces `DateRangeFilterParams = DateRangeInput & { ownerId: OwnerId }` (required), `buildDateRangeFilter(dateColumn, userIdColumn, params)`, `withCreateStamps(id, input, ownerId)`, `deleteHealthDataByUserId(db: HealthMonitorDb, userId: string): Promise<void>`; all `isDemo` params → `ownerId: OwnerId`.

- [ ] **Step 1:** `commonColumns`: replace `isDemo` with `userId: text('user_id')`; add a `<table>_user_id_idx` index to each of the four tables; generate migration (`drizzle.health-monitor.config.ts`).
- [ ] **Step 2:** `repository-filters.ts` + four repositories + dashboard repository → `ownerFilter`.
- [ ] **Step 3:** `account-data.repository.ts` — `deleteHealthDataByUserId` via one `db.batch([...four deletes])`.
- [ ] **Step 4:** Services (incl. dashboard and `health-monitor-shared.ts`) → `ownerId`, `omitUserId` on every returned row (dashboard: on every row of every array).
- [ ] **Step 5:** Routes: `requireUser` first on every `POST /` and `PATCH /:id` (PATCH covers ignore/restore, C1); `ownerIdOf`.
- [ ] **Step 6:** Remove `scopeIsDemo` and its test; `grep -rn "isDemo\|is_demo\|scopeIsDemo" src` must return only migration history files (`migrations/0000_*`, `meta/`).
- [ ] **Step 7:** `seed.sql` as in Task 3 Step 5, for all four tables.
- [ ] **Step 8:** Tests (update + add), per resource via the existing per-resource route test files:
  - guest `POST` (valid and `{}` body) and `PATCH` with `{ ignored: true, reason: 'x' }` → `401`.
  - users A/B isolation on list, `PATCH` (B on A's id → `404`), dashboard (A's dashboard contains only A's rows, no demo rows; guest dashboard only demo rows).
  - responses contain neither `userId` nor `isDemo`.
  - repo: `deleteHealthDataByUserId(A)` empties A's rows in all four tables, leaves B and demo.
- [ ] **Step 9:** Gate, commit `feat: V4 Task 4 - Health Monitor per-user scope`.

### Task 5: Account deletion

**Files:** Modify `src/services/auth.service.ts`, `src/routes/auth.routes.ts`. Tests: `auth.service.test.ts`, `auth.routes.test.ts`.

**Interfaces:** Consumes `deleteJobApplicationsByUserId`, `deleteHealthDataByUserId`, `deleteUserById`. Produces `deleteAccount(dbs: { authDb; jobTrackerDb; healthMonitorDb }, userId: string): Promise<void>`.

- [ ] **Step 1:** `deleteAccount`: job-tracker data, then health-monitor data, then the user row (C6 order; sequential `await`s, no `Promise.all`).
- [ ] **Step 2:** `DELETE /auth/me` behind `requireUser` → `204` empty body.
- [ ] **Step 3:** Tests:
  - A has 1 job + 1 glucose + 1 symptom, B has 1 job: after A's `DELETE /auth/me` → `204`; A's rows gone in both DBs, B's and demo rows intact; `findUserById(A)` undefined.
  - A's old token afterwards: `GET /jobs` → `401 Invalid or expired token` (Review Focus #3), `POST /jobs` → `401`, `DELETE /auth/me` → `401`.
  - guest `DELETE /auth/me` → `401 Authentication required`.
  - service: when `deleteHealthDataByUserId` is made to throw (inject a db whose `batch` rejects), the user row still exists — a retry can finish (C6).
- [ ] **Step 4:** Gate, commit `feat: V4 Task 5 - account deletion with all data`.

### Task 6: Google Sign-In by `sub` with frontend redirect

**Files:** Create `src/utils/frontend-origins.ts`; modify `src/utils/oauth-state.ts`, `src/services/google-oauth.service.ts`, `src/services/auth.service.ts`, `src/schemas/auth.schema.ts`, `src/routes/auth.routes.ts`, `src/app.ts` (`Bindings.ALLOWED_FRONTEND_ORIGINS: string`), `wrangler.jsonc` (`vars`), `worker-configuration.d.ts` (`npm run cf-typegen`). Tests: `oauth-state.test.ts`, `google-oauth.test.ts`, new `frontend-origins.test.ts`, `auth.routes.test.ts`, `auth.service.test.ts`.

**Interfaces — Produces:**
- `parseAllowedOrigins(raw: string): string[]`, `isAllowedRedirect(redirect: string, allowedOrigins: string[]): boolean`.
- `issueOAuthState(secret, redirect: string)`, `verifyOAuthState(token, secret): Promise<{ redirect: string } | null>`.
- `exchangeGoogleCode(code, env, redirectUri): Promise<{ sub: string }>`.
- `loginWithGoogle(db, sub, secret): Promise<LoginResult>` (find or create, Decision 15).
- `resolveGoogleCallback(query: { state: string; code?: string; error?: string }, deps): Promise<{ kind: 'invalid_state' } | { kind: 'redirect'; location: string }>`.

- [ ] **Step 1:** `wrangler.jsonc` `vars.ALLOWED_FRONTEND_ORIGINS = "https://health-monitor-new.pages.dev,https://job-tracker-new.pages.dev"`; `cf-typegen`; `Bindings` type.
- [ ] **Step 2:** `frontend-origins.ts` per Decision 12.
- [ ] **Step 3:** `oauth-state.ts` — `redirect` claim (Decision 13).
- [ ] **Step 4:** `google-oauth.service.ts` per Decision 11 (token call only, decode `id_token`, check `iss`/`aud`/`sub`).
- [ ] **Step 5:** `loginWithGoogle` per Decision 15.
- [ ] **Step 6:** Routes: `GET /auth/google` validates `redirect` via `googleStartQuerySchema` + `isAllowedRedirect` → `400 redirect must be an allowed frontend URL`, else `302` with `scope=openid`; callback per Decision 14 — success `302` to `` `${redirect}#token=${encodeURIComponent(token)}` ``.
- [ ] **Step 7:** Tests:
  - `isAllowedRedirect` true: both prod origins with a path, `http://localhost:5173/cb`, `http://127.0.0.1:3000/`; false: every redirect in Review Focus #4, empty string, `ftp://localhost/`.
  - state: round-trip returns the same `redirect`; a token signed with another secret → `null`; an access token (no `purpose`) → `null`.
  - google-oauth (fake `fetch`): returns `sub` from an `id_token` built with `jose` `UnsignedJWT`/`SignJWT`; wrong `aud` → throws; wrong `iss` → throws; missing `id_token` → throws.
  - `loginWithGoogle`: unknown `sub` creates a user with username matching `^user-[0-9a-f]{6}$`, `passwordHash` null; same `sub` again returns the same user id (no second row).
  - routes: `GET /auth/google?redirect=https://job-tracker-new.pages.dev/auth/callback` → `302`, `Location` host `accounts.google.com`, `scope=openid`; missing / disallowed `redirect` → `400`; callback with tampered state → `401 Invalid or expired state`; valid state + `error=access_denied` (no code) → `302` to `…/auth/callback#error=access_denied` (Review Focus #5); valid state + exchange throwing → `#error=google_failed`; valid state + fake exchange returning a `sub` → `302` whose fragment `token` verifies with `verifyToken` and whose `sub` maps to a user with `hasPassword: false`.
- [ ] **Step 8:** Gate, commit `feat: V4 Task 6 - Google Sign-In by sub with frontend redirect`.

### Task 7: Account linking (both directions, U16)

**Files:** Modify `src/utils/oauth-state.ts`, `src/db/auth/users.repository.ts`, `src/services/auth.service.ts`, `src/schemas/auth.schema.ts`, `src/routes/auth.routes.ts`. Tests: `oauth-state.test.ts`, `users.repository.repo.test.ts`, `auth.service.test.ts`, `auth.routes.test.ts`.

**Interfaces:** Consumes Task 6 (`isAllowedRedirect`, `exchangeGoogleCode`, `resolveGoogleCallback`). Produces `setGoogleSub(db, userId, sub): Promise<boolean>` (only where `google_sub IS NULL`), `setInitialPassword(db, userId, passwordHash, username?): Promise<'ok' | 'already_set' | 'username_taken'>`, `linkGoogle(...)` in the service, `setPasswordSchema` (`password` 8–128, optional `username` with the register rules, `.strict()`), `googleLinkBodySchema` (`{ redirect }`, `.strict()`).

- [ ] **Step 1:** State union per Decision 19; existing login state uses `intent: 'login'`.
- [ ] **Step 2:** `POST /auth/google/link` behind `requireUser`: disallowed redirect → `400`; user already has `googleSub` → `409 Google account is already linked`; else `200 { data: { url } }` (Decision 20).
- [ ] **Step 3:** Callback branch for `intent: 'link'`: `sub` owned by another user → `#error=google_already_used`; user gone or already linked → `#error=google_failed`; else `setGoogleSub` → `#linked=google`.
- [ ] **Step 4:** `POST /auth/me/password` behind `requireUser` per Decision 21 → `200 { data: PublicUser }` with `hasPassword: true`.
- [ ] **Step 5:** Tests:
  - link happy path: password user A → `POST /auth/google/link` → `url` host `accounts.google.com`, `scope=openid`; callback (fake exchange returns `sub-1`) → `#linked=google`; then Google login with `sub-1` yields A's id (no new user).
  - `sub-1` already owned by Google-only user B → `#error=google_already_used`, A unchanged, B unchanged.
  - A already linked → `409 Google account is already linked`; guest → `401 Authentication required`; bad redirect → `400`.
  - set-password: Google-only user → `200`, `hasPassword: true`, then `POST /auth/login` with the generated username and new password → `200`; with `username: 'Nick'` → login as `nick` works; second call → `409 Password is already set`; taken username → `409 Username is already taken` and password not set; password user → `409`.
- [ ] **Step 6:** Gate, commit `feat: V4 Task 7 - account linking in both directions`.

### Task 8: OpenAPI and HTTP collection

**Files:** Modify `src/openapi/registry.ts`, regenerate `src/openapi/openapi.json`; modify `http/auth.http`, `http/jobs.http`, `http/glucose.http`, `http/blood-pressure.http`, `http/weight.http`, `http/symptoms.http`, `http/http-client.env.json`, `http/http-client.private.env.json.example`.

- [ ] **Step 1:** Registry: remove `isDemo` from entity schemas, user schema = `PublicUser`, add register/delete-me/set-password/google-link paths, Google paths with the `redirect` param and `302` responses, `401 Authentication required` on every write, `409` on register, rewrite the not-found description ("not found, or not owned by the caller").
- [ ] **Step 2:** `npm run openapi:generate`. Expected: "valid"; warning count not higher than V3's 28.
- [ ] **Step 3:** `.http` files: `auth.http` registers a random username (`{{$random.alphanumeric(8)}}`), stores the token, and contains login, me, delete-me; resource files use `{{token}}` for writes and assert guest writes → `401`. Private env example: `username`/`password` instead of `email`.
- [ ] **Step 4:** Live check against `npm run dev` (`wrangler dev --remote`) is **not** possible before the Task 9 migrations (remote DBs still have the old schema) — run the `.http` files against prod in Task 9 instead. Commit `feat: V4 Task 8 - OpenAPI and HTTP collection for multi-user auth`.

### Task 9: Deployment (only on explicit user request)

- [ ] **Step 1 (user, manual):** Google Cloud Console per updated `google-console.md`: remove `email` scope, publish app "In production" (Decision 18). Confirm no verification review is demanded.
- [ ] **Step 2 (C11 safety check):** run, for each of the five tables, `npx wrangler d1 execute <db> --remote --command "SELECT COUNT(*) FROM <table> WHERE is_demo=0"`. Expected: all `0`. **Any non-zero → stop and ask the user.**
- [ ] **Step 3:** Apply migrations: `npx wrangler d1 migrations apply auth-db --remote`, then `job-tracker-db`, then `health-monitor-db`.
- [ ] **Step 4:** Immediately `npx wrangler deploy` (the old Worker errors against the new schema in between — accepted, no real users).
- [ ] **Step 5:** `npm run db:seed` (re-inserts demo rows with `user_id NULL`).
- [ ] **Step 6:** Live verification (curl / JetBrains HTTP Client against prod): guest `GET /jobs` = 17 demo rows; guest `POST /jobs` → `401`; register → `201`; that user's `GET /jobs` → empty; create/patch/delete own job; `/docs` and `/openapi.json` → `200`; `DELETE /auth/me` → `204` then old token → `401`.
- [ ] **Step 7 (user, live):** Google sign-in through `https://platform-api.nick-burdo.workers.dev/auth/google?redirect=http://localhost:5173/auth/callback` (any local page) — browser ends on `…#token=…`; Google consent screen does **not** mention email.
- [ ] **Step 8:** Record Version ID in this plan.

### Task 10: Close-out docs

- [ ] **Step 1:** Tick this plan's checkboxes, set Status → Complete; tick roadmap V4; ADR-014 stays Accepted.
- [ ] **Step 2:** Update `docs/summary.md` to the V4 state.
- [ ] **Step 3:** Commit `docs: close out V4`.

---

# Definition of Done

- [ ] Guest: demo data read-only; every write → `401 Authentication required`.
- [ ] Register by username (no email) → token; login by username/password or Google.
- [ ] Google: scope `openid` only, account auto-created by `sub`, token delivered to allow-listed frontends only.
- [ ] Users see and change only their own data; demo invisible to them.
- [ ] `DELETE /auth/me` removes the account and all its data; old token → `401`.
- [ ] No `email`, `role`, `isDemo` anywhere in the API, code, or DB (outside migration history).
- [ ] Test suite updated and extended (U15), gate green, OpenAPI lint-clean.
- [ ] `frontend-guide.md` and `connecting-a-frontend.md` published and linked from README.
- [ ] Account linking works in both directions (U16).
- [ ] Deployed and live-verified.

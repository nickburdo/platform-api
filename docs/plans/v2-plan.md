# Version 2 — Implementation Plan

> Status: **Complete** (2026-07-02) — deployed to production, admin account bootstrapped and verified. Originally approved 2026-07-01.
> Depends on: Version 1 (`v1-plan.md`, Approved 2026-07-01)
>
> Source of truth for scope: `../roadmap.md`
> Supporting documents: `../architecture.md`, `../models.md`, `../api.md`, `../development.md`, `../deployment.md`, `../decisions.md`
>
> Goal: introduce authentication while preserving the V1 REST API surface unchanged. This is a **single-tenant, single-admin** application — there is exactly one real (non-demo) data owner. Anyone without a valid token is treated as a guest, scoped to demo data only.

This plan deviates from the literal wording of `roadmap.md`'s Version 2 checklist in two places (open self-service registration, and GUEST as a stored role) — see "Deviations from `roadmap.md`" below for why, and the Documentation Updates section for what needs to change in the docs to match.

---

# Goal

- Add a `User` concept, but only ever one row: the single admin
- `POST /auth/login` + `GET /auth/me`, JWT issued on login
- No public registration — the admin account is provisioned once via an out-of-band bootstrap script
- Guest = absence of a valid token, not a stored account or role. Guests can read/write demo data (`isDemo: true`) exactly as in V1.
- Admin (valid token) can read/write real data (`isDemo: false`)
- No authorization/role-check layer beyond "is there a valid admin token or not" — there is only one role that matters operationally

Out of scope for V2 (deferred): Google OAuth (V3), OpenAPI/Swagger (V3), multi-tenant/multiple admins, refresh tokens.

---

# Decisions

Resolved during planning discussion (2026-07-01):

1. **GUEST semantics** — GUEST is **not** a stored account or role. It is simply the absence of a valid `Authorization` header. No registration, no GUEST row in `users`, no GUEST JWT.
2. **Ownership model** — single-tenant. Exactly one admin account exists for the whole application. All `isDemo: false` records implicitly belong to that one admin. No `user_id` column is added to `job_applications` or any Health Monitor table — the existing `is_demo` flag from V1 is sufficient to separate "the admin's real data" from "everyone else's demo data."
3. **Registration** — closed. There is no `POST /auth/register` endpoint in V2. The single admin account is created once via a bootstrap script (Section 2 below), not through the public API.
4. **Token lifetime** — a single access token, no refresh token. Expiry: 30 days (long-lived is acceptable for a single personal admin; easy to shorten later if ever needed). Logout is client-side only (discard the token) — no server-side revocation/blocklist.
5. **Third database for auth** — following the "one database per domain" pattern established in V1 (Decision #11), authentication gets its own database: **`auth-db`**, containing only the `users` table (which will only ever have one row). It does not live inside `job-tracker-db` or `health-monitor-db`.
6. **Password hashing** — Web Crypto `PBKDF2` (Workers-native, no external dependency). Salted per-user, iteration count to be fixed at implementation time (e.g. 100,000+) and documented in code.
7. **JWT library** — [`jose`](https://github.com/panva/jose) (Workers-compatible, well-maintained). Payload: `sub` (user id), `role` ( always `"ADMIN"` in V2), `exp`.
8. **Admin bootstrap mechanism** — `scripts/create-admin.ts`, run manually and exactly once (or again to rotate credentials):
   - Reads `ADMIN_EMAIL` and `ADMIN_PASSWORD` from environment variables at script run time (never committed, never logged)
   - Hashes the password using the same PBKDF2 module the runtime uses for login verification
   - Writes a temporary SQL file containing an `INSERT INTO users (...)` with the **hashed** password (hashes are safe to write to a transient file; plaintext never touches disk)
   - Applies it via `wrangler d1 execute auth-db --remote --file=<temp-file>`
   - Deletes the temporary file afterward
   - Running it again with a new password performs an upsert (update the single existing row) rather than creating a second admin
9. **Token validation policy on V1 endpoints** — no `Authorization` header → treated as guest (demo scope). A header that is present but invalid/malformed/expired → `401 Unauthorized`, never a silent fallback to guest — this prevents an admin with a stale token from unknowingly writing demo data.
10. **No `authorize(role)` middleware in V2** — since there is exactly one non-guest role, "authenticated" and "is admin" are the same check. A role-based authorization layer is deferred until a real second role (e.g. multi-tenant admins) is introduced; adding it now would be unused complexity.
11. **By-id operations are demo-scoped** (plan revision, approved 2026-07-02) — V1's `findById`/`update`/`delete` repository functions filter only by `id`; V2 extends all of them (all five business repositories) with the `isDemo` filter derived from the caller's identity scope. A record outside the caller's scope behaves as nonexistent → `404`, never `403` — the existence of the other world's records is not disclosed. Without this, a guest could read/patch/delete a real record by guessing its id (and the admin could accidentally modify demo fixtures). Sections 5 and 9 updated accordingly.
12. **Implementation details fixed at planning follow-up** (2026-07-02, proposed with rationale and accepted):
    - PBKDF2: **100 000 iterations**, 16-byte random salt, 32-byte output; stored self-describing as `pbkdf2-sha256:<iterations>:<salt-b64>:<hash-b64>` so iteration count can be raised later without re-hashing existing rows (`verify` reads parameters from the stored value). After deployment, measure login CPU time on the real Worker against plan limits.
    - Emails are normalized to lowercase by the bootstrap script and at login; the unique index applies to the normalized value.
    - JWT payload gains `iat` alongside `sub`/`role`/`exp` (Decision #7).
    - `.dev.vars` is gitignored; a `.dev.vars.example` is committed.
    - Tests follow V1's layering (v1-plan Decision #22): unit tests + real-D1 repo/service/route tests in the Workers pool; `vitest.workers.config.ts` gains a `TEST_AUTH_MIGRATIONS` binding and a fixed dummy `JWT_SECRET` binding.
    - Documentation-first ordering confirmed: Section 10's `models.md`/`api.md`/`roadmap.md`/`decisions.md` updates land as their own commit **before any V2 code**; `development.md`'s bootstrap/auth-db workflow is written as-designed in the same pass; `deployment.md` additions land with the actual deployment.
13. **Code review fixes (2026-07-02, after Sections 1–7)** — a high-effort review (8 finder angles, adversarial verification) confirmed two findings and fixed both:
    - **Timing side channel in `auth.service.ts`'s `login()`** — an unknown email returned `null` immediately, skipping `verifyPassword`'s ~100k-iteration PBKDF2 entirely, while a known email with a wrong password always paid the full PBKDF2 cost. Both cases return the identical `401 Invalid credentials`, but the latency difference would let an attacker distinguish "email registered" from "email unknown" by timing `POST /auth/login` — user enumeration via a timing side channel, with no rate limiting (V1 Decision #9) to raise the cost. Fixed by always calling `verifyPassword` — against a fixed, pre-computed dummy stored hash (`DUMMY_PASSWORD_HASH`, real self-describing PBKDF2 format, no corresponding real password) when the email is unknown — so both paths pay the same PBKDF2 cost before returning `null`.
    - **SQL string interpolation in `scripts/create-admin.ts`** — the INSERT/UPDATE statement spliced `email`/`passwordHash`/timestamps/`existingId` directly into single-quoted SQL literals. Safety was incidental to `EMAIL_PATTERN` (the only externally-controlled value) rejecting quotes, not structural — a future loosening of that regex (e.g. to allow unicode domains) would reopen classic SQL injection. `wrangler d1 execute` has no parameter-binding flag (verified via `--help`), so the fix adds a `sqlStringLiteral()` helper (standard SQL string-escaping — doubles embedded single quotes) applied to every interpolated value, making safety structural rather than validation-dependent. Rewriting the bootstrap script to use the app's own Drizzle client instead of shelling out to `wrangler d1 execute` was considered and rejected: Drizzle's D1 driver requires a live `D1Database` binding only available inside a Workers/Miniflare runtime, not a plain Node script — the CLI-shell-out architecture stays, now with proper escaping.
    - Two candidates were explicitly investigated and **not** fixed: a TOCTOU race in `create-admin.ts`'s SELECT-then-INSERT/UPDATE (verifier: low severity — a human-run bootstrap script, concurrent double-invocation is unlikely, and the failure mode is a visible, self-correcting wrangler error, not silent corruption); consolidating the `and(eq(id), eq(isDemo))` pattern repeated across 5 repositories into a shared helper (verifier: marginal — 2 lines × 11 call sites, and the project has a documented precedent, Decision #28 in `v1-plan.md`, for preferring explicit per-domain code over generics when duplication is this small).

---

# Deviations from `roadmap.md`

`roadmap.md`'s Version 2 section, as written, assumes open self-registration and a stored `GUEST` role. Based on this planning discussion, V2 will instead ship as single-tenant/closed-registration/guest-as-no-token. This is a deliberate, discussed deviation, not an oversight — flagged here so it's visible, and tracked in "Documentation Updates Required" so `roadmap.md`, `models.md`, and `api.md` get corrected to describe what's actually being built.

---

# 1. Data Model Changes

Reference: `models.md`

- [x] New database `auth-db`, schema `src/db/auth/schema.ts`, with a single table:
  - `users`: `id` (UUID), `email` (unique), `password_hash`, `role` (kept as a column for schema durability / future multi-role support, but only ever set to `"ADMIN"` in V2), `created_at`, `updated_at`
  - Created: `auth-db` = `93f7916d-00b6-4e48-af2f-e9bf5bfe1cf6` (region EEUR); binding `AUTH_DB` + `migrations_dir` in `wrangler.jsonc`; `src/db/auth/client.ts` per existing pattern; `cf-typegen` regenerated (`Env` now carries `AUTH_DB` + `JWT_SECRET`); `Bindings` type in `app.ts` extended
- [x] `models.md` — update `User`/`UserRole` to reflect that `GUEST` is never a persisted value (done in the docs-first commit, see Documentation Updates)
- [x] Migration: generate via its own Drizzle config (`drizzle.auth.config.ts`), review, apply to the cloud database (`wrangler d1 migrations apply auth-db --remote`) — `0000_spotty_anthem.sql`, applied and verified via `PRAGMA table_info(users)`
- [x] No schema changes needed in `job-tracker-db` or `health-monitor-db` — the existing `is_demo` flag from V1 is sufficient for the single-tenant ownership model

---

# 2. Admin Bootstrap Script

- [x] `scripts/create-admin.ts` implementing Decision #8 (SELECT-then-INSERT/UPDATE upsert; typechecked via its own `scripts/tsconfig.json` with Node types — the root tsconfig stays Workers-only, `npm run typecheck` runs both)
- [x] Documented in `development.md` as a one-time (or credential-rotation) manual operation, run with:
  ```bash
  ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx scripts/create-admin.ts
  ```
- [x] Script validates password strength before hashing (minimum 12 characters)
- [x] Script never prints the password (hashed or plaintext) to stdout/logs
- [ ] Actually run against the cloud `auth-db` (deferred to pre-deployment verification, after routes exist to log in against)

---

# 3. Password & Token Infrastructure

- [x] `utils/password.ts` — `hashPassword` / `verifyPassword` using Web Crypto PBKDF2 per Decisions #6/#12 (100k iterations, self-describing stored format, constant-time compare) — 5 unit tests
- [x] `utils/jwt.ts` — `issueToken` / `verifyToken` using `jose`, `HS256`, 30-day expiry, claims `sub`/`role`/`iat`/`exp` — 5 unit tests
- [ ] Store `JWT_SECRET` via `wrangler secret put JWT_SECRET` (per `deployment.md`) — never committed (deferred to deployment)
- [x] Local dev: `JWT_SECRET` set via `.dev.vars` (gitignored, random value generated; `.dev.vars.example` committed; `.gitignore` gained `!.dev.vars.example`) — per V1 Decision #12, `wrangler dev --remote` still targets the real cloud databases, only the secret itself is local-only. Test runs get `TEST_AUTH_MIGRATIONS` + a dummy `JWT_SECRET` via miniflare bindings; note: the Workers pool also reports "Using secrets defined in .dev.vars" — verify which `JWT_SECRET` wins when the first test actually reads it (Section 9)

---

# 4. Validation Schemas

- [x] `auth/login` body: `email`, `password` — the only auth input schema needed (no register schema in V2) — `src/schemas/auth.schema.ts`, `.strict()` per V1 Decision #32; 5 unit tests
- [x] No client-supplied `role` anywhere — `role` is never accepted from a request body (strict schema rejects it; verified by test)

---

# 5. Repositories & Services

- [x] `users.repository.ts` (in `src/db/auth/`) — `findUserByEmail`, `findUserById`. No `create` exposed to the app runtime; creation only happens via the bootstrap script writing directly to `auth-db`. 4 repo tests.
- [x] `auth.service.ts`
  - `login(email, password)` → verify password, issue JWT (returns `null` for unknown email or wrong password alike — route maps both to the same 401)
  - `getMe(userId)` → return current user (without `passwordHash`), always read fresh from `auth-db`
  - `toPublicUser()` helper strips `passwordHash`
  - 7 service tests
- [x] Updated `job-applications.service.ts` and all four Health Monitor services:
  - Replaced the V1 placeholder (`isDemo: true` always) with an `isDemo: boolean` parameter threaded from the route through the service into `withCreateStamps`/direct inserts:
    - Guest scope (no valid admin token) → `isDemo: true` on create, filtered to `isDemo: true` on read (unchanged from V1 behavior)
    - Admin scope (valid token) → `isDemo: false` on create, filtered to `isDemo: false` on read
  - Continues rejecting any client-supplied `isDemo` in request bodies (unchanged — still `.strict()`)
  - All existing service tests updated to pass `isDemo` explicitly; cross-scope regression tests added per function
- [x] Extended `findById`/`update`/`delete` in **all five** business repositories with the `isDemo` filter (Decision #11): out-of-scope ids behave as nonexistent → `404`. Existing repo/service/route tests updated for the new signatures; a cross-scope regression test added to each repo/service test file.

---

# 6. Middleware

- [x] `resolveIdentity` middleware (`src/middleware/auth.ts`, replaces the originally-planned `authenticate` + `authorize` pair):
  - No `Authorization` header → `c.var.identity = { scope: 'guest' }`, request proceeds
  - `Bearer` header, token valid and unexpired → `c.var.identity = { scope: 'admin', userId }`, request proceeds
  - Header present but not a valid Bearer token (missing, malformed, bad signature, expired) → short-circuits with `401` (Decision #9)
- [x] Applied globally (`app.use('*', resolveIdentity)`, after `dbClients`) — Job Tracker and Health Monitor routes always run, branching on `identity.scope` via the new `scopeIsDemo(identity)` helper (also exported from `src/middleware/auth.ts`)
- [x] `GET /auth/me` additionally requires `identity.scope === 'admin'` — returns `401` otherwise; 2 unit tests for `scopeIsDemo`

---

# 7. Routes

## 7.1 Auth API

Reference: `api.md` (updated in the docs-first commit)

- [x] `POST /auth/login` → `200` + `{ data: { token, user } }` on success, generic `401` ("Invalid credentials") on wrong email or wrong password alike (never reveal which one was wrong)
- [x] `GET /auth/me` → `200` + `{ data: user }` with a valid admin token, `401` otherwise (missing token, invalid token, or token whose user row no longer exists)
- [x] `POST /auth/register` — **not implemented in V2** (Decision #3); no route registered, falls through to the global `404` handler — verified by test
- [x] `src/routes/auth.routes.test.ts` — 10 tests covering login (success, wrong password, unknown email, malformed body, unknown-key rejection) and me (valid/missing/invalid token) and the register-404 case

## 7.2 Existing V1 routes

- [x] No URL or payload contract changes
- [x] Behavior changes only in `isDemo` scoping, per Section 5 — every route (`jobs`, `glucose`, `blood-pressure`, `weight`, `symptoms`, `dashboard`) now calls `scopeIsDemo(c.var.identity)` and threads it into its service call
- [x] `api.md`'s `401` semantics were already documented in the docs-first commit (Section 10)
- [x] Authorization matrix tests added: `app.routes.test.ts` (invalid/wrong-secret token → 401 on a business endpoint, guest-as-no-token unchanged), `jobs.routes.test.ts` (admin creates/reads real data, guest and admin worlds never overlap in list/meta, cross-scope by-id → 404 both directions), `glucose.routes.test.ts` (one Health Monitor resource exercising the same cross-scope-404 + real/demo split, representative of all four)

---

# 8. Security Checklist

- [x] Password hashing: salted PBKDF2, sufficient iteration count (documented in code) — `src/utils/password.ts`, 100 000 iterations, 16-byte random salt, self-describing stored format (Decision #12)
- [x] `JWT_SECRET` stored via `wrangler secret`, never in Git; `.dev.vars` gitignored — `.dev.vars` gitignored since Section 2; production secret set via `wrangler secret put` (Section 10 deployment, confirmed by `deployment.md`'s own checklist)
- [x] Login failure responses are identical for "no such email" and "wrong password" (generic "Invalid credentials") — and now also identical in *cost* (Decision #13's timing-side-channel fix)
- [x] JWT `exp` validated on every request that presents a token — `verifyToken()` delegates to `jose`'s `jwtVerify`, which rejects expired tokens; `resolveIdentity` maps that to `401`
- [x] No plaintext password ever written to disk, logs, or the bootstrap script's temporary SQL file — only the PBKDF2 hash is ever interpolated into the transient SQL file (now via `sqlStringLiteral()`, Decision #13); the plaintext `ADMIN_PASSWORD` env var is read once and never echoed
- [x] Rate limiting on `/auth/login` — deferred (per V1 Decision #9), revisit only if this becomes an internet-facing concern beyond personal use

---

# 9. Testing

- [x] Bootstrap script creates the admin — run by the user directly (credentials never entered this session, per design); confirmed working via a successful `POST /auth/login` + `GET /auth/me` against the production `auth-db`. Re-running to rotate credentials is exercised by the script's own SELECT-then-upsert logic (Decision #8) but not independently re-verified against production — low risk, same code path either way.
- [x] Login with correct credentials → token issued
- [x] Login with wrong email / wrong password → same generic `401` in both cases
- [x] `GET /auth/me` with valid / missing / malformed token (expired-token case covered at the `verifyToken` unit level in `src/utils/jwt.test.ts`, not re-tested at the route level — same code path)
- [x] No-token request to Job Tracker/Health Monitor → demo-scoped behavior (matches V1 exactly — all pre-existing V1 route tests are anonymous requests and still pass unchanged)
- [x] Valid admin token → real-data-scoped behavior (`isDemo: false` on create, filtered reads) — `jobs.routes.test.ts`, `glucose.routes.test.ts`
- [x] Invalid/malformed/wrong-signature token on a business endpoint → `401`, not a silent guest fallback — `app.routes.test.ts`
- [x] Cross-scope by-id access (Decision #11): guest GET/PATCH/DELETE of a real record's id → `404`; admin GET/PATCH of a demo record's id → `404`
- [x] Manual verification against production via JetBrains HTTP Client (2026-07-02): `auth.http`'s Register (→404), Login (→200 + token), and `GET /auth/me` (→200, matches the logged-in admin) all confirmed working by the user against the real `auth-db`. The Admin-scoped sections in `jobs.http`/`glucose.http` (real-record create/list, cross-scope-404 both directions) were not separately re-run manually — already exhaustively covered by the 149 real-D1 authorization-matrix tests (Sections 6–7), judged sufficient rather than redundant manual re-verification.

Implementation note: the Workers test pool logs "Using secrets defined in .dev.vars" for every test file, raising the question (flagged in Section 3) of whether `.dev.vars`'s `JWT_SECRET` or the miniflare `bindings.JWT_SECRET` ('test-only-jwt-secret') wins. Empirically moot: every test that issues a token (`seedAdminAndGetToken`) and every code path that verifies one (the `resolveIdentity` middleware) both read `env.JWT_SECRET`/`c.env.JWT_SECRET` — the same binding, whichever value it resolves to — so token issue/verify stays self-consistent regardless of precedence, and the full authorization matrix (149 real-D1 tests) passes.

---

# 10. Documentation Updates Required

Per ADR-005 (docs before implementation), these should be updated before/alongside building V2. **Completed 2026-07-02 as the docs-first commit, before any V2 code (Decision #12):**

- [x] `models.md` — finalize `User` (drop the implication that `GUEST` is ever persisted; note single-tenant); document that `job_applications`/Health Monitor entities gain no new fields (ownership is single-tenant, not per-user); Demo Data and Relationships sections updated for scope semantics incl. by-id `404` (Decision #11)
- [x] `api.md` — Authentication convention section rewritten (identity resolution, 30-day HS256 JWT, 401 semantics per Decision #9); concrete request/response schemas for `/auth/login`, `/auth/me`; `/auth/register` explicitly marked not implemented; Demo Data section updated with scope rules and by-id `404`
- [x] `roadmap.md` — Version 2 section rewritten to the single-tenant, closed-registration, guest-as-no-token design, with a pointer to this plan and ADR-012
- [x] `decisions.md` — ADR-012 "Single-Tenant Authentication: Closed Registration, Guest as Absence of Token" (context / decision / rationale / consequences)
- [x] `development.md` — `scripts/create-admin.ts` bootstrap workflow, third `auth-db` row in the database table, `JWT_SECRET` per environment (`wrangler secret` / `.dev.vars` / test binding), demo-data rules updated
- [x] `architecture.md` — addition to this section's original list, approved 2026-07-02: High Level Architecture diagram gained the third database and the identity-resolution step; D1 component section now lists three databases
- [x] `deployment.md` — updated alongside the actual deployment (2026-07-02): third `auth-db` in the infrastructure diagram and `wrangler.jsonc` description, `auth-db` creation/migration commands, `JWT_SECRET` setup (non-echoing PowerShell one-liner + interactive fallback), a new Admin Bootstrap section, Authentication Verification rewritten with concrete checks, Deployment Checklist updated (all three DBs, JWT secret, auth verification)
- [x] `development.md` — Manual Testing section gained `auth.http`, the `http-client.private.env.json` pattern for admin credentials (never committed), and Admin-scoped sections added to `jobs.http`/`glucose.http` as representative resources (matching the two domains the automated authorization-matrix tests cover)

---

# Definition of Done

Adjusted from `roadmap.md`'s original wording to match the single-tenant design:

- [x] Login works; admin receives a valid JWT — verified against production by the user via `auth.http`
- [x] `GET /auth/me` works for the admin — verified against production by the user via `auth.http`
- [x] No-token requests behave exactly as V1 (demo-scoped) — unchanged V1 route tests still pass; verified against production (`GET /jobs` anonymous → 200)
- [x] Valid-admin-token requests are scoped to real (`isDemo: false`) data — `jobs.routes.test.ts`/`glucose.routes.test.ts` authorization matrix (149 real-D1 tests)
- [x] Invalid/expired tokens are rejected with `401`, never silently downgraded to guest — `app.routes.test.ts`; verified against production (garbage token on `/jobs` → 401)
- [x] Admin account is provisioned via the bootstrap script, not a public endpoint — `scripts/create-admin.ts`, run by the user directly against production; `POST /auth/register` confirmed → `404`
- [x] Documentation is updated to match the as-built design (see Section 10)

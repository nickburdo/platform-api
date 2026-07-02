# Version 2 — Implementation Plan

> Status: **Approved** (2026-07-01)
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

---

# Deviations from `roadmap.md`

`roadmap.md`'s Version 2 section, as written, assumes open self-registration and a stored `GUEST` role. Based on this planning discussion, V2 will instead ship as single-tenant/closed-registration/guest-as-no-token. This is a deliberate, discussed deviation, not an oversight — flagged here so it's visible, and tracked in "Documentation Updates Required" so `roadmap.md`, `models.md`, and `api.md` get corrected to describe what's actually being built.

---

# 1. Data Model Changes

Reference: `models.md`

- [ ] New database `auth-db`, schema `src/db/auth/schema.ts`, with a single table:
  - `users`: `id` (UUID), `email` (unique), `password_hash`, `role` (kept as a column for schema durability / future multi-role support, but only ever set to `"ADMIN"` in V2), `created_at`, `updated_at`
- [x] `models.md` — update `User`/`UserRole` to reflect that `GUEST` is never a persisted value (done in the docs-first commit, see Documentation Updates)
- [ ] Migration: generate via its own Drizzle config (`drizzle.auth.config.ts`), review, apply to the cloud database (`wrangler d1 migrations apply auth-db --remote`)
- [ ] No schema changes needed in `job-tracker-db` or `health-monitor-db` — the existing `is_demo` flag from V1 is sufficient for the single-tenant ownership model

---

# 2. Admin Bootstrap Script

- [ ] `scripts/create-admin.ts` implementing Decision #8
- [ ] Documented in `development.md` as a one-time (or credential-rotation) manual operation, run with:
  ```bash
  ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx scripts/create-admin.ts
  ```
- [ ] Script validates password strength before hashing (minimum length policy — recommend 12+ characters, since this is the single key to all real data)
- [ ] Script never prints the password (hashed or plaintext) to stdout/logs

---

# 3. Password & Token Infrastructure

- [ ] `utils/password.ts` — `hash(password)` / `verify(password, hash)` using Web Crypto PBKDF2, fixed iteration count and salt length documented as constants
- [ ] `utils/jwt.ts` — `sign(payload)` / `verify(token)` using `jose`, `HS256` with `JWT_SECRET`
- [ ] Store `JWT_SECRET` via `wrangler secret put JWT_SECRET` (per `deployment.md`) — never committed
- [ ] Local dev: `JWT_SECRET` set via `.dev.vars` (gitignored) — but per V1 Decision #12, `wrangler dev --remote` still targets the real cloud databases, only the secret itself is local-only for convenience

---

# 4. Validation Schemas

- [ ] `auth/login` body: `email`, `password` — the only auth input schema needed (no register schema in V2)
- [ ] No client-supplied `role` anywhere — `role` is never accepted from a request body

---

# 5. Repositories & Services

- [ ] `users.repository.ts` (in `src/db/auth/`) — `findByEmail`, `findById`. No `create` exposed to the app runtime; creation only happens via the bootstrap script writing directly to `auth-db`.
- [ ] `auth.service.ts`
  - `login(email, password)` → verify password, issue JWT
  - `me(userId)` → return current user (without `passwordHash`)
- [ ] Update `job-applications.service.ts` and all Health Monitor services:
  - Replace the V1 placeholder (`isDemo: true` always) with:
    - No valid admin token → forced `isDemo: true` on create, filtered to `isDemo: true` on read (unchanged from V1 behavior)
    - Valid admin token → forced `isDemo: false` on create, filtered to `isDemo: false` on read
  - Continue rejecting any client-supplied `isDemo` in request bodies
- [ ] Extend `findById`/`update`/`delete` in **all five** business repositories with the `isDemo` filter (Decision #11): out-of-scope ids behave as nonexistent → `404`. Existing repo/service/route tests updated for the new signatures.

---

# 6. Middleware

- [ ] `resolveIdentity` middleware (replaces the originally-planned `authenticate` + `authorize` pair):
  - No `Authorization` header → `context.identity = { scope: 'guest' }`, request proceeds
  - Header present, valid, unexpired → `context.identity = { scope: 'admin', userId }`, request proceeds
  - Header present but invalid/malformed/expired → short-circuits with `401 Unauthorized` (Decision #9)
- [ ] Applied globally to all Job Tracker and Health Monitor routes (they always run, they just branch on `context.identity.scope`)
- [ ] `GET /auth/me` additionally requires `context.identity.scope === 'admin'` — returns `401` if not (this is the one endpoint that's genuinely "protected" rather than "scope-branching")

---

# 7. Routes

## 7.1 Auth API

Reference: `api.md` (needs updating — see Documentation Updates)

- [ ] `POST /auth/login` → `200` + `{ data: { user, token } }` on success, generic `401` ("Invalid credentials") on wrong email or wrong password alike (never reveal which one was wrong)
- [ ] `GET /auth/me` → `200` + `{ data: { user } }` with a valid admin token, `401` otherwise
- [ ] `POST /auth/register` — **not implemented in V2** (Decision #3); `api.md` should mark this endpoint as removed/deferred rather than leaving it documented as available

## 7.2 Existing V1 routes

- [ ] No URL or payload contract changes
- [ ] Behavior changes only in `isDemo` scoping, per Section 5
- [ ] Add `401` (invalid/expired token case only, per Decision #9) to the documented possible responses for Job Tracker and Health Monitor endpoints in `api.md`

---

# 8. Security Checklist

- [ ] Password hashing: salted PBKDF2, sufficient iteration count (documented in code)
- [ ] `JWT_SECRET` stored via `wrangler secret`, never in Git; `.dev.vars` gitignored
- [ ] Login failure responses are identical for "no such email" and "wrong password" (generic "Invalid credentials")
- [ ] JWT `exp` validated on every request that presents a token
- [ ] No plaintext password ever written to disk, logs, or the bootstrap script's temporary SQL file
- [ ] Rate limiting on `/auth/login` — still deferred (per V1 Decision #9), revisit only if this becomes an internet-facing concern beyond personal use

---

# 9. Testing

- [ ] Bootstrap script creates the admin; re-running it rotates the password without creating a duplicate row
- [ ] Login with correct credentials → token issued
- [ ] Login with wrong email / wrong password → same generic `401` in both cases
- [ ] `GET /auth/me` with valid / expired / missing / malformed token
- [ ] No-token request to Job Tracker/Health Monitor → demo-scoped behavior (matches V1 exactly)
- [ ] Valid admin token → real-data-scoped behavior (`isDemo: false` on create, filtered reads)
- [ ] Expired/malformed token on Job Tracker/Health Monitor → `401`, not a silent guest fallback
- [ ] Cross-scope by-id access (Decision #11): guest GET/PATCH/DELETE of a real record's id → `404`; admin GET/PATCH of a demo record's id → `404`
- [ ] Full regression of the V1 manual collection (`http/`, JetBrains HTTP Client per v1-plan Decision #38 — supersedes this plan's original "Postman collection" wording) against the new identity-resolution layer, both with and without a token

---

# 10. Documentation Updates Required

Per ADR-005 (docs before implementation), these should be updated before/alongside building V2. **Completed 2026-07-02 as the docs-first commit, before any V2 code (Decision #12):**

- [x] `models.md` — finalize `User` (drop the implication that `GUEST` is ever persisted; note single-tenant); document that `job_applications`/Health Monitor entities gain no new fields (ownership is single-tenant, not per-user); Demo Data and Relationships sections updated for scope semantics incl. by-id `404` (Decision #11)
- [x] `api.md` — Authentication convention section rewritten (identity resolution, 30-day HS256 JWT, 401 semantics per Decision #9); concrete request/response schemas for `/auth/login`, `/auth/me`; `/auth/register` explicitly marked not implemented; Demo Data section updated with scope rules and by-id `404`
- [x] `roadmap.md` — Version 2 section rewritten to the single-tenant, closed-registration, guest-as-no-token design, with a pointer to this plan and ADR-012
- [x] `decisions.md` — ADR-012 "Single-Tenant Authentication: Closed Registration, Guest as Absence of Token" (context / decision / rationale / consequences)
- [x] `development.md` — `scripts/create-admin.ts` bootstrap workflow, third `auth-db` row in the database table, `JWT_SECRET` per environment (`wrangler secret` / `.dev.vars` / test binding), demo-data rules updated
- [ ] `architecture.md` — **flagged as a gap in this section's original list**: the High Level Architecture diagram and D1 component section must gain the third database and the identity-resolution step; to be updated alongside implementation (proposed addition, pending user confirmation)

---

# Definition of Done

Adjusted from `roadmap.md`'s original wording to match the single-tenant design:

- [ ] Login works; admin receives a valid JWT
- [ ] `GET /auth/me` works for the admin
- [ ] No-token requests behave exactly as V1 (demo-scoped)
- [ ] Valid-admin-token requests are scoped to real (`isDemo: false`) data
- [ ] Invalid/expired tokens are rejected with `401`, never silently downgraded to guest
- [ ] Admin account is provisioned via the bootstrap script, not a public endpoint
- [ ] Documentation is updated to match the as-built design (see Section 10)

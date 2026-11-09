# Versions

> This document defines the implementation roadmap for the Platform API project.
>
> Each version represents a complete, deployable milestone.
>
> Every implementation task should follow the architecture, data models and API contract described in the accompanying documentation.
>
> See also:
>
> - `architecture.md`
> - `models.md`
> - `api.md`
> - `development.md`
> - `deployment.md`
> - `decisions.md`

---

# Roadmap

```text
Version 1
        │
        ▼
Version 2
        │
        ▼
Version 3
        │
        ▼
Version 4
```

Each version should remain deployable.

Sections for Versions 1–3 describe those versions **as delivered**. Version 4 replaces their single-tenant model (one admin, `isDemo` partition, admin-only Google login) with open multi-user accounts — see ADR-014.

---

# Version 1

## Goal

Build the first production-ready REST API without authentication.

The objective of Version 1 is to establish the complete backend foundation:

- infrastructure;
- data model;
- REST API;
- database;
- validation;
- seed data;
- deployment.

---

## Infrastructure

Reference:

- architecture.md
- development.md
- deployment.md

Tasks:

- [x] Create Cloudflare Worker
- [x] Configure Wrangler
- [x] Create D1 database
- [x] Configure Drizzle ORM
- [x] Configure Zod
- [x] Configure project structure

---

## Data Models

Reference:

- models.md

Tasks:

- [x] Implement Job Tracker models
- [x] Implement Health Monitor models
- [x] Add `isDemo` support
- [x] Implement ignored records

---

## REST API

Reference:

- api.md

### Job Tracker

- [x] GET /jobs
- [x] GET /jobs/:id
- [x] POST /jobs
- [x] PATCH /jobs/:id
- [x] DELETE /jobs/:id
- [x] GET /jobs/meta

Features:

- [x] Pagination
- [x] Company filter
- [x] Status filter
- [x] Full-text search — implemented as substring `LIKE` search over `company`/`position`/`source`/`notes` (`plans/v1-plan.md` Decision #4); true FTS remains a Future Versions item

---

### Health Monitor

Implement resources:

- [x] Dashboard
- [x] Glucose
- [x] Blood Pressure
- [x] Weight
- [x] Symptoms

Each resource should support:

- [x] GET
- [x] POST
- [x] PATCH

Features:

- [x] Date filtering
- [x] Ignore / Restore

---

## Validation

Reference:

- development.md

Tasks:

- [x] Create Zod schemas
- [x] Validate body
- [x] Validate query
- [x] Validate path parameters

---

## Seed

Reference:

- development.md

Tasks:

- [x] Create Job Tracker demo data
- [x] Create Health Monitor demo data
- [x] Use `isDemo = true`

---

## Deployment

Reference:

- deployment.md

Tasks:

- [x] Configure production deployment
- [x] Configure migrations
- [x] Configure seed
- [x] Verify deployment

---

## Testing

Tasks:

- [x] Create Postman collection — replaced by a JetBrains HTTP Client collection in `http/` (`plans/v1-plan.md` Decision #38)
- [x] Verify all endpoints
- [x] Verify pagination
- [x] Verify filtering
- [x] Verify demo data

---

## Definition of Done

Version 1 is complete when:

- [x] API matches `api.md`
- [x] Models match `models.md`
- [x] CRUD is implemented
- [x] Validation is implemented
- [x] Seed is available
- [x] Deployment works
- [x] Documentation is updated

---

# Version 2

## Goal

Introduce authentication and authorization while preserving the REST API implemented in Version 1.

The primary objective is to separate guest users from authenticated users and protect real user data.

---

> Version 2 was re-scoped during planning (2026-07-01, see `plans/v2-plan.md` and ADR-012): the application was **single-tenant** — one admin account, closed registration, and "guest" means the absence of a valid token rather than a stored role. The task lists below reflect the version as delivered; the single-tenant model was superseded in Version 4 (ADR-014), while "guest = absence of a token" still holds.

## Authentication

Reference:

- architecture.md
- api.md
- decisions.md (ADR-012)
- plans/v2-plan.md

Tasks:

- [x] Create `User` model (single admin row, own `auth-db` database)
- [x] Create users table
- [x] Hash passwords (salted PBKDF2 via WebCrypto)
- [x] Admin bootstrap script (`scripts/create-admin.ts`) — registration is closed, no public register endpoint
- [x] Implement login
- [x] Generate JWT access tokens (30-day expiry)
- [x] Validate JWT (signature + expiration)

Logout is client-side only (discard the token) — no server-side revocation.

---

## Authorization

Reference:

- api.md

There is exactly one non-guest role (`ADMIN`), so "authenticated" and "is admin" are the same check — no role middleware.

Tasks:

- [x] Identity-resolution middleware: no header → guest; valid token → admin; presented-but-invalid/expired token → `401` (never a silent guest fallback)
- [x] `GET /auth/me` requires a valid admin token (`401` otherwise)

---

## Demo Data

Reference:

- models.md
- decisions.md

Tasks:

- [x] Guests (no token) read and create only demo records
- [x] Admin (valid token) reads and creates only real records
- [x] By-id operations are scope-filtered: a record outside the caller's scope returns `404`
- [x] Server manages `isDemo`

The client must never send:

```text
isDemo
```

---

## User Management

Tasks:

- [x] GET /auth/me
- [x] Login

Registration is closed (bootstrap script instead). Future endpoints such as password reset are intentionally postponed.

---

## Security

Tasks:

- [x] Validate JWT expiration on every presented token
- [x] Secure password hashing (salted PBKDF2, documented parameters)
- [x] Secure secret storage (`wrangler secret` for `JWT_SECRET`, `.dev.vars` locally)
- [x] Uniform `401 Invalid credentials` for wrong email and wrong password alike

---

## Testing

Tasks:

- [x] Bootstrap script creates/rotates the admin without duplicating rows
- [x] Login (correct and wrong credentials)
- [x] Verify JWT (valid / expired / malformed / missing)
- [x] Verify guest scoping (reads, creates, by-id `404` for real records)
- [x] Verify admin scoping (reads, creates, by-id `404` for demo records)
- [x] Full V1 regression with and without a token

---

## Definition of Done

Version 2 is complete when:

- [x] Login works; the admin receives a valid JWT
- [x] `GET /auth/me` works
- [x] No-token requests behave exactly as V1 (demo-scoped)
- [x] Admin requests are scoped to real data
- [x] Invalid/expired tokens are rejected with `401`
- [x] Documentation is updated

---

# Version 3

## Goal

Improve developer experience and authentication options, without changing the single-tenant, closed-registration model that Version 2 had established (see `plans/v3-plan.md` and ADR-013; both models were superseded in Version 4 by ADR-014).

---

## Google Authentication

Tasks:

- [x] Configure Google OAuth (Google Cloud Console app, scope `openid email` only)
- [x] Login with Google, matched against the single admin's existing email — **no new account is ever created** (ADR-013)
- [x] Issue Platform API JWT after Google authentication, identical in shape to a password-issued token

Google authentication is an additional login method for the one existing admin account, not a second way to create accounts.

JWT remains the only authentication mechanism used by the API.

---

## OpenAPI

Tasks:

- [x] Generate OpenAPI specification from the project's existing Zod schemas (standalone registry, not a route rewrite — see `plans/v3-plan.md` Decision #10)
- [x] Keep documentation synchronized
- [x] Validate specification (lint-clean)

No version prefix on endpoints (`/jobs`, `/glucose`, etc. stay as documented) — see `plans/v3-plan.md` Decision #5; revisit only if third-party integrations requiring backward-compatibility guarantees materialize.

---

## Swagger UI

Tasks:

- [x] Install Swagger UI
- [x] Serve at `/docs`, no authentication required to view
- [x] Group endpoints by resource

---

## Developer Experience

Tasks:

- [x] Improve error messages
- [x] Improve validation errors
- [x] Improve API examples

---

## Monitoring

Tasks:

- [x] Request logging (structured, with a per-request `X-Request-Id`)
- [x] Error logging
- [x] Performance monitoring (Cloudflare Analytics, confirmed in dashboard)

Cloudflare-native tooling only (Analytics, Worker Logs, D1 Metrics) — no third-party APM.

---

## Definition of Done

Version 3 is complete when:

- [x] Google Login works for the existing admin account, and only for that account
- [x] Swagger UI is available at `/docs`
- [x] OpenAPI specification is generated from Zod schemas and lint-clean
- [x] Documentation is synchronized
- [x] Production monitoring is configured across all three databases

---

# Version 4

## Goal

Turn the single-admin API into a small multi-user service: open registration by username (no email anywhere), login by password or Google, per-user data, read-only demo data for guests, and self-service account deletion. See `plans/v4-plan.md`, the design spec `superpowers/specs/2026-11-06-v4-multi-user-auth-design.md` and ADR-014 (supersedes ADR-012 and ADR-013).

---

## Tasks

Mirrors `plans/v4-plan.md`.

- [x] Docs-first pass: `api.md`, `models.md`, `architecture.md`, `decisions.md` (ADR-014), `roadmap.md`, `development.md`, `deployment.md`, `google-console.md`, `README.md`, new `frontend-guide.md` and `connecting-a-frontend.md`
- [x] `auth-db` users rebuilt (username, optional password, optional Google `sub`), tokens without roles, identity with user-existence check, `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- [x] Job Tracker per-user scope (`user_id` replaces `is_demo`, guest writes → `401 Authentication required`)
- [x] Health Monitor per-user scope (all four tables and the dashboard)
- [x] Account deletion with all data (`DELETE /auth/me`)
- [x] Google Sign-In by OpenID `sub` (scope `openid` only), account auto-created, token returned to an allow-listed frontend via the URL fragment
- [x] Account linking in both directions (`POST /auth/google/link`, `POST /auth/me/password`)
- [x] OpenAPI specification and `.http` collection updated
- [x] Deployment (only on explicit request): safety check for non-demo rows, migrations, deploy, reseed, live verification
- [x] Close-out docs

---

## Definition of Done

Version 4 is complete when:

- [x] Guests see demo data read-only; every write returns `401 Authentication required`
- [x] Registration by username (no email) returns a token; login works by username/password or Google
- [x] Google sign-in uses the `openid` scope only, creates accounts by `sub`, and delivers the token to allow-listed frontends only
- [x] Users see and change only their own data; demo data is invisible to them
- [x] `DELETE /auth/me` removes the account and all of its data; its old token returns `401`
- [x] No `email`, `role` or `isDemo` remains in the API, code or database (outside migration history)
- [x] Test suite updated and extended; gate green; OpenAPI lint-clean
- [x] `frontend-guide.md` and `connecting-a-frontend.md` are published and linked from `README.md`
- [x] Account linking works in both directions
- [x] Deployed and live-verified

---

# Version 4.2

## Goal

Keep the Health Monitor demo data looking current without manual reseeding: a daily Cron Trigger shifts all dates of the demo rows forward by whole elapsed days. See `plans/v4.2-plan.md` and ADR-015.

---

## Tasks

Mirrors `plans/v4.2-plan.md`.

- [x] Docs-first pass: `decisions.md` (ADR-015), `models.md`, `architecture.md`, `development.md`, `deployment.md`, `roadmap.md`
- [x] `demo_refresh_state` table and migration in `health-monitor-db`
- [x] `shiftDemoDates` repository function (one atomic batch, demo rows only)
- [x] `seed.sql` writes the shift state
- [x] `scheduled` entrypoint and `"0 0 * * *"` Cron Trigger
- [x] Repo test for the shift
- [ ] Deployment (only on explicit request) and live verification after the first cron run
- [ ] Close-out docs

---

## Definition of Done

Version 4.2 is complete when:

- [ ] Demo dates of all four Health Monitor tables shift daily by whole days; user rows never change
- [ ] A manual reseed resets the shift state
- [ ] Repo test green; gate green
- [ ] Docs updated
- [ ] Deployed; the first cron run verified live

---

# Version 4.3

## Goal

State the glucose unit explicitly (mmol/L) and convert the demo glucose values from mg/dL. See `plans/v4.3-plan.md`.

---

## Tasks

Mirrors `plans/v4.3-plan.md`.

- [x] Docs-first pass: `models.md`, `api.md`, `roadmap.md`
- [x] Demo glucose values in `seed.sql` converted to mmol/L
- [x] Unit stated in the OpenAPI document
- [x] `http/glucose.http` values in mmol/L
- [x] Deployment (only on explicit request): one-off production data conversion, deploy, live verification
- [x] Close-out docs

---

## Definition of Done

Version 4.3 is complete when:

- [x] Demo glucose values are in mmol/L, in `seed.sql` and in production
- [x] The unit is stated in `models.md`, `api.md` and the OpenAPI document
- [x] Gate green
- [x] Deployed and live-verified

---

# Future Versions

Possible future improvements include:

- PostgreSQL
- Redis cache
- Cloudflare Queues
- Cloudflare R2
- Background jobs
- Full-text search
- Rate limiting
- API versioning
- Webhooks
- Audit log

These features should only be implemented when justified by real requirements.

---

# Versioning Policy

Each version must satisfy the following requirements:

- Deployable
- Documented
- Tested
- Backward compatible where practical

Implementation should always follow this workflow:

```text
Architecture
        │
        ▼
Data Models
        │
        ▼
API Contract
        │
        ▼
Implementation
        │
        ▼
Testing
        │
        ▼
Deployment
```

Every completed version should update:

- `architecture.md` (if required)
- `models.md`
- `api.md`
- `development.md`
- `deployment.md`
- `decisions.md`

before implementation is considered complete.
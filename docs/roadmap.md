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
```

Each version should remain deployable.

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

- [ ] Create Cloudflare Worker
- [ ] Configure Wrangler
- [ ] Create D1 database
- [ ] Configure Drizzle ORM
- [ ] Configure Zod
- [ ] Configure project structure

---

## Data Models

Reference:

- models.md

Tasks:

- [ ] Implement Job Tracker models
- [ ] Implement Health Monitor models
- [ ] Add `isDemo` support
- [ ] Implement ignored records

---

## REST API

Reference:

- api.md

### Job Tracker

- [ ] GET /jobs
- [ ] GET /jobs/:id
- [ ] POST /jobs
- [ ] PATCH /jobs/:id
- [ ] DELETE /jobs/:id
- [ ] GET /jobs/meta

Features:

- [ ] Pagination
- [ ] Company filter
- [ ] Status filter
- [ ] Full-text search

---

### Health Monitor

Implement resources:

- [ ] Dashboard
- [ ] Glucose
- [ ] Blood Pressure
- [ ] Weight
- [ ] Symptoms

Each resource should support:

- [ ] GET
- [ ] POST
- [ ] PATCH

Features:

- [ ] Date filtering
- [ ] Ignore / Restore

---

## Validation

Reference:

- development.md

Tasks:

- [ ] Create Zod schemas
- [ ] Validate body
- [ ] Validate query
- [ ] Validate path parameters

---

## Seed

Reference:

- development.md

Tasks:

- [ ] Create Job Tracker demo data
- [ ] Create Health Monitor demo data
- [ ] Use `isDemo = true`

---

## Deployment

Reference:

- deployment.md

Tasks:

- [ ] Configure production deployment
- [ ] Configure migrations
- [ ] Configure seed
- [ ] Verify deployment

---

## Testing

Tasks:

- [ ] Create Postman collection
- [ ] Verify all endpoints
- [ ] Verify pagination
- [ ] Verify filtering
- [ ] Verify demo data

---

## Definition of Done

Version 1 is complete when:

- [ ] API matches `api.md`
- [ ] Models match `models.md`
- [ ] CRUD is implemented
- [ ] Validation is implemented
- [ ] Seed is available
- [ ] Deployment works
- [ ] Documentation is updated

---

# Version 2

## Goal

Introduce authentication and authorization while preserving the REST API implemented in Version 1.

The primary objective is to separate guest users from authenticated users and protect real user data.

---

> Version 2 was re-scoped during planning (2026-07-01, see `plans/v2-plan.md` and ADR-012): the application is **single-tenant** — one admin account, closed registration, and "guest" means the absence of a valid token rather than a stored role. The task lists below reflect the as-designed version.

## Authentication

Reference:

- architecture.md
- api.md
- decisions.md (ADR-012)
- plans/v2-plan.md

Tasks:

- [ ] Create `User` model (single admin row, own `auth-db` database)
- [ ] Create users table
- [ ] Hash passwords (salted PBKDF2 via WebCrypto)
- [ ] Admin bootstrap script (`scripts/create-admin.ts`) — registration is closed, no public register endpoint
- [ ] Implement login
- [ ] Generate JWT access tokens (30-day expiry)
- [ ] Validate JWT (signature + expiration)

Logout is client-side only (discard the token) — no server-side revocation.

---

## Authorization

Reference:

- api.md

There is exactly one non-guest role (`ADMIN`), so "authenticated" and "is admin" are the same check — no role middleware.

Tasks:

- [ ] Identity-resolution middleware: no header → guest; valid token → admin; presented-but-invalid/expired token → `401` (never a silent guest fallback)
- [ ] `GET /auth/me` requires a valid admin token (`401` otherwise)

---

## Demo Data

Reference:

- models.md
- decisions.md

Tasks:

- [ ] Guests (no token) read and create only demo records
- [ ] Admin (valid token) reads and creates only real records
- [ ] By-id operations are scope-filtered: a record outside the caller's scope returns `404`
- [ ] Server manages `isDemo`

The client must never send:

```text
isDemo
```

---

## User Management

Tasks:

- [ ] GET /auth/me
- [ ] Login

Registration is closed (bootstrap script instead). Future endpoints such as password reset are intentionally postponed.

---

## Security

Tasks:

- [ ] Validate JWT expiration on every presented token
- [ ] Secure password hashing (salted PBKDF2, documented parameters)
- [ ] Secure secret storage (`wrangler secret` for `JWT_SECRET`, `.dev.vars` locally)
- [ ] Uniform `401 Invalid credentials` for wrong email and wrong password alike

---

## Testing

Tasks:

- [ ] Bootstrap script creates/rotates the admin without duplicating rows
- [ ] Login (correct and wrong credentials)
- [ ] Verify JWT (valid / expired / malformed / missing)
- [ ] Verify guest scoping (reads, creates, by-id `404` for real records)
- [ ] Verify admin scoping (reads, creates, by-id `404` for demo records)
- [ ] Full V1 regression with and without a token

---

## Definition of Done

Version 2 is complete when:

- [ ] Login works; the admin receives a valid JWT
- [ ] `GET /auth/me` works
- [ ] No-token requests behave exactly as V1 (demo-scoped)
- [ ] Admin requests are scoped to real data
- [ ] Invalid/expired tokens are rejected with `401`
- [ ] Documentation is updated

---

# Version 3

## Goal

Improve developer experience and authentication options, without changing the single-tenant, closed-registration model from Version 2 (see `plans/v3-plan.md` and ADR-013).

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
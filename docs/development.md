# Development

> This document describes how to develop the Platform API project.
>
> It explains how to run the project locally, work with the database, add new endpoints and follow the project's development conventions.
>
> Production deployment is described separately in `deployment.md`.

See also:

- `architecture.md`
- `models.md`
- `api.md`
- `deployment.md`

---

# Purpose

This document answers the following questions:

- How do I run the project locally?
- How is the project organized?
- How do I add a new endpoint?
- How should validation be implemented?
- Where should business logic live?
- How should responses be formatted?

---

# Requirements

Development requires:

- Node.js
- npm
- Cloudflare account
- Wrangler CLI

Recommended tools:

- VS Code or WebStorm
- Git
- JetBrains HTTP Client (`.http` files in `http/`) or curl

---

# Installation

Clone the repository.

```bash
git clone <repository-url>
cd platform-api
```

Install dependencies.

```bash
npm install
```

---

# Running the API

Start the local development server:

```bash
npm run dev
```

which runs `wrangler dev --remote`. The API will be available at:

```text
http://localhost:8787
```

**There is no local database.** The dev server runs against the same two cloud D1 databases as production (`--remote`), so every record you create locally lands in the real cloud data. Since Version 4, records created through the API belong to the registered user who created them (guests cannot write); only the demo records (`user_id IS NULL`) can be reset with `npm run db:seed`, and accounts you register while developing stay in the real `auth-db` until you delete them (`DELETE /auth/me` removes an account with all of its data).

Note for Windows/PowerShell users: test non-GET requests against the dev server with `curl.exe`, not `Invoke-RestMethod` — the remote-preview proxy consistently answers PowerShell's HTTP client with `503 "worker restarted mid-request"` on POST/PATCH/DELETE.

---

# Environment Variables

Secrets must never be committed to Git.

From Version 2 the Worker requires:

```text
JWT_SECRET
```

- **Production:** `wrangler secret put JWT_SECRET`
- **Local dev:** `.dev.vars` (gitignored); copy the committed `.dev.vars.example` and fill in a value. Note: only the secret is local — `wrangler dev --remote` still targets the real cloud databases.
- **Tests:** a fixed dummy value is bound via `vitest.workers.config.ts`.

Version 3 additionally requires `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (see `google-console.md`).

Version 4 adds one **non-secret** setting, committed in `wrangler.jsonc` under `vars`:

```text
ALLOWED_FRONTEND_ORIGINS
```

A comma-separated list of frontend origins (scheme + host + port, no path, no trailing slash) that Google Sign-In may redirect back to, e.g. `https://health-monitor-new.pages.dev,https://job-tracker-new.pages.dev`. `http(s)://localhost:<any port>` and `http(s)://127.0.0.1:<any port>` are always allowed in addition. The test pool reads the same `wrangler.jsonc` value. Adding a frontend is a config edit plus a deploy — see `connecting-a-frontend.md`.

---

# Project Structure

The project is organized by responsibility. Each of the two databases owns a self-contained folder — schema, client, seed, migrations and repositories live together:

```text
src/
├── app.ts                  Hono app: middleware order, routers, error handlers
├── index.ts                Worker entrypoint
│
├── db/
│   ├── job-tracker/
│   │   ├── client.ts       Drizzle client for JOB_TRACKER_DB
│   │   ├── schema.ts
│   │   ├── seed.sql
│   │   ├── migrations/
│   │   └── *.repository.ts
│   └── health-monitor/
│       ├── client.ts       Drizzle client for HEALTH_MONITOR_DB
│       ├── schema.ts
│       ├── seed.sql
│       ├── migrations/
│       └── *.repository.ts
│
├── routes/                 One sub-router per resource
├── services/               Business logic
├── schemas/                Zod validation schemas
├── middleware/             db-inject, logging, error handling
└── utils/                  Response/validation helpers

http/                       JetBrains HTTP Client request files (manual testing)
```

Repositories are deliberately colocated with the schema and client they use (`src/db/<domain>/`), not in a top-level `repositories/` folder.

---

# Responsibility of Each Layer

## Routes

Responsible only for HTTP.

Routes should:

- read request parameters;
- validate input;
- call services;
- return HTTP responses.

Routes should not contain business logic.

---

## Services

Contain business logic.

Examples:

- calculate statistics;
- determine interview rate;
- apply demo data rules;
- normalize filters;
- validate cross-field rules.

---

## Repositories

Responsible only for database operations.

Repositories should not contain business rules.

They should only:

- execute queries;
- insert records;
- update records;
- delete records.

---

## Schemas

Contain Zod validation schemas.

Validation must exist for:

- request body;
- query parameters;
- path parameters.

---

## Middleware

Contains reusable HTTP middleware.

Examples:

- authentication;
- logging;
- error handling;
- CORS.

---

## Utils

Contains reusable helper functions.

Examples:

- pagination;
- date formatting;
- response helpers.

---

# Validation

All incoming data must be validated using Zod.

Every endpoint validates:

- request body;
- query parameters;
- path parameters.

Invalid requests must return

```http
400 Bad Request
```

Business logic should never receive invalid input.

---

# Response Format

All endpoints follow the response format described in `api.md`.

Single resource:

```json
{
    "data": {}
}
```

Collection:

```json
{
    "data": []
}
```

Paginated collection:

```json
{
    "data": [],
    "meta": {
        "page": 1,
        "limit": 20,
        "total": 73,
        "totalPages": 4
    }
}
```

Error:

```json
{
    "error": {
        "message": "Validation error",
        "details": {}
    }
}
```

---

# Database

The project uses **two independent Cloudflare D1 databases**, accessed through Drizzle ORM:

| Database | Binding | Tables |
|----------|---------|--------|
| `job-tracker-db` | `JOB_TRACKER_DB` | `job_applications` |
| `health-monitor-db` | `HEALTH_MONITOR_DB` | `glucose_measurements`, `blood_pressure_measurements`, `weight_measurements`, `symptom_entries` |
| `auth-db` (Version 2) | `AUTH_DB` | `users` (all accounts — see ADR-014) |

Each database has its own Drizzle config (`drizzle.job-tracker.config.ts`, `drizzle.health-monitor.config.ts`, `drizzle.auth.config.ts`), schema file, client and migration history. The domains never share a query.

**All database work is cloud-only.** Every `wrangler d1` command uses `--remote`; there is no `--local` SQLite emulation anywhere in the workflow. (The only exception is the disposable Miniflare-backed D1 instances that `@cloudflare/vitest-pool-workers` spins up inside test runs — those never persist.)

Database access should always go through Drizzle.

Raw SQL should only be used when Drizzle cannot express the required query.

---

# Migrations

Every database change must be implemented through migrations, generated and applied **per database**.

Workflow:

1. Update the relevant Drizzle schema (`src/db/<domain>/schema.ts`).
2. Generate the migration for that database.
3. Review the generated SQL by hand.
4. Apply it to the cloud database.

Commands:

```bash
# generate (one per database)
npx drizzle-kit generate --config drizzle.job-tracker.config.ts
npx drizzle-kit generate --config drizzle.health-monitor.config.ts

# apply to the cloud database (no local target exists)
npx wrangler d1 migrations apply job-tracker-db --remote
npx wrangler d1 migrations apply health-monitor-db --remote
```

`wrangler.jsonc` sets `migrations_dir` per D1 binding (`src/db/job-tracker/migrations`, `src/db/health-monitor/migrations`) so `wrangler d1 migrations apply` finds the right folder.

---

# Seed Data

Version 1 includes demo seed data as **plain SQL fixture files**, one per database:

- `src/db/job-tracker/seed.sql` — 17 job applications covering all 9 statuses;
- `src/db/health-monitor/seed.sql` — 10 rows in each of the four measurement tables.

Every seeded record is a demo record: `user_id` is `NULL`. Row IDs are fixed (stable across re-runs); dates are computed relative to the run time via SQLite date functions, so demo data always looks current.

Seeding is **idempotent and safe to re-run**: each file first deletes only `WHERE user_id IS NULL` rows, then re-inserts the fixtures — user data is never touched. Demo records are changed only through the seed.

Commands:

```bash
npm run db:seed                    # both databases
npm run db:seed:job-tracker
npm run db:seed:health-monitor
```

Seeding always runs against the cloud databases (`wrangler d1 execute <db> --remote --file=...`) and is always an explicit, manual command — it never runs automatically as part of deployment.

---

# Demo Data Rules

The client never controls the owner (`userId`) of a record.

The server assigns scope and ownership from the caller's identity (Version 4 — see ADR-014):

- **demo data** is exactly the rows with `user_id IS NULL`, and only the seed creates or changes them;
- **guests** (no token) read demo rows only, and cannot write at all — every write route answers `401 Authentication required`, and the check runs before body validation;
- **users** (valid token of an existing user) read and write only rows where `user_id` equals their own id, and never see demo rows;
- by-id reads and writes outside the caller's scope return `404`.

In code the scope travels as `ownerId: string | null` (`null` = demo) from the identity middleware through services into repositories; the single helper `ownerFilter(column, ownerId)` is the only place that decides between `IS NULL` and `= userId`.

---

# Accounts (Version 4)

Anyone can register through `POST /auth/register` (username + password, no email) or sign in with Google — there is no bootstrap script and no admin account. Accounts live in `auth-db`; there are no roles.

Useful during development:

- register a throw-away account from `http/auth.http` and delete it with `DELETE /auth/me` when done (this also removes its data);
- Google Sign-In locally: use `http://localhost:<port>` as the `redirect` (always allowed), e.g. `GET /auth/google?redirect=http://localhost:5173/auth/callback`.

---

# Pagination

Pagination is used only by Job Tracker.

Supported query parameters:

```text
page

limit
```

Default values:

```text
page = 1

limit = 20
```

Recommended maximum:

```text
limit <= 100
```

Offset calculation:

```text
offset = (page - 1) * limit
```

---

# Filtering

## Job Tracker

Supports:

- status
- company

Search fields:

- company
- position
- source
- notes

Example:

```http
GET /jobs?status=APPLIED&company=Google&search=frontend
```

---

## Health Monitor

Supports only:

- date_from
- date_to

Example:

```http
GET /glucose?date_from=2026-06-01&date_to=2026-06-30
```

Pagination is not used.

---

# Ignore Mechanism

Health Monitor records are never physically deleted through the public API.

Instead, they are ignored.

Example:

```http
PATCH /glucose/:id
```

```json
{
    "ignored": true,
    "reason": "Incorrect measurement"
}
```

To restore:

```json
{
    "ignored": false,
    "reason": ""
}
```

---

# Adding a New Endpoint

Every new endpoint should follow the same workflow.

1. Update `models.md`.
2. Update `api.md`.
3. Update Drizzle schema.
4. Create Zod validation schema.
5. Implement repository.
6. Implement service.
7. Implement route.
8. Add automated tests per layer and requests to the `http/` collection.

The implementation should always follow the documentation, not vice versa.

---

# Development Workflow

Every new feature should follow the same implementation order.

```text
Documentation
        │
        ▼
Data Model
        │
        ▼
API Contract
        │
        ▼
Database Schema
        │
        ▼
Validation
        │
        ▼
Repository
        │
        ▼
Service
        │
        ▼
Route
        │
        ▼
Testing
```

Documentation should always be updated before implementation.

---

# Scripts

The actual scripts in `package.json`:

```json
{
    "scripts": {
        "dev": "wrangler dev --remote",
        "cf-typegen": "wrangler types",

        "typecheck": "tsc --noEmit",
        "lint": "eslint .",
        "format": "prettier --write .",

        "test": "npm run test:unit && npm run test:repo",
        "test:unit": "vitest run",
        "test:repo": "vitest run --config vitest.workers.config.ts",

        "db:seed:job-tracker": "wrangler d1 execute job-tracker-db --remote --file=./src/db/job-tracker/seed.sql",
        "db:seed:health-monitor": "wrangler d1 execute health-monitor-db --remote --file=./src/db/health-monitor/seed.sql",
        "db:seed": "npm run db:seed:job-tracker && npm run db:seed:health-monitor"
    }
}
```

Migration generation/application runs via `npx drizzle-kit generate --config ...` and `npx wrangler d1 migrations apply <db> --remote` directly (see Migrations above); deployment via `npx wrangler deploy` (see `deployment.md`).

---

# Health Check Endpoint

The API should expose a lightweight endpoint for monitoring.

```http
GET /health
```

Example response:

```json
{
    "data": {
        "status": "ok"
    }
}
```

The endpoint should:

- not require authentication;
- not access the database unless necessary;
- return quickly.

Typical usage:

- deployment verification;
- uptime monitoring;
- load balancers;
- CI/CD smoke tests.

---

# Testing

Testing combines an automated Vitest suite (the primary safety net) with a manual `.http` request collection.

## Automated Tests (Vitest)

The suite is split into two Vitest projects:

| Command | Config | What runs |
|---------|--------|-----------|
| `npm run test:unit` | `vitest.config.ts` | Plain-Node unit tests: Zod schemas, utils (`*.test.ts`) |
| `npm run test:repo` | `vitest.workers.config.ts` | Tests inside a real `workerd` runtime against ephemeral Miniflare-backed D1: repositories (`*.repo.test.ts`), services (`*.service.test.ts`), HTTP routes via `app.request()` (`*.routes.test.ts`) |
| `npm test` | both | The full suite |

Test files are co-located next to their source. The Workers pool applies each database's migrations to its ephemeral test D1 before each test file; storage isolation is per test *file*, so shared `test-helpers.ts` modules clear the relevant tables before each test.

Route tests drive the fully wired Hono app — middleware, validation, error handlers — over real D1 bindings, asserting status codes and response envelopes.

Tests that need an authenticated caller use the helper `seedUserAndGetToken({ username?, password? })` from `src/routes/test-helpers.ts`: it inserts a user into the ephemeral `auth-db` and returns `{ userId, token, username, password }`. Cross-user isolation tests seed two users. Demo rows (`user_id IS NULL`) are inserted directly through the repositories.

## Manual Testing (JetBrains HTTP Client)

Request files live in `http/`, one per resource, with a `client.test(...)` assertion block on every request and `id` chaining from POST responses into follow-up PATCH/DELETE requests:

```text
http/
├── http-client.env.json               dev (localhost:8787) / prod environments
├── http-client.private.env.json.example   template for account credentials
├── auth.http                          Register, Login, Me, Delete account
├── health.http
├── jobs.http                          List, Details, Create, Update, Delete, Meta
├── glucose.http
├── blood-pressure.http
├── weight.http
├── symptoms.http
└── dashboard.http
```

Open a file in WebStorm, pick the environment (`dev` or `prod`) and run the requests top to bottom.

Each endpoint is covered for:

- successful request;
- validation error;
- resource not found;
- invalid identifier;
- empty result;
- guest (demo, read-only) and signed-in user (own data) behavior.

Health Monitor has no DELETE, so records created by manual runs stay in the cloud database — clean up with `npm run db:seed:health-monitor`.

### Account credentials

`auth.http` registers a throw-away account with a random username and stores `{{token}}` in the client's global variables, reused by every other file's write requests for the rest of the session. To log in to a fixed account instead, copy `http-client.private.env.json.example` to `http-client.private.env.json` (gitignored) and fill in `username`/`password` for the `prod` environment; never commit real credentials.

---

# Code Style

General principles:

- use TypeScript everywhere;
- avoid `any`;
- prefer explicit types;
- keep functions small;
- avoid duplicated logic;
- keep routes thin;
- validate every request;
- return consistent responses.

Business logic belongs in services.

Database logic belongs in repositories.

---

# Server Managed Fields

The client must never control the following fields:

```text
id

createdAt

updatedAt

userId
```

These values are generated or maintained by the server.

---

# Error Handling

Validation errors:

```http
400 Bad Request
```

Authentication errors:

```http
401 Unauthorized
```

Access denied:

```http
403 Forbidden
```

Resource not found:

```http
404 Not Found
```

Unexpected server errors:

```http
500 Internal Server Error
```

Internal implementation details should never be exposed in production responses.

---

# Logging

The application should log:

- unexpected errors;
- startup information;
- deployment information.

Sensitive information must never be logged.

Examples:

- passwords;
- JWT secrets;
- authentication tokens.

---

# Version 1 Checklist

Infrastructure

- [x] Create Cloudflare Worker
- [x] Configure Wrangler
- [x] Create both D1 databases
- [x] Configure Drizzle (one config per database)

Core

- [x] Health endpoint
- [x] Job Tracker CRUD
- [x] Health Monitor CRUD
- [x] Filtering
- [x] Pagination
- [x] Demo data support
- [x] Seed

Validation

- [x] Zod schemas
- [x] Error handling

Testing

- [x] Automated Vitest suite (unit + repositories + services + routes)
- [x] `.http` collection and manual endpoint verification

Deployment

- [x] Deploy to Cloudflare

Detailed task-level history lives in `docs/plans/v1-plan.md`.

---

# Version 2 Checklist

Authentication

- [ ] Users table
- [ ] Password hashing
- [ ] Register endpoint
- [ ] Login endpoint
- [ ] JWT issuing
- [ ] Authentication middleware
- [ ] Authorization middleware

Roles

- Superseded by Version 4: there are no roles (ADR-014)

Demo Data

- Superseded by Version 4: guests read demo data read-only; every user works only with their own data

---

# Version 3 Checklist

Authentication

- [ ] Google Login

Documentation

- [ ] OpenAPI specification
- [ ] Swagger UI

Platform

- [ ] Production monitoring
- [ ] API versioning (if required)

---

# Version 4 Checklist

Authentication

- [ ] Username accounts: `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- [ ] Google Sign-In by `sub` (scope `openid`), redirect to an allow-listed frontend
- [ ] Account linking in both directions
- [ ] Account deletion with all data (`DELETE /auth/me`)

Data

- [ ] `user_id` replaces `is_demo` on all five entities
- [ ] Guest writes return `401 Authentication required`

Documentation

- [ ] `frontend-guide.md`, `connecting-a-frontend.md`

Detailed task-level history lives in `docs/plans/v4-plan.md`.

---

# Related Documents

This document should be read together with:

- `architecture.md`
- `roadmap.md`
- `models.md`
- `api.md`
- `deployment.md`
- `decisions.md`

---

# Development Philosophy

The project follows one simple principle:

> Documentation defines the system.

Implementation follows the documentation.

When implementation and documentation diverge, the documentation should be reviewed first.

The goal is to keep architecture, API contract and implementation synchronized throughout the entire project.
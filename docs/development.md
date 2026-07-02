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

**There is no local database.** The dev server runs against the same two cloud D1 databases as production (`--remote`), so every record you create locally lands in the real cloud data. All API-created data in V1 is demo data (`isDemo: true`) and can always be reset with `npm run db:seed`.

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

Version 3 will additionally require `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

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
| `auth-db` (Version 2) | `AUTH_DB` | `users` (a single admin row — see ADR-012) |

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

Every seeded record sets `is_demo = 1`. Row IDs are fixed (stable across re-runs); dates are computed relative to the run time via SQLite date functions, so demo data always looks current.

Seeding is **idempotent and safe to re-run**: each file first deletes only `is_demo = 1` rows, then re-inserts the fixtures — non-demo data is never touched. This also makes reseeding the standard way to clean up records created during manual testing.

Commands:

```bash
npm run db:seed                    # both databases
npm run db:seed:job-tracker
npm run db:seed:health-monitor
```

Seeding always runs against the cloud databases (`wrangler d1 execute <db> --remote --file=...`) and is always an explicit, manual command — it never runs automatically as part of deployment.

---

# Demo Data Rules

The client never controls the `isDemo` field.

The server assigns it automatically from the caller's identity (Version 2 — see ADR-012):

- seed data uses `isDemo = true`;
- guest-created data (no token) uses `isDemo = true`;
- admin-created data (valid token) uses `isDemo = false`;
- reads — including by-id — are scoped the same way: records outside the caller's scope return `404`.

---

# Admin Bootstrap (Version 2)

There is no public registration. The single admin account is created (or its credentials rotated) via a one-time manual script:

```bash
ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx scripts/create-admin.ts
```

The script:

- validates password strength (minimum 12 characters — this is the single key to all real data);
- normalizes the email to lowercase;
- hashes the password with the same PBKDF2 module the runtime uses (`src/utils/password.ts`);
- writes the `INSERT`/upsert into `auth-db` via `wrangler d1 execute auth-db --remote` (re-running with a new password updates the existing row, never creates a second admin);
- never prints or persists the plaintext password.

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

## Manual Testing (JetBrains HTTP Client)

Request files live in `http/`, one per resource, with a `client.test(...)` assertion block on every request and `id` chaining from POST responses into follow-up PATCH/DELETE requests:

```text
http/
├── http-client.env.json    dev (localhost:8787) / prod environments
├── health.http
├── jobs.http               List, Details, Create, Update, Delete, Meta
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
- demo data behavior.

Health Monitor has no DELETE, so records created by manual runs stay in the cloud database — clean up with `npm run db:seed:health-monitor`.

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

isDemo
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

- [ ] ADMIN
- [ ] GUEST

Demo Data

- [ ] Guest users work only with demo data
- [ ] Admin users work with real data

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
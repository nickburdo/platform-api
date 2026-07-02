# Deployment

> This document describes how to deploy the Platform API project to Cloudflare.
>
> It covers environment preparation, database provisioning, migrations, secrets, deployment verification and rollback.
>
> Local development is described in `development.md`.

See also:

- `architecture.md`
- `development.md`
- `roadmap.md`

---

# Deployment Overview

The Platform API is deployed entirely on Cloudflare.

Infrastructure:

```text
Internet
      │
      ▼
Cloudflare Worker (platform-api)
      │
      ▼
Hono Application
      │
      ├──────────────► Cloudflare D1: job-tracker-db
      │
      ├──────────────► Cloudflare D1: health-monitor-db
      │
      └──────────────► Cloudflare D1: auth-db (V2)
```

No dedicated server is required.

Production URL: **https://platform-api.nick-burdo.workers.dev**

---

# Requirements

Deployment requires:

- Cloudflare account
- Wrangler CLI
- Project repository
- Access to Cloudflare dashboard

---

# Initial Setup

## Install dependencies

```bash
npm install
```

---

## Login to Cloudflare

```bash
wrangler login
```

Verify the current account:

```bash
wrangler whoami
```

---

# Project Configuration

The project is configured via `wrangler.jsonc`, which defines:

- Worker name (`platform-api`)
- compatibility date
- **three** D1 bindings: `JOB_TRACKER_DB` → `job-tracker-db`, `HEALTH_MONITOR_DB` → `health-monitor-db`, `AUTH_DB` → `auth-db` (V2)
- `migrations_dir` per binding (`src/db/job-tracker/migrations`, `src/db/health-monitor/migrations`, `src/db/auth/migrations`)

---

# Database

## Create the D1 Databases

All databases are created once:

```bash
npx wrangler d1 create job-tracker-db
npx wrangler d1 create health-monitor-db
npx wrangler d1 create auth-db
```

Save each generated database ID into the corresponding binding in `wrangler.jsonc`.

---

## Generate Migrations

One Drizzle config per database:

```bash
npx drizzle-kit generate --config drizzle.job-tracker.config.ts
npx drizzle-kit generate --config drizzle.health-monitor.config.ts
npx drizzle-kit generate --config drizzle.auth.config.ts
```

Review the generated SQL by hand before applying.

---

## Apply Migrations

All migrations run against the cloud databases — there is no local database in this project:

```bash
npx wrangler d1 migrations apply job-tracker-db --remote
npx wrangler d1 migrations apply health-monitor-db --remote
npx wrangler d1 migrations apply auth-db --remote
```

---

# Seed Data

Version 1 requires demo data. Seed is plain SQL, one fixture file per database, executed against the cloud:

```bash
npm run db:seed                    # both databases
npm run db:seed:job-tracker        # wrangler d1 execute job-tracker-db --remote --file=./src/db/job-tracker/seed.sql
npm run db:seed:health-monitor     # wrangler d1 execute health-monitor-db --remote --file=./src/db/health-monitor/seed.sql
```

Seed creates only demo records (`is_demo = 1`) and is idempotent: each file deletes only `is_demo = 1` rows before re-inserting, so non-demo data is never touched. Seeding is always an explicit manual command — it never runs automatically as part of deployment.

`auth-db` has no seed file — it holds exactly one row (the admin), provisioned via the bootstrap script (see Admin Bootstrap below), never via demo fixtures.

---

# Secrets

Secrets must never be stored in Git.

`JWT_SECRET` is required starting with Version 2 — set it without ever printing the value to a terminal that gets logged:

```powershell
# Windows/PowerShell: generates a random value and pipes it directly into
# wrangler; nothing is echoed
$bytes = New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes); [Convert]::ToBase64String($bytes) | npx wrangler secret put JWT_SECRET
```

or interactively (any platform — prompts for the value, still nothing echoed to scrollback):

```bash
wrangler secret put JWT_SECRET
```

Version 3 adds two more, obtained from a Google Cloud Console OAuth client (see Google Authentication below):

```bash
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
```

Local dev equivalents go in `.dev.vars` alongside `JWT_SECRET`.

---

# Admin Bootstrap (Version 2)

There is no public registration (ADR-012) — the single admin account is created directly against the cloud `auth-db` via a local script, run from the operator's own terminal so the plaintext password never appears in any shared session or log:

```bash
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=a-strong-password npx tsx scripts/create-admin.ts
```

Re-running it with a new password rotates the existing admin's credentials — it upserts the single row rather than creating a second admin (v2-plan.md Decision #8). See `development.md` for details.

---

# Google Authentication Setup (Version 3)

Google Sign-In is an additional login method for the same single admin account — it never creates a new one (ADR-013). One-time setup in [Google Cloud Console](https://console.cloud.google.com/):

1. Create (or reuse) a project, configure the OAuth consent screen.
2. Create an OAuth 2.0 Client ID (type: Web application).
3. Add both authorized redirect URIs to the **same** client:
   - `https://platform-api.nick-burdo.workers.dev/auth/google/callback` (production)
   - `http://127.0.0.1:8787/auth/google/callback` (local dev via `wrangler dev --remote`)
4. Copy the generated Client ID / Client Secret into `wrangler secret put` (above) and `.dev.vars`.

Requested scope is `openid email` only — the admin's Google account must use the same email already stored in `auth-db` (set via `scripts/create-admin.ts`); anything else is rejected with `401`, and no account is created.

---

# Build

If a build step exists:

```bash
npm run build
```

Otherwise Wrangler performs the build automatically.

---

# Deploy

Deploy the Worker:

```bash
wrangler deploy
```

A successful deployment should output:

- Worker URL
- deployment ID
- deployment status

---

# Post-Deployment Verification

Verify the following endpoints.

## Health

```http
GET /health
```

Expected:

```http
200 OK
```

---

## Job Tracker

Verify:

- GET /jobs
- GET /jobs/:id
- POST /jobs
- PATCH /jobs/:id
- DELETE /jobs/:id
- GET /jobs/meta

---

## Health Monitor

Verify:

- GET /glucose
- POST /glucose
- PATCH /glucose/:id

- GET /blood-pressure
- POST /blood-pressure
- PATCH /blood-pressure/:id

- GET /weight
- POST /weight
- PATCH /weight/:id

- GET /symptoms
- POST /symptoms
- PATCH /symptoms/:id

- GET /dashboard

---

# Authentication Verification

## Version 2

Verify:

- `POST /auth/register` → `404` (not implemented, closed registration)
- `POST /auth/login` — correct credentials → token; wrong password / unknown email → identical `401`
- `GET /auth/me` — valid token → 200; missing/invalid/expired token → `401`
- a malformed/invalid token on a business endpoint (e.g. `GET /jobs`) → `401`, never a silent guest fallback
- demo data isolation: guest and admin never see each other's records in list/meta, and cross-scope by-id access → `404`

## Version 3 — Google Sign-In

Verify:

- `GET /auth/google` → `302` redirect to Google's consent screen, with a `state` query parameter
- completing consent with the Google account matching the admin's stored email → redirected to the callback → token issued, identical shape to a password-issued token
- completing consent with a **non-matching** Google account → `401`; confirm `auth-db`'s `users` table still has exactly one row afterward
- `GET /auth/google/callback` called directly with a missing/invalid/expired `state` → `401`, without ever calling Google

---

# Deployment Checklist

Infrastructure

- [x] Wrangler configured
- [x] Worker created
- [x] All three D1 databases connected

Database

- [x] Migrations generated (per database)
- [x] Migrations applied (`--remote`, per database)
- [x] Seed executed (job-tracker-db, health-monitor-db — `auth-db` has no seed)

Secrets

- [x] JWT secret
- [ ] Google credentials (Version 3)

Verification

- [x] Health endpoint
- [x] Job Tracker
- [x] Health Monitor
- [x] Authentication (Version 2) — register/login/me/401-semantics/demo-isolation verified against production

---

# Rollback

Cloudflare Workers support deployment history.

If deployment fails:

1. Open Cloudflare Dashboard.
2. Navigate to Workers.
3. Select the previous deployment.
4. Roll back.

---

# Database Rollback

Database rollback should be performed carefully.

Preferred approach:

- restore from backup;
- or apply a corrective migration.

Deleting production data should be avoided.

---

# Monitoring

Cloudflare-native tooling only (`v3-plan.md` Decision #6) — no third-party APM.

- **Cloudflare Analytics** — Cloudflare Dashboard → Workers & Pages → `platform-api` → Metrics. Request count, error rate, CPU time, response status breakdown.
- **Worker Logs** — same Worker page → Logs (`wrangler tail` for a live stream during local verification). Every request logs one structured line (method, path, status, duration, `X-Request-Id` — Version 3) via `src/middleware/logging.ts`.
- **D1 Metrics** — Cloudflare Dashboard → D1 → each of the three databases (`job-tracker-db`, `health-monitor-db`, `auth-db`) → Metrics. Query count, rows read/written, errors, storage size.

Monitor:

- request count;
- error rate;
- response time;
- database errors, per database (all three, not just the two from V1).

A logged `X-Request-Id` lets a client-reported issue be matched to its exact server-side log line without guessing by timestamp.

---

# Production Principles

Before every deployment:

- review migrations;
- review generated SQL;
- verify environment variables;
- verify secrets.

After deployment:

- check `/health`;
- verify CRUD operations;
- inspect logs.

---

# Release Workflow

Recommended workflow:

```text
Development
      │
      ▼
Local Testing
      │
      ▼
Migration
      │
      ▼
Deploy Worker
      │
      ▼
Health Check
      │
      ▼
Smoke Tests
      │
      ▼
Production
```

---

# Disaster Recovery

If production becomes unavailable:

1. Check Worker status.
2. Check deployment logs.
3. Check D1 availability.
4. Roll back Worker if necessary.
5. Restore database if required.

---

# Related Documents

- `architecture.md`
- `development.md`
- `roadmap.md`
- `api.md`
- `models.md`
- `decisions.md`
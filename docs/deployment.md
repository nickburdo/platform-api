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
      └──────────────► Cloudflare D1: health-monitor-db
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
- **two** D1 bindings: `JOB_TRACKER_DB` → `job-tracker-db`, `HEALTH_MONITOR_DB` → `health-monitor-db`
- `migrations_dir` per binding (`src/db/job-tracker/migrations`, `src/db/health-monitor/migrations`)

---

# Database

## Create the D1 Databases

Both databases are created once:

```bash
npx wrangler d1 create job-tracker-db
npx wrangler d1 create health-monitor-db
```

Save each generated database ID into the corresponding binding in `wrangler.jsonc`.

---

## Generate Migrations

One Drizzle config per database:

```bash
npx drizzle-kit generate --config drizzle.job-tracker.config.ts
npx drizzle-kit generate --config drizzle.health-monitor.config.ts
```

Review the generated SQL by hand before applying.

---

## Apply Migrations

All migrations run against the cloud databases — there is no local database in this project:

```bash
npx wrangler d1 migrations apply job-tracker-db --remote
npx wrangler d1 migrations apply health-monitor-db --remote
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

---

# Secrets

Secrets must never be stored in Git.

Example:

```bash
wrangler secret put JWT_SECRET
```

Future secrets:

```text
JWT_SECRET

GOOGLE_CLIENT_ID

GOOGLE_CLIENT_SECRET
```

Authentication secrets are required beginning with Version 2.

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

Version 2 only.

Verify:

- register
- login
- JWT validation
- role restrictions
- demo data isolation

---

# Deployment Checklist

Infrastructure

- [x] Wrangler configured
- [x] Worker created
- [x] Both D1 databases connected

Database

- [x] Migrations generated (per database)
- [x] Migrations applied (`--remote`, per database)
- [x] Seed executed (both databases)

Secrets (Version 2 — none required in V1)

- [ ] JWT secret
- [ ] Google credentials

Verification

- [x] Health endpoint
- [x] Job Tracker
- [x] Health Monitor
- [ ] Authentication (Version 2)

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

Recommended monitoring:

- Cloudflare Analytics
- Worker Logs
- D1 Metrics

Monitor:

- request count;
- error rate;
- response time;
- database errors.

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
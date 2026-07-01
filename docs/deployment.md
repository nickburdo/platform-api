# Deployment

> This document describes how to deploy the Platform API project to Cloudflare.
>
> It covers environment preparation, database provisioning, migrations, secrets, deployment verification and rollback.
>
> Local development is described in `development.md`.

See also:

- `architecture.md`
- `development.md`
- `versions.md`

---

# Deployment Overview

The Platform API is deployed entirely on Cloudflare.

Infrastructure:

```text
Internet
      │
      ▼
Cloudflare Worker
      │
      ▼
Hono Application
      │
      ▼
Cloudflare D1
```

No dedicated server is required.

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

The project should contain:

```text
wrangler.toml
```

or

```text
wrangler.jsonc
```

depending on Wrangler version.

The configuration should define:

- Worker name
- D1 database
- compatibility date
- routes (if used)

---

# Database

## Create D1 Database

Example:

```bash
wrangler d1 create platform-api
```

Save the generated database ID.

Update Wrangler configuration with the new ID.

---

## Generate Migration

```bash
npm run db:generate
```

---

## Apply Migration (Local)

```bash
npm run db:migrate:local
```

---

## Apply Migration (Production)

```bash
npm run db:migrate:remote
```

Always verify migrations locally before applying them remotely.

---

# Seed Data

Version 1 requires demo data.

Run:

```bash
npm run db:seed
```

Seed must create only demo records.

```text
isDemo = true
```

Seed should never overwrite production data.

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

- [ ] Wrangler configured
- [ ] Worker created
- [ ] D1 connected

Database

- [ ] Migration generated
- [ ] Migration applied
- [ ] Seed executed

Secrets

- [ ] JWT secret
- [ ] Google credentials

Verification

- [ ] Health endpoint
- [ ] Job Tracker
- [ ] Health Monitor
- [ ] Authentication

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
- `versions.md`
- `api.md`
- `data-models.md`
- `decisions.md`
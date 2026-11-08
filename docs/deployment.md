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

Seed creates only demo records (`user_id IS NULL`) and is idempotent: each file deletes only `WHERE user_id IS NULL` rows before re-inserting, so user data is never touched. Seeding is always an explicit manual command — it never runs automatically as part of deployment.

`auth-db` has no seed file — accounts are created by users through `POST /auth/register` or Google Sign-In, never via fixtures.

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

# Google Authentication Setup (Version 3, revised in Version 4)

Google Sign-In creates and finds accounts by Google's stable account id (`sub`) — see ADR-014. Step-by-step Google Cloud Console setup (in Russian) lives in `google-console.md`. In short, one-time setup in [Google Cloud Console](https://console.cloud.google.com/):

1. Create (or reuse) a project, configure the OAuth consent screen with the **`openid` scope only** (no `email`), and **publish the app ("In production")** — in Testing mode only manually listed test users could sign in.
2. Create an OAuth 2.0 Client ID (type: Web application).
3. Add both authorized redirect URIs to the **same** client:
   - `https://platform-api.nick-burdo.workers.dev/auth/google/callback` (production)
   - `http://127.0.0.1:8787/auth/google/callback` (local dev — works only with the Worker in the local runtime and `"remote": true` D1 bindings, not under `wrangler dev --remote`; see `development.md`)
4. Copy the generated Client ID / Client Secret into `wrangler secret put` (above) and `.dev.vars`.

The frontends that Google may send the user back to are an application setting, not a Google Console one: `ALLOWED_FRONTEND_ORIGINS` in `wrangler.jsonc` (see `connecting-a-frontend.md`).

---

# Version 4 Deployment Procedure

Version 4 changes the schema of all three databases and the Worker code together. Deploy **only on an explicit request**, and run the steps in this order. Production has no real data yet, so a short window in which the old Worker runs against the new schema is accepted.

1. **Google Cloud Console (manual).** Per `google-console.md`: remove the `email` scope from the consent screen and publish the app ("In production"). Confirm Google does not demand a verification review.
2. **Pre-migration safety check.** The V4 migrations turn every existing business row into a public demo row (`user_id = NULL`), so first confirm there are no real (non-demo) rows. For each of the five tables run, against the cloud database:

   ```bash
   npx wrangler d1 execute job-tracker-db --remote --command "SELECT COUNT(*) FROM job_applications WHERE is_demo=0"
   npx wrangler d1 execute health-monitor-db --remote --command "SELECT COUNT(*) FROM glucose_measurements WHERE is_demo=0"
   npx wrangler d1 execute health-monitor-db --remote --command "SELECT COUNT(*) FROM blood_pressure_measurements WHERE is_demo=0"
   npx wrangler d1 execute health-monitor-db --remote --command "SELECT COUNT(*) FROM weight_measurements WHERE is_demo=0"
   npx wrangler d1 execute health-monitor-db --remote --command "SELECT COUNT(*) FROM symptom_entries WHERE is_demo=0"
   ```

   All five must return `0`. **If any is non-zero, stop** and decide with the owner what to do with those rows.
3. **Pending-migrations check.** For each database, list what is not yet applied:

   ```bash
   npx wrangler d1 migrations list auth-db --remote
   npx wrangler d1 migrations list job-tracker-db --remote
   npx wrangler d1 migrations list health-monitor-db --remote
   ```

   Each must show **only its `0001_*` migration** as pending (`0001_username_accounts.sql` for `auth-db`, `0001_user_scope.sql` for the other two). Anything else pending, or `0001_*` already applied, means the cloud state is not what this procedure assumes — **stop** and investigate.
4. **Record Time Travel bookmarks** — the restore points for a rollback. For each database run:

   ```bash
   npx wrangler d1 time-travel info auth-db
   npx wrangler d1 time-travel info job-tracker-db
   npx wrangler d1 time-travel info health-monitor-db
   ```

   Copy the three printed bookmarks (and the `time-travel restore` commands Wrangler prints with them) into `plans/v4-plan.md` **before** applying anything. Also record the currently deployed (V3) Worker **version ID** — run `npx wrangler deployments list` and copy the version ID of the latest deployment (or Cloudflare Dashboard → Workers → `platform-api` → Deployments). The rollback below targets this exact version.
5. **Apply migrations**, in this order:

   ```bash
   npx wrangler d1 migrations apply auth-db --remote
   npx wrangler d1 migrations apply job-tracker-db --remote
   npx wrangler d1 migrations apply health-monitor-db --remote
   ```

   The `auth-db` migration drops and recreates `users` **without copying rows** — the V2 admin account is removed.
6. **Deploy immediately:** `npx wrangler deploy`.

   OAuth `state` values issued by the old Worker do not verify under V4 (the format changed): a Google sign-in that was in flight across the deploy ends with `401 Invalid or expired state` on the callback, and the visitor simply starts again. Nothing needs to be done about it.
7. **Reseed** the demo rows (re-inserted with `user_id = NULL`): `npm run db:seed`.
8. **Live verification** (curl or the JetBrains HTTP collection against production):
   - guest `GET /jobs` returns the 17 demo rows; guest `POST /jobs` → `401 Authentication required`;
   - `POST /auth/register` → `201`; that user's `GET /jobs` is empty; create, patch and delete an own job;
   - `/docs` and `/openapi.json` → `200`;
   - `DELETE /auth/me` → `204`, then the old token → `401`.

   **Running the `.http` collection against production creates real throwaway accounts** in `auth-db` (`http/auth.http` registers one for `{{token}}` on every run; its own delete-me flow removes only the separate `{{deleteToken}}` account). After the run, delete the leftover accounts with `DELETE /auth/me` using their tokens (the delete-me requests in `auth.http` show how) — that also removes any data they created.
9. **Google sign-in (manual).** Open `https://platform-api.nick-burdo.workers.dev/auth/google?redirect=http://localhost:5173/auth/callback` in a browser: it ends on `…#token=…`, and Google's consent screen does not mention email.
10. Record the deployed Version ID in `plans/v4-plan.md` (next to the bookmarks from step 4).

**V4 rollback.** A code rollback alone is not enough: the V3 Worker cannot work on the V4 schema. Roll back **both**, using the bookmarks recorded in step 4:

```bash
npx wrangler d1 time-travel restore auth-db --bookmark=<auth-db bookmark from step 4>
npx wrangler d1 time-travel restore job-tracker-db --bookmark=<job-tracker-db bookmark from step 4>
npx wrangler d1 time-travel restore health-monitor-db --bookmark=<health-monitor-db bookmark from step 4>
npx wrangler rollback <V3 version ID from step 4>
```

Always pass the version ID: a bare `npx wrangler rollback` returns to the *previous* deployment, which is no longer V3 if anything was deployed after step 6. Time Travel can restore a database to any point within the last 30 days (Workers Free plan: 7 days), so a rollback must happen inside that window.

All three databases must be restored — restoring only some leaves a mix of V3 and V4 schemas. A restore overwrites the database in place (anything written after the bookmark, including accounts registered on V4, is lost) and prints a bookmark that undoes it.

---

# Version 4.2 Deployment Procedure (Demo Date Shift)

Version 4.2 adds a Cron Trigger and one table in `health-monitor-db` (ADR-015). The trigger is declared in `wrangler.jsonc` and registered by `npx wrangler deploy` — **no Cloudflare Dashboard setup is needed**:

```jsonc
"triggers": {
  "crons": ["0 0 * * *"], // daily at 00:00 UTC
},
```

Trigger changes take up to 15 minutes to propagate after a deploy. Workers Free allows 5 Cron Triggers per account; this project uses 1. To disable the trigger, set `"crons": []` and run `npx wrangler deploy` (or `npx wrangler triggers deploy`) — commenting out the key does **not** remove a deployed trigger. Triggers are not part of a Worker version, so `wrangler rollback` does not change them either.

Deploy **only on an explicit request**, in this order:

1. **Restore points.** Record a Time Travel bookmark (`npx wrangler d1 time-travel info health-monitor-db`) and the current Worker version ID (`npx wrangler deployments list`) in `plans/v4.2-plan.md`.
2. **Migration:** `npx wrangler d1 migrations apply health-monitor-db --remote` — creates `demo_refresh_state`. The old Worker ignores the table.
3. **Reseed:** `npm run db:seed:health-monitor` — fresh demo dates and the first `demo_refresh_state` row. Until this row exists the cron does nothing.
4. **Deploy:** `npx wrangler deploy`; record the new Version ID in the plan.
5. **Live check right away:** guest `GET /dashboard` → `200` with demo data; `npx wrangler d1 execute health-monitor-db --remote --command "SELECT * FROM demo_refresh_state"` → one row.
6. **Live check after the first 00:00 UTC run:** the run is visible in the Worker logs (`"event":"demo-date-shift"`), and `refreshed_at` has advanced by whole days — or stayed the same, if less than 24 h passed since step 3.

**V4.2 rollback.** Cron Triggers are not part of a Worker version: `wrangler rollback` leaves them in place, and the old version has no `scheduled` handler, so every nightly run would fail. Remove the trigger first, then roll back the code:

```bash
# 1. in wrangler.jsonc set  "triggers": { "crons": [] }
npx wrangler triggers deploy
# 2. roll back the code
npx wrangler rollback <version ID from step 1>
```

`npm run db:seed:health-monitor` restores the demo rows; the bookmark from step 1 is the fallback if user rows were affected. The extra table can stay.

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
npx wrangler deploy
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

## Accounts and data scope (Version 4)

Verify:

- `POST /auth/register` → `201` with token and user; the same username in another case → `409 Username is already taken`
- `POST /auth/login` — correct credentials → token; wrong password / unknown username / Google-only account → identical `401 Invalid credentials`
- `GET /auth/me` — valid token → `200`; no token → `401 Authentication required`; invalid/expired token → `401 Invalid or expired token`
- a malformed/invalid token on a business endpoint (e.g. `GET /jobs`) → `401`, never a silent guest fallback
- guest writes (valid or invalid body) → `401 Authentication required`
- data isolation: a guest sees only demo rows, a user sees only their own rows, cross-scope by-id access → `404`
- `DELETE /auth/me` → `204`; the old token afterwards → `401 Invalid or expired token`

## Google Sign-In (Version 3, revised in Version 4)

Verify:

- `GET /auth/google?redirect=<allowed frontend URL>` → `302` to Google's consent screen with `scope=openid` and a `state` parameter; a missing or non-allowlisted `redirect` → `400`, no redirect
- completing consent → `302` to `<redirect>#token=…` (a new account is created on the first sign-in; the consent screen does not mention email)
- cancelling on Google's screen → `302` to `<redirect>#error=access_denied`
- `GET /auth/google/callback` called directly with a missing/invalid/expired `state` → `401 Invalid or expired state`, without ever calling Google

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
- [ ] Version 4: non-demo row count verified `0`, only `0001_*` pending in each database (`migrations list --remote`), Time Travel bookmarks of all three databases recorded, migrations applied in order (`auth-db`, `job-tracker-db`, `health-monitor-db`), demo rows reseeded

Secrets

- [x] JWT secret
- [ ] Google credentials (Version 3)
- [ ] Google Console: `email` scope removed, app published "In production" (Version 4)

Verification

- [x] Health endpoint
- [x] Job Tracker
- [x] Health Monitor
- [x] Authentication (Version 2) — login/me/401-semantics/demo-isolation verified against production
- [ ] Authentication (Version 4) — register/login/me/delete-account, guest `401` on writes, per-user isolation verified against production; throwaway accounts from the `.http` run deleted

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

- restore from backup — D1 Time Travel (`npx wrangler d1 time-travel restore <db> --bookmark=<bookmark>`, bookmarks from `npx wrangler d1 time-travel info <db>` taken before the change);
- or apply a corrective migration.

When a release changes the schema together with the code (as Version 4 does), a database restore and `npx wrangler rollback` must be done together — see "V4 rollback" in the Version 4 Deployment Procedure.

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
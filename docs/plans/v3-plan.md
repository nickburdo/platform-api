# Version 3 — Implementation Plan

> Status: **Approved** (2026-07-01)
> Depends on: Version 2 (`v2-plan.md`, Approved 2026-07-01)
>
> Source of truth for scope: `../roadmap.md`
> Supporting documents: `../architecture.md`, `../models.md`, `../api.md`, `../development.md`, `../deployment.md`, `../decisions.md`
>
> Goal: improve developer experience and add an alternative login method, without changing the core authentication mechanism (JWT remains the only mechanism the API itself trusts) and without changing the single-tenant, closed-registration model established in V2.

---

# Goal

- Google OAuth as an additional login method for the **single existing admin account** — not a second way to create new accounts
- Generated OpenAPI specification, derived from the project's existing Zod schemas
- Swagger UI published for interactive API exploration
- Improved error messages / validation errors / API examples
- Basic production monitoring using Cloudflare-native tooling

---

# Decisions

Resolved during planning discussion (2026-07-01), extending the single-tenant/closed-registration model from V2:

1. **Account linking / Google login model** — Google login is matched against the single admin's existing `email` in `auth-db` (case-insensitive exact match). If the Google account's email doesn't match, the login is rejected — **no new account is ever auto-created**, consistent with V2's closed-registration decision. This means:
2. **`passwordHash` stays required, no schema change** — the admin account always exists first (created via `scripts/create-admin.ts` with a password, per the V2 plan). Google is purely an additional login method for that same, already-provisioned account — never a Google-only signup path.
3. **OpenAPI generation approach** — generated from the project's existing Zod schemas (e.g. via `zod-to-openapi` or equivalent), not hand-written. Consistent with the "type safety throughout the stack" principle in `architecture.md` — the spec is derived from the same schemas that actually validate requests, so it can't silently drift from real behavior the way a hand-maintained YAML file could.
4. **Swagger UI hosting** — served from the same Worker, at `/docs`. No separate static deployment.
5. **API versioning** — no version prefix. Endpoints stay exactly as documented today (`/jobs`, `/glucose`, etc.). Revisit only if/when third-party integrations requiring backward compatibility guarantees actually materialize (`architecture.md` already lists "Future third-party integrations" as a supported client category, but none exist yet).
6. **Monitoring backend** — Cloudflare-native only (Analytics, Worker Logs, D1 Metrics), as already recommended in `deployment.md`. No third-party APM (e.g. Sentry) — not mentioned anywhere in the docs and would be new, unjustified scope per "simplicity first."

---

# 1. Google Authentication

Reference: `roadmap.md`, `architecture.md`, `v2-plan.md`

- [ ] Register OAuth application in Google Cloud Console, obtain `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- [ ] Store secrets via `wrangler secret put` (per `deployment.md`); document local dev equivalents in `.dev.vars`
- [ ] Implement OAuth flow:
  - [ ] `GET /auth/google` — redirects to Google's consent screen
  - [ ] `GET /auth/google/callback` — exchanges the code for the Google profile (email), looks up `users` in `auth-db` by email (case-insensitive)
    - Match found → issue a Platform API JWT identical in shape to a password-login token (same `sub`, `role: "ADMIN"`, `exp`)
    - No match → reject (e.g. `401` or a redirect to an error state) — **do not create a new user**
- [ ] Ensure Google-issued tokens are indistinguishable in shape from password-login tokens — the `resolveIdentity` middleware from V2 requires zero changes
- [ ] Update `api.md`: document the new Google auth endpoints, request/response/redirect behavior, and the "no matching account → rejected" rule

---

# 2. OpenAPI Specification

Reference: `decisions.md` (ADR-011)

- [ ] Add OpenAPI metadata (summary, description, tags) to the existing Zod schemas from `schemas/` (V1) without changing their validation behavior
- [ ] Generate `openapi.json` covering:
  - [ ] Health
  - [ ] Job Tracker (all endpoints + `/jobs/meta`)
  - [ ] Health Monitor (all 4 resources + dashboard)
  - [ ] Auth (login, me, Google flow)
- [ ] Include documented error responses (`400`, `401`, `404`, `500`) with the project's actual error envelope shape — no `403` anywhere, per V2's single-role model
- [ ] Add a spec-lint validation step (e.g. `@redocly/cli` or similar) so the generated spec is checked for internal consistency
- [ ] Cross-check the generated spec against `api.md`; `api.md` remains the human-authored source of truth until ADR-011 is promoted from "Planned" to "Accepted"

---

# 3. Swagger UI

- [ ] Install a Hono-compatible Swagger UI integration (e.g. `@hono/swagger-ui`)
- [ ] Serve at `/docs` (Decision #4)
- [ ] Group endpoints by resource (Health, Job Tracker, Health Monitor, Auth), matching the existing doc structure
- [ ] `/docs` itself requires no authentication to view; "try it out" calls against real endpoints still need a real admin token to hit the real-data scope

---

# 4. Developer Experience Improvements

- [ ] Audit all error messages across V1/V2 endpoints for consistent wording and a consistently structured `details` field (per V1 Decision #7 — Zod's flattened field-error map)
- [ ] Improve validation error messages to be field-specific and human-readable (e.g. `"salaryMin must be less than or equal to salaryMax"` rather than a raw Zod path dump)
- [ ] Expand `api.md` examples: at least one example per error case (`400`/`401`/`404`) per resource, not just happy-path examples
- [ ] Review and tighten any inconsistent response shapes surfaced while generating the OpenAPI spec (this process tends to expose small inconsistencies)

---

# 5. Monitoring

Reference: `deployment.md`, Decision #6

- [ ] Structure Worker logs consistently (method, path, status, duration, request ID), extending the V1 logging middleware
- [ ] Add a request ID (UUID per request) propagated through logs for traceability
- [ ] Confirm Cloudflare Analytics is enabled for the Worker in the dashboard
- [ ] Confirm D1 metrics are visible for all three databases (`job-tracker-db`, `health-monitor-db`, `auth-db`)
- [ ] Document, in `deployment.md`, how to access these dashboards operationally
- [ ] Error logging: unhandled exceptions logged server-side with enough context to debug, while client responses stay generic (per V1's "never leaks internals" rule)

---

# 6. Testing

- [ ] Google OAuth flow: login with an email matching the existing admin → token issued, identical shape to password login
- [ ] Google OAuth flow: login with a non-matching email → rejected, no user created (verify `auth-db`'s `users` table still has exactly one row afterward)
- [ ] OpenAPI spec: lint-clean, spot-checked against live responses
- [ ] Swagger UI: all endpoints listed, grouped correctly, schemas render, `/docs` reachable without auth
- [ ] Monitoring: verify logs appear in the Cloudflare dashboard after a deployed request, for all three D1 databases

---

# 7. Documentation Updates Required

- [ ] `api.md` — Google auth endpoints (including the "no matching account → rejected" behavior), expanded examples, error cases
- [ ] `decisions.md` — update ADR-011 status from "Planned" to "Accepted" once OpenAPI generation is implemented; add a new ADR for "Google login as an additional method for the single admin account, no new-account creation" since it extends the significant V2 single-tenant decision
- [ ] `deployment.md` — monitoring dashboard access instructions; note the three D1 databases now being monitored
- [ ] `roadmap.md` — Version 3's checklist currently doesn't mention the single-tenant constraint on Google login or the no-versioning decision; update to match

---

# Definition of Done

Adjusted from `roadmap.md`'s original wording to match the single-tenant design:

- [ ] Google Login works for the existing admin account, and only for that account
- [ ] Swagger UI is available at `/docs`
- [ ] OpenAPI specification is generated from Zod schemas and lint-clean
- [ ] Documentation is synchronized (Section 7)
- [ ] Production monitoring is configured across all three databases

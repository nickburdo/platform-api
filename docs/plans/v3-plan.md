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

Resolved during a planning follow-up (2026-07-03), filling in implementation gaps the initial approval left open:

7. **Google token exchange via raw `fetch`, no OAuth library** — two calls (`POST https://oauth2.googleapis.com/token` for the code→token exchange, `GET https://www.googleapis.com/oauth2/v2/userinfo` for the email) using the platform `fetch`. Consistent with the project's dependency discipline: `jose` was added in V2 because rolling JWT *signing* is genuine, security-sensitive crypto; an OAuth2 authorization-code exchange is just two documented HTTP calls with no cryptography of its own, so a library (`@hono/oauth-providers` or similar) would trade a small amount of boilerplate for a new dependency and less control over the `state`/CSRF handling in Decision #8.
8. **CSRF protection for the OAuth redirect via a signed, storageless `state`** — `GET /auth/google` issues a short-lived (10 minute) JWT as the `state` query param, signed with the existing `JWT_SECRET` via the already-installed `jose`, carrying a random nonce and `purpose: 'oauth_state'` (distinguishing it by claim from a real access token, not by using a different key — the standard way JWTs disambiguate token types). `GET /auth/google/callback` verifies `state` the same way `resolveIdentity` verifies access tokens; failure (missing, invalid, expired, wrong `purpose`) rejects the callback before any Google API call is made. No server-side session/nonce storage needed, consistent with the stateless architecture from V2.
9. **Google OAuth consent scope is minimal: `openid email`** — no `profile` scope. Decision #1 matches purely on email; requesting name/picture would be unused data collection with a larger consent-screen footprint for no benefit.
10. **OpenAPI generation via a standalone generator (`@asteasolutions/zod-to-openapi`), not `@hono/zod-openapi`** — the existing ~25 routes across V1+V2 (plain `Hono` + `@hono/zod-validator`, per v1-plan.md Decision #31) are untouched. Each schema already in `src/schemas/` is additionally registered in a new, separate OpenAPI registry (metadata only: summary/description/tags), and a build step assembles `openapi.json` from that registry. `@hono/zod-openapi` was rejected: it requires replacing `Hono` with `OpenAPIHono` and rewriting every route's registration to its `.openapi(routeDef, handler)` form — a full rewrite of a working, tested routing layer, for a benefit (spec/validation always in sync) not worth the blast radius here.
11. **Google OAuth network calls are tested behind an isolated seam, not skipped** — the code→token and token→profile `fetch` calls live in one function (e.g. `src/services/google-oauth.service.ts`'s `exchangeGoogleCode()`), injected into the route handler rather than called inline, so tests can substitute a fake implementation while every other layer (email lookup in `auth-db`, JWT issuance, the "no match → reject, no user created" invariant) is exercised exactly as V1/V2 test the rest of the app: unit/service tests with real D1 via `@cloudflare/vitest-pool-workers`, no mocking of business logic — only the literal external network boundary is substituted.
12. **Request ID**: `crypto.randomUUID()` generated once per request in the logging middleware, included in the structured log line, and echoed back to the client via an `X-Request-Id` response header — gives a client-reportable correlation id for support/debugging without adding any new dependency.
13. **Documentation-first ordering, mirroring V2 Decision #12** — Section 7's `api.md`/`decisions.md`/`deployment.md`/`roadmap.md` updates land as their own commit before any V3 code, for the whole version (not just Section 1). Implementation then starts with Section 2 (OpenAPI) rather than Section 1 (Google Auth), since Section 1 is blocked on the user completing Google Cloud Console setup (registering an OAuth app, obtaining `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, whitelisting both `https://platform-api.nick-burdo.workers.dev/auth/google/callback` and `http://127.0.0.1:8787/auth/google/callback` as authorized redirect URIs on the same OAuth client) — an external, manual prerequisite outside engineering control. Sections 2–5 have no such dependency.

Resolved during Section 2 implementation kickoff (2026-07-03), filling in library-level details the plan text left implicit:

14. **Schema metadata via `.openapi()`, not Zod v4's native `.meta()`** — `@asteasolutions/zod-to-openapi` v8+ (required for Zod v4 support; v7.3.4 is the last Zod-v3-only release) supports both. `.openapi()` requires one call to `extendZodWithOpenApi(z)`, which mutates Zod's global prototype — but that call lives only inside `src/openapi/registry.ts` / `scripts/generate-openapi.ts`, a standalone generation script never imported by the running Worker, so it has no runtime effect on the deployed app, existing routes, or existing tests. Matches the plan's original wording and the library's own primary documentation path.
15. **OpenAPI target version: 3.0.x, via `OpenApiGeneratorV3`** — broadest, most mature support in `@hono/swagger-ui` (Section 3) and `@redocly/cli` (Section 2's spec-lint step), both of which have long-standing 3.0.x support. 3.1.x was considered (tighter JSON Schema alignment) but rejected as unnecessary risk for a first OpenAPI rollout; revisit only if 3.0.x's JSON Schema subset proves limiting in practice.
16. **Generated `openapi.json` lives at `src/openapi/openapi.json`**, not `docs/openapi.json` — Cloudflare Workers have no runtime filesystem access, so whatever Section 3's `/docs` route serves must be bundled in at build time. Colocating it with `registry.ts` under `src/` lets Section 3 `import` it directly as a JSON module with no cross-folder import or extra copy step; `api.md` under `docs/` remains the authoritative human-readable reference regardless of where the generated artifact lives.

Resolved during code review follow-up (2026-07-03), fixing a gap the initial Section 2 implementation left open:

17. **`extendZodWithOpenApi(z)` moved to its own module (`src/openapi/extend-zod.ts`), imported first in `registry.ts`** — confirmed empirically that Zod v4 does not retroactively grant `.openapi()` to schema instances already constructed before the patch runs; only schemas created afterward pick it up. Since ES modules evaluate imports in declaration order, calling `extendZodWithOpenApi(z)` inside `registry.ts`'s own body (after its `src/schemas/*.ts` imports had already evaluated) meant those imported schemas never actually got `.openapi()` — silently defeating Decision #14's original intent to wrap them. Importing the dedicated `extend-zod.ts` module first guarantees the patch is in place before any schema file evaluates.

Resolved during Section 3 code review follow-up (2026-07-03), formalizing a design choice the initial implementation checked off without a corresponding Decision:

18. **The generated spec is served at its own public route, `GET /openapi.json`, rather than embedded directly into `/docs` via `swaggerUI({ spec: ... })`** — `@hono/swagger-ui` supports both: `{ url }` has the browser fetch the spec from a separate endpoint; `{ spec }` inlines the document into the rendered page with no second route. Chose `{ url }` because a standalone, stably-addressable `/openapi.json` is what external tooling actually expects — codegen (openapi-generator, orval), Postman/Insomnia's "import by URL," contract testing, and any future API gateway all fetch a spec from a URL, not scrape it out of a UI page's embedded JS. This also matches how most public REST APIs publish their spec (independently of whichever UI renders it) and keeps `api.md`'s own framing of the generated spec as a standalone artifact ("the future OpenAPI specification"), not merely fuel for one widget. The tradeoff — one more public, unauthenticated route — is accepted: it exposes no sensitive data (documentation of an already-public API surface, no secrets), so the added discoverability has no real security cost.
19. **Swagger UI's asset version pinned to `5.32.8`** (`swaggerUI({ version: '5.32.8' })`), rather than left unset — unset floats to whatever `swagger-ui-dist` version jsdelivr currently resolves as "latest," meaning `/docs`'s rendered behavior could silently change on a future page load with no corresponding code change, and would render blank with no server-side signal if the CDN were ever unreachable at exactly the unpinned latest tag. Pinning makes `/docs`'s rendering fully reproducible and deploy-tied, matching how the rest of this feature (the spec itself) is already build-time-deterministic (Decision #16). `GET /openapi.json`'s response is also now pre-serialized once at module scope (`JSON.stringify` at import time, not per request) rather than re-stringified via `c.json()` on every request — the document is immutable for the life of the deployment, so this is free to do and avoids repeated work on a hot-ish path.

Resolved during Section 1 implementation (2026-07-03):

20. **`GET /auth/google`'s `redirect_uri` is derived from the incoming request's own origin (`new URL(c.req.url).origin`), not a configured base-URL env var** — necessary given Decision #13's dual-whitelist setup (prod and local-dev host on the same OAuth client): whichever host actually received the request is the one Google must redirect back to. **Discovered empirically while verifying live**: under this project's `npm run dev` (`wrangler dev --remote`), the request's origin as seen inside the Worker resolves to the production host (`https://platform-api.nick-burdo.workers.dev`), not `http://127.0.0.1:8787` — because `--remote` runs the Worker on Cloudflare's edge under the same `workers.dev` identity as production (this project has no separate custom domain), consistent with `.dev.vars.example`'s existing note that `wrangler dev --remote` always targets real cloud D1, never a local emulation. Practical consequence: a full click-through of the Google consent screen during `npm run dev` redirects to whatever is actually deployed to production, not the local dev session — so end-to-end verification of Section 1 requires a real deployment, which is why Section 1 was verified by deploying rather than via `wrangler dev --remote` alone. The `http://127.0.0.1:8787/auth/google/callback` redirect URI registered with Google (Decision #13) remains harmless to keep whitelisted (e.g. for a possible future fully-local `wrangler dev` without `--remote`), but is not exercised by the current dev workflow.
21. **The two Google-callback 401 cases use distinct, generic messages** — "Invalid or expired state" when CSRF-state verification fails (before any call to Google), "Invalid credentials" when the state is valid but the exchange fails or the returned email has no matching admin (matching `POST /auth/login`'s wording for the equivalent "authenticated, but no valid account" outcome). Neither message discloses which sub-case occurred beyond what's already inherent to timing (state failures never reach Google), consistent with the project's existing no-enumeration posture.
22. **Google's `verified_email` field is checked defensively** — `exchangeGoogleCode` rejects (throws) if the userinfo response has no `email` or explicitly reports `verified_email: false`. Not discussed in the original Decisions, added as cheap defense-in-depth: this admin account belongs to a personal Gmail address that will always report a verified email in practice, so this never fires in the expected path, but costs nothing to check.

---

# 1. Google Authentication

Reference: `roadmap.md`, `architecture.md`, `v2-plan.md`. **Blocked** on the user completing Google Cloud Console setup (Decision #13) — start here once `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` exist.

- [x] Register OAuth application in Google Cloud Console (user action): consent screen, OAuth client, both redirect URIs whitelisted (Decision #13), scope `openid email` (Decision #9)
- [x] Store secrets: `wrangler secret put GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (production); `.dev.vars.example` gains both keys (local dev)
- [x] `src/utils/oauth-state.ts` — `issueOAuthState(jwtSecret)` / `verifyOAuthState(token, jwtSecret)`: signed, storageless `state` per Decision #8 (`jose`, 10-minute expiry, random nonce, `purpose: 'oauth_state'` claim); unit tests (issue→verify round-trip, expired, wrong purpose, tampered) — `src/utils/oauth-state.test.ts`
- [x] `src/services/google-oauth.service.ts` — `exchangeGoogleCode(code, env, redirectUri)`: raw `fetch` to `oauth2.googleapis.com/token` then `www.googleapis.com/oauth2/v2/userinfo` (Decision #7), returns `{ email }`, rejects on an unverified/missing email (Decision #22); isolated as its own function so tests can substitute a fake (Decision #11) — unit-tested with a stubbed `fetch` in `src/services/google-oauth.test.ts` (named without the `.service.` infix so it runs under plain Node vitest, not the D1-backed Workers pool it has no need for)
- [x] `src/routes/auth.routes.ts` additions:
  - [x] `GET /auth/google` — issues `state`, redirects (302) to Google's consent screen with `client_id`, `redirect_uri` (derived from the request's own origin — Decision #20), `scope=openid email`, `state`
  - [x] `GET /auth/google/callback` — verifies `state` first (reject before calling Google on failure); calls `exchangeGoogleCode()`; looks up `users` in `auth-db` by the returned email (case-insensitive, via the new `loginWithGoogle()` in `auth.service.ts`, reusing `findUserByEmail`)
    - Match found → issue a Platform API JWT identical in shape to a password-login token (same `sub`, `role: 'ADMIN'`, `exp`, via the existing `issueToken()`)
    - No match → reject (`401`) — **do not create a new user**; verified in tests that `auth-db`'s `users` table still has exactly one row afterward
  - Orchestration logic extracted to an exported plain function, `resolveGoogleCallback(params, deps)`, taking `exchange` as an explicit dependency (Decision #11) rather than a Hono-`Context`-typed factory — avoids fighting `@hono/zod-validator`'s type inference and makes the function trivially unit-testable against real D1 with a faked `exchange`
- [x] Confirm Google-issued tokens are indistinguishable in shape from password-login tokens — the `resolveIdentity` middleware from V2 requires zero changes (unchanged; `loginWithGoogle` calls the same `issueToken()` as `login()`)
- [x] Update `api.md`: document the new Google auth endpoints, request/response/redirect behavior, `state` semantics, and the "no matching account → rejected" rule — already covered by the Section 7 doc-first pass (Decision #13); verified the implementation matches, no changes needed

---

# 2. OpenAPI Specification

Reference: `decisions.md` (ADR-011), Decision #10 (standalone generator, no route rewrite), Decisions #14–16 (library/version/output-path details resolved at implementation kickoff)

- [x] Add `@asteasolutions/zod-to-openapi` — pin to the current v8+ line (Zod v4 support; Decision #14), **not** the `^7.x` range (v7.3.4 is the last Zod-v3-only release)
- [x] `src/openapi/registry.ts`:
  - [x] Call `extendZodWithOpenApi(z)` once at the top of this file (Decision #14) — scoped to this module only, never imported by the running Worker, so no runtime effect on the deployed app
  - [x] Instantiate one `OpenAPIRegistry`
  - [x] Register a shared `bearerAuth` security-scheme component (`type: http`, `scheme: bearer`, `bearerFormat: JWT`)
  - [x] Register reusable component schemas by wrapping the existing exports from `src/schemas/*.ts` with `.openapi('Name', {...})` — schema files themselves are not edited (matches Decision #10's "additionally registered in a new, separate registry"): error envelope shape, pagination meta, and each resource's create/update/response shapes
  - [x] `registry.registerPath()` — one call per existing endpoint (method, path, request params/query/body, tags, summary, responses including the actual error envelope for `400`/`401`/`404`/`500`, no `403` anywhere per V2's single-role model):
    - [x] Health: `GET /health`
    - [x] Job Tracker: `GET /jobs`, `GET /jobs/meta`, `GET /jobs/:id`, `POST /jobs`, `PATCH /jobs/:id`, `DELETE /jobs/:id`
    - [x] Health Monitor — Glucose: `GET /glucose`, `POST /glucose`, `PATCH /glucose/:id`
    - [x] Health Monitor — Blood Pressure: `GET /blood-pressure`, `POST /blood-pressure`, `PATCH /blood-pressure/:id`
    - [x] Health Monitor — Weight: `GET /weight`, `POST /weight`, `PATCH /weight/:id`
    - [x] Health Monitor — Symptoms: `GET /symptoms`, `POST /symptoms`, `PATCH /symptoms/:id`
    - [x] Health Monitor — Dashboard: `GET /dashboard`
    - [x] Auth: `POST /auth/login`, `GET /auth/me`, `GET /auth/google` (302 redirect, per `api.md`), `GET /auth/google/callback` (documented ahead of Section 1's code, per the doc-first pass — Decision #13)
- [x] `scripts/generate-openapi.ts` — imports the registry, builds the document via `OpenApiGeneratorV3` targeting OpenAPI 3.0.x (Decision #15), writes it to `src/openapi/openapi.json` (Decision #16 — colocated so Section 3 can `import` it directly into the Worker bundle; Workers have no runtime filesystem access)
- [x] `package.json`: add `openapi:generate` script running the generator via `tsx`
- [x] Add a spec-lint validation step (e.g. `@redocly/cli`, 3.0.x-compatible) so the generated spec is checked for internal consistency; wire it into `npm run openapi:generate` or a separate `openapi:lint` script
- [x] Cross-check the generated `src/openapi/openapi.json` against `api.md` by hand; `api.md` remains the human-authored source of truth until ADR-011 is promoted from "Planned" to "Accepted"

---

# 3. Swagger UI

- [x] Install a Hono-compatible Swagger UI integration (e.g. `@hono/swagger-ui`) — `@hono/swagger-ui@^0.6.1`, `hono: >=4.0.0` peer range, compatible with the project's `^4.12.27`
- [x] Serve at `/docs` (Decision #4) — `src/routes/docs.routes.ts`, mounted at root in `src/app.ts`; raw spec served alongside at its own route, `GET /openapi.json` (Decision #18), sourced from the build-time-generated `src/openapi/openapi.json` (imported directly per Decision #16 — never rebuilt at request time)
- [x] Group endpoints by resource (Health, Job Tracker, Health Monitor, Auth), matching the existing doc structure — automatic from the `tags` already set per endpoint in `registry.ts`; verified in a live-rendered browser check
- [x] `/docs` itself requires no authentication to view; "try it out" calls against real endpoints still need a real admin token to hit the real-data scope — verified live: `/docs` renders fully with no `Authorization` header (guest scope in `resolveIdentity`), and the Authorize dialog correctly surfaces the `bearerAuth` scheme for entering a real token

---

# 4. Developer Experience Improvements

- [x] Audit all error messages across V1/V2 endpoints for consistent wording and a consistently structured `details` field (per V1 Decision #7 — Zod's flattened field-error map) — the `details` structure was already consistent; the custom cross-field `.refine()` messages (e.g. `salaryRangeRule`, `systolicOverDiastolicRule`) were already human-readable. The actual gap was Zod v4's default per-field messages (`"Too small: expected number to be >0"`, `"Invalid input: expected int, received number"`) leaking through for plain `.min()`/`.max()`/`.int()`/`.positive()` constraints with no custom message.
- [x] Improve validation error messages to be field-specific and human-readable — added custom messages to every validator that was producing Zod's internal phrasing (`"Too small"`/`"Too big"`/`"Invalid input: expected X, received Y"`) across `common.schema.ts` (`idParamSchema`, `paginationQuerySchema`), `job-applications.schema.ts` (`company`/`position`/`currency`/`salaryMin`/`salaryMax`), `glucose.schema.ts` (`fastingValue`/`afterMealValue`/`measuredAt`), `blood-pressure.schema.ts` (`systolic`/`diastolic`/`pulse`/`measuredAt`), `weight.schema.ts` (`value`/`measuredAt`), `symptom.schema.ts` (`type`/`intensity`/`happenedAt`), and `auth.schema.ts` (`email`/`password`, Google callback `code`/`state`). Left `.email()`/`.url()`/`.datetime()`/`.enum()`'s own malformed-*value* messages alone — already natural English (`"Invalid email address"`, etc.) — but every required field (including the `.email()`/`.datetime()` ones) also got a message on its base type call, since a **missing key entirely** always produces Zod's generic `"Invalid input: expected X, received undefined"` regardless of which chained validators follow — a gap the first pass missed and a follow-up code review caught (`.min(1, msg)`-only declarations only covered the present-but-empty case, not the omitted-key case). Closed with a generic regression test (`src/schemas/no-raw-zod-messages.test.ts`) that parses `{}` against every "create" schema and fails if any resulting message matches Zod's default phrasing — catches future fields with no message with no need to name them in advance.
- [x] Expand `api.md` examples: at least one example per error case (`400`/`401`/`404`) per resource — added a JSON body to the general Authentication section's invalid-token case, and a consolidated "### Errors" section (400/401/404, or 400/401 where no by-id 404 case exists, e.g. Dashboard) to every resource: Job Application, Glucose, Blood Pressure, Weight, Symptoms, Dashboard. Auth already had per-endpoint Errors sections from Section 1. A follow-up review caught the Glucose section's "neither/both provided → 400" claim overgeneralizing to `PATCH` (only `POST` requires exactly one; `PATCH` may omit both) — corrected.
- [x] Review and tighten any inconsistent response shapes surfaced while generating the OpenAPI spec — regenerating after the message changes produced no diff (custom Zod error messages aren't part of the JSON Schema output, as expected). Found one real, pre-existing shape inconsistency: `JobApplication.notes` (plural) vs. every Health Monitor entity's `note` (singular) for the same kind of free-text field. Decided to leave as-is (renaming either is a breaking change to an already-deployed contract, out of scope for a DX pass) and documented it explicitly in `models.md`'s Naming Conventions section so it reads as a known, considered decision rather than an oversight. A follow-up review also caught `blood-pressure.schema.ts` duplicating its systolic/diastolic/pulse/note field declarations across create/update instead of sharing a `bloodPressureValueShape` — the same pattern `glucose.schema.ts`/`job-applications.schema.ts` already use; factored out to match.

---

# 5. Monitoring

Reference: `deployment.md`, Decision #6

- [ ] Structure Worker logs consistently (method, path, status, duration, request ID), extending the V1 `src/middleware/logging.ts`
- [ ] Add a request ID per Decision #12: `crypto.randomUUID()` generated once per request, included in the log line, echoed back via an `X-Request-Id` response header
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

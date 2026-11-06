# Version 4 — Multi-User Authentication (Design)

> Status: **Approved** (2026-11-06) — decisions U1–U16 and C1–C11 confirmed by the user. The step-by-step implementation plan lives in `docs/plans/v4-plan.md`.
>
> Supersedes the single-tenant model of ADR-012 (V2) and ADR-013 (V3). Current code: Cloudflare Workers + Hono + Drizzle + three D1 databases (`job-tracker-db`, `health-monitor-db`, `auth-db`).

---

## 1. Intent

Platform API backs two portfolio frontends — `https://health-monitor-new.pages.dev` and `https://job-tracker-new.pages.dev` — which the owner also uses personally.

Today the API is single-tenant: one admin owns all "real" data, everyone else is a guest who can read **and write** demo data. V4 turns it into a small multi-user service:

- a visitor can look around (demo data) without signing up;
- anyone can create their own account in seconds, **without giving an email address** — the owner's explicit concern is that asking for an email scares visitors away;
- each account sees and edits only its own data.

Audience is small (portfolio visitors + the owner). There is no real user data today: production has **0** non-demo rows in all five business tables (verified by the user on 2026-11-06), and the only `auth-db` row is the owner's V2 admin account.

---

## 2. Goals

1. **Guest = read-only demo.** Requests without a token see only demo data and cannot create, update, delete, ignore or restore anything.
2. **Registration** with username + password. No email is collected or stored anywhere.
3. **Login** with username + password, or with Google.
4. **Google Sign-In without email.** First Google login automatically creates an account; repeat logins find it. Email is neither requested from Google nor stored.
5. **Per-user data isolation.** An authenticated user reads and writes only their own records.
6. **Account deletion** of one's own account together with all of its data.
7. **No roles.** All users are equal; the `ADMIN` role and everything built around it disappear.
8. **Documentation for frontend developers:** a frontend guide (UX rules) and a "connecting a frontend" guide (allowlist, Google flow), linked from `README.md`.

## 3. Non-goals (explicitly out of V4)

- Password change, username change.
- Password recovery of any kind (no email ⇒ not possible). A lost password means a lost account; the frontend warns about this at registration (see §9).
- Recovery codes.
- Unlinking Google from an account; merging two existing accounts (both with data) into one.
- Rate limiting / CAPTCHA on registration or login (stays in the Future Versions backlog; low risk for this audience).
- Server-side token revocation / refresh tokens. Logout stays client-side (discard the token).
- Admin/moderation features of any kind.
- Migrating existing real data (there is none).

## 4. Anti-goals (would make V4 a failure even if it "works")

- Any email address ending up in the database, logs, or Google consent screen.
- A guest being able to change any data, including demo data.
- One user being able to see, change, or even detect the existence of another user's records (or of demo records while logged in).
- A deleted account's still-valid JWT being able to create new (orphaned) data.
- The Google callback redirecting a token to an origin that is not on the allowlist (token theft).

---

## 5. Decisions made with the user

| # | Decision |
|---|----------|
| U1 | Guests see only demo data, read-only. The "suggest registering" UX is the frontend's job, triggered by the API's `401`. |
| U2 | Authenticated users see **only their own** data (not demo data). |
| U3 | Every business record gets `user_id`. Demo records have `user_id = NULL`; the `is_demo` column is removed. |
| U4 | No admin role; all users are equal. |
| U5 | Endpoints `register` and `login`; login by username+password or Google. |
| U6 | Username instead of email; email is never used. |
| U7 | Google login works by Google's stable account id (`sub`), scope `openid` only, auto-creates the account on first login with a generated username; no password on such accounts. No account linking in V4. |
| U8 | Existing admin account and the `create-admin.ts` bootstrap script are removed (there is no real data to migrate). |
| U9 | No registration rate limiting in V4 (portfolio + personal use). |
| U10 | Account deletion (`DELETE /auth/me`) with all data. No password change. No password recovery (option "A": lost password = lost account, frontend warns). |
| U11 | On every authenticated request the API checks the user still exists. |
| U12 | Google flow redirects back to the frontend with the token; frontend origins come from an allowlist. The JSON-on-API-page callback mode is removed; `redirect` is required. |
| U13 | One account works across both frontends (single API, single `auth-db`). |
| U15 | Tests: update the existing suite to the new scope model **and** add new tests for every §4 anti-goal (cross-user isolation, guest write → `401` before validation, deleted account token → `401`, redirect allowlist enforcement). Same per-commit gate as V1–V3 (`typecheck`, `lint`, `test:unit`, `test:repo`). |
| U16 | **Account linking in both directions** (revises the original U7 "no linking", 2026-11-06). (a) A password account links Google: `POST /auth/google/link` (token, body `{ redirect }`) → `{ data: { url } }`; the frontend navigates to `url`; the signed `state` carries `intent: 'link'` + `userId`; callback sets `google_sub` on that user and redirects to `<redirect>#linked=google`. Refusals: account already has Google → `409` at step 1; that Google `sub` already belongs to another user → `#error=google_already_used` (no merge). (b) A Google-only account sets a password: `POST /auth/me/password` (token, body `{ password, username? }`) → `200 { data: user }`; allowed only while the account has no password (else `409`); optional `username` replaces the generated one (`409` if taken). Both are optional API capabilities — frontends may or may not expose them. No unlinking. |
| U14 | Two docs: `docs/frontend-guide.md` (where to warn / confirm / handle errors) and `docs/connecting-a-frontend.md` (how to allow a new frontend), both linked from `README.md`. |

## 6. Decisions proposed by Claude (approved by the user on 2026-11-06)

- **C1. Ignore/restore are writes** → guests get `401` for them too.
- **C2. Username rules:** 3–32 characters, `[A-Za-z0-9_-]`, case-insensitive uniqueness.
- **C3. Password rules:** minimum 8 characters (V2 admin minimum was 12), hashed with the existing PBKDF2 utility (`src/utils/password.ts`), unchanged parameters.
- **C4. Username taken** → `409 Conflict` with a readable message.
- **C5. Registration returns a token immediately** (same response shape as login) — no separate login step.
- **C6. Account deletion** requires only a valid token (no password re-entry — Google accounts have no password; confirmation is the frontend's job). Deletion order: business data in `job-tracker-db` and `health-monitor-db` first, the `auth-db` user row last, so a partial failure leaves the account in place and a repeated `DELETE` finishes the job.
- **C7. Allowlist** of frontend origins is configuration in `wrangler.jsonc` (`vars`): `https://health-monitor-new.pages.dev`, `https://job-tracker-new.pages.dev`. Additionally `http://localhost:<any port>` and `http://127.0.0.1:<any port>` are always allowed. Adding a frontend = edit config + deploy; Google Cloud Console is not touched (only the API's own callback URL is registered there, and it doesn't change).
- **C8. `user_id` is a plain text column without a foreign key** — D1 cannot reference a table in another database (`auth-db`).
- **C9. CORS stays `Access-Control-Allow-Origin: *`** — auth is a Bearer header, not cookies.
- **C10. Deletion race is accepted.** A request with the same token that passes the U11 existence check just before the `users` row is removed could still insert one record after that database was wiped. The window is milliseconds, it requires the user to act against themselves concurrently, and such a row is unreachable (no account can ever have that `user_id` again — ids are random UUIDs). No tombstone/"deleting" marker in V4. Once deletion completes, U11 makes every further request with the old token a `401`, which is what the §4 anti-goal is about.
- **C11. Migration safety check.** The "0 non-demo rows" check is from 2026-11-06 and the owner may still add real data before V4 is deployed (`npm run dev` targets production DBs). The deployment step must re-count `is_demo = 0` rows in all five tables right before applying the V4 migrations and **stop** if any exist — such rows would otherwise silently become public demo data. What to do with them is then decided with the user at that moment.

---

## 7. Behaviour specification

### 7.1 Identities

```text
No Authorization header            → guest
Valid token, user exists           → user (userId = token.sub)
Token present but invalid/expired  → 401 "Invalid or expired token"   (unchanged from V2)
Valid token, user no longer exists → 401 (same message — deleted account)
```

### 7.2 Data access matrix (all five business resources + dashboard + `/jobs/meta`)

| Operation | Guest | User |
|---|---|---|
| List / get by id / dashboard / `/jobs/meta` | demo rows only (`user_id IS NULL`) | own rows only (`user_id = me`) |
| Create | `401` | creates with `user_id = me` |
| Update / delete / ignore / restore | `401` | own rows; anything else → `404` |

- Guest write → `401` with a stable message (e.g. `Authentication required`) so the frontend can recognise it and show the "register" prompt. The `401` must happen **before** body validation, so a guest gets `401`, not `400`, for an invalid body.
- `404` (not `403`) for foreign/demo records stays as in V2: existence of other records is never disclosed.
- The client never sends `user_id` (strict schemas reject unknown keys, as they reject `isDemo` today).
- `/jobs/meta` statistics and the Health Monitor dashboard are computed over the caller's scope only.
- Demo data is changed only through `seed.sql`.

### 7.3 Auth endpoints

| Endpoint | Auth | Behaviour |
|---|---|---|
| `POST /auth/register` | none | body `{ username, password }` → `201` `{ data: { token, user } }`; `409` username taken; `400` validation |
| `POST /auth/login` | none | body `{ username, password }` → `200` `{ data: { token, user } }`; uniform `401 Invalid credentials` for unknown username, wrong password, **and Google-only accounts** (no password) |
| `GET /auth/me` | token | `200` `{ data: user }`; `401` otherwise |
| `DELETE /auth/me` | token | deletes all of the caller's data and the account → `204`; `401` without valid token |
| `GET /auth/google?redirect=<url>` | none | validates `redirect` against the allowlist (origin match); stores it inside the signed `state`; `302` to Google with scope `openid`. Invalid/missing `redirect` → `400` JSON, no redirect |
| `GET /auth/google/callback` | none | verifies `state`, exchanges `code`, finds user by Google `sub` or creates one; `302` to `<redirect>#token=<jwt>`. On failure after a valid `state` → `302` to `<redirect>#error=<code>`. Invalid/expired `state` (redirect unknown) → `401` JSON as today |

**User object** returned by the API:

```json
{ "id": "…", "username": "nick", "hasPassword": true, "createdAt": "…", "updatedAt": "…" }
```

`hasPassword` lets the frontend know whether the account is a Google-only one (e.g. to explain that it has no password). No `email`, no `role`, no Google `sub` in responses.

**JWT:** same algorithm/expiry as today (HS256, 30 days, `sub`/`iat`/`exp`); the `role` claim is removed. Tokens issued by password login, registration and Google are indistinguishable.

**Error codes in the fragment** (`#error=`): a small fixed set (e.g. `google_failed`, `access_denied` when the user cancels on Google's screen). Exact list — builder's call; must be documented in `frontend-guide.md`.

### 7.4 Google Sign-In details

- Scope `openid` only. The account identity is Google's `sub`. The implementation must obtain `sub` without requesting `email` (e.g. from the OpenID Connect userinfo endpoint or the `id_token` returned by the token exchange). **The builder must confirm the exact mechanism against Google's official OpenID Connect documentation before implementing** (project rule: verify APIs against docs).
- First login with an unknown `sub` creates a user with a generated username (e.g. `user-` + 6 random hex chars, retrying on collision) and no password.
- `redirect_uri` sent to Google stays the API's own `/auth/google/callback` (computed from the request URL, V3 Decision #20). The frontend's URL travels only inside the signed `state`.
- `google-console.md` must be updated: the OAuth consent screen no longer needs the `email` scope.

---

## 8. Data model changes

### `auth-db.users`

| Column | Change |
|---|---|
| `id` | unchanged |
| `email` | **removed** |
| `role` | **removed** |
| `username` | **new**, not null, unique case-insensitively |
| `password_hash` | becomes **nullable** (null for Google-only accounts) |
| `google_sub` | **new**, nullable, unique |
| `created_at`, `updated_at` | unchanged |

Invariant: at least one of `password_hash` / `google_sub` is set.

### Business tables (`job_applications`, `glucose_measurements`, `blood_pressure_measurements`, `weight_measurements`, `symptom_entries`)

- `is_demo` **removed**, `user_id` (text, nullable, indexed) **added**.
- Demo rows: `user_id IS NULL`. `seed.sql` deletes/reinserts only `WHERE user_id IS NULL`.
- Existing rows are all demo (verified), so the migration sets `user_id = NULL` for every existing row.

### Removed

- `scripts/create-admin.ts` and its docs/npm usage.
- The production admin row in `auth-db` (dropped as part of the `users` table rebuild).

---

## 9. Frontend guide content (`docs/frontend-guide.md`)

Must cover at least:

1. Guest gets `401 Authentication required` on any write → show "register to add your own data" prompt (with login/register options).
2. Registration form: warn that the password cannot be recovered; suggest Google sign-in as the more reliable option.
3. Account deletion: explicit confirmation dialog stating that all data in **both** apps is deleted irreversibly.
4. `401 Invalid or expired token` on any request → discard the token, return to guest mode, offer to log in again.
5. `409` on registration → "username taken".
6. Logout = discard the token locally.
7. Google flow: link to `/auth/google?redirect=<own callback page>`, read `#token` / `#error` from the fragment, store the token, immediately remove the fragment from the address bar (`history.replaceState`), map `#error` codes to messages.
8. One account is shared between Health Monitor and Job Tracker.

## 10. Connecting-a-frontend guide (`docs/connecting-a-frontend.md`)

Step-by-step: where the allowlist lives in `wrangler.jsonc`, the origin format (scheme + host + port, no path, no trailing slash), that `localhost`/`127.0.0.1` are pre-allowed, deploy command, how to verify (open `/auth/google?redirect=…`), and that Google Cloud Console needs no change.

---

## 11. Constraints

- Project process (`CLAUDE.md`): docs-first (`api.md`, `models.md`, `architecture.md`, `decisions.md`, `roadmap.md`, `development.md`, `deployment.md` updated before code), maximum decomposition, no deviation from the approved plan, code review per section, deploy only on explicit request.
- Three separate D1 databases, `--remote` only; no cross-database transactions or foreign keys.
- Breaking API change (login body, user shape, guest writes, Google callback). Acceptable: the only consumers are the owner's two frontends, which will be adapted. No API versioning (V3 Decision #5 stands).
- New ADR in `decisions.md` superseding ADR-012 and ADR-013.

## 12. Left to the builder (to be settled in `v4-plan.md`, each as a numbered Decision)

- Migration mechanics per database (Drizzle-generated table rebuilds for SQLite) and deploy ordering of migrations vs. Worker code (brief inconsistency window acceptable — no real users yet).
- How case-insensitive username uniqueness is enforced (normalised column vs. `COLLATE NOCASE` index) and whether the original casing is displayed.
- Repository/service refactor shape for replacing `isDemo` with a `userId | null` scope (including `buildDateRangeFilter`).
- Where the "guest cannot write" check lives (middleware on write routes vs. service layer), as long as it fires before body validation.
- Exact `#error` code list, exact error messages.
- Generated-username format and collision handling.
- Updates to `http/*.http` files and the OpenAPI registry / Swagger.
- Whether `DELETE /auth/me` returns `204` or `200` with a body (`204` proposed).

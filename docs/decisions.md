# Architectural Decisions

> This document records important architectural decisions made during the development of the Platform API.
>
> The goal is not to document *what* the system does, but *why* it was designed this way.
>
> Every significant decision should include:
>
> - context;
> - decision;
> - rationale;
> - consequences.

See also:

- `architecture.md`
- `roadmap.md`

---

# ADR-001

## Title

Cloudflare Workers as the Runtime

---

### Status

Accepted

---

### Context

The project requires:

- low operational cost;
- simple deployment;
- automatic scaling;
- no server administration.

---

### Decision

The backend runs entirely on Cloudflare Workers.

---

### Rationale

Benefits:

- serverless architecture;
- global edge deployment;
- automatic scaling;
- no infrastructure management;
- native integration with D1.

---

### Consequences

Advantages:

- very simple deployment;
- low maintenance.

Disadvantages:

- some Node.js APIs are unavailable;
- execution time limitations.

---

# ADR-002

## Title

Cloudflare D1 as Primary Database

---

### Status

Accepted

---

### Context

The project requires:

- SQL database;
- low operational complexity;
- native Cloudflare integration.

---

### Decision

Use Cloudflare D1.

---

### Rationale

D1 provides:

- SQLite compatibility;
- serverless operation;
- simple provisioning.

---

### Consequences

Advantages:

- zero database administration;
- simple deployment.

Possible future migration:

- PostgreSQL.

The REST API should remain unchanged if the database changes.

---

# ADR-003

## Title

Drizzle ORM

---

### Status

Accepted

---

### Context

The project requires:

- type-safe SQL;
- migrations;
- lightweight ORM.

---

### Decision

Use Drizzle ORM.

---

### Rationale

Drizzle provides:

- excellent TypeScript support;
- SQL-first philosophy;
- readable generated SQL.

---

### Consequences

Database access remains strongly typed.

---

# ADR-004

## Title

REST Instead of GraphQL

---

### Status

Accepted

---

### Context

The project exposes data to multiple client applications.

---

### Decision

Use REST.

---

### Rationale

REST is:

- simple;
- mature;
- widely supported;
- easy to debug.

---

### Consequences

The API remains understandable without specialized tooling.

---

# ADR-005

## Title

Documentation Before Implementation

---

### Status

Accepted

---

### Context

Code and documentation often diverge over time.

---

### Decision

Documentation is created before implementation.

Implementation follows documentation.

---

### Consequences

Advantages:

- predictable API;
- easier reviews;
- clearer discussions.

---

# ADR-006

## Title

Demo Data Instead of Separate Demo Database

---

### Status

Accepted

---

### Context

Guest users should be able to explore the application without authentication.

---

### Decision

Business entities contain:

```ts
isDemo: boolean
```

---

### Rationale

Benefits:

- one database;
- one schema;
- one codebase.

---

### Consequences

The server decides which records are visible.

The client never controls `isDemo`.

---

# ADR-007

## Title

Health Monitor Uses Ignore Instead of Delete

---

### Status

Accepted

---

### Context

Medical measurements may later become useful for analysis.

Deleting them permanently could result in data loss.

---

### Decision

Public API does not physically delete Health Monitor records.

Instead:

```http
PATCH /resource/:id
```

```json
{
    "ignored": true,
    "reason": "Incorrect measurement"
}
```

---

### Rationale

The full history remains available.

Incorrect measurements can be restored.

---

### Consequences

Reports may choose to include or exclude ignored records.

---

# ADR-008

## Title

Job Tracker Uses Physical Delete

---

### Status

Accepted

---

### Context

Job applications do not require historical preservation.

---

### Decision

DELETE permanently removes the resource.

---

### Rationale

Simpler implementation.

No business value in retaining deleted records.

---

### Consequences

Deletion cannot be undone.

---

# ADR-009

## Title

Separate Metadata Endpoint

---

### Status

Accepted

---

### Context

The frontend requires:

- company list;
- active statuses;
- statistics.

These values are not individual resources.

---

### Decision

Provide:

```http
GET /jobs/meta
```

---

### Rationale

Avoid recalculating metadata on the client.

Single request.

Smaller client code.

---

### Consequences

Metadata logic stays on the server.

---

# ADR-010

## Title

Pagination Only for Job Tracker

---

### Status

Accepted

---

### Context

Job applications may grow into hundreds or thousands of records.

Health Monitor datasets remain relatively small.

---

### Decision

Pagination is implemented only for Job Tracker.

---

### Consequences

Health Monitor API stays simpler.

---

# ADR-011

## Title

OpenAPI Generated from Documentation

---

### Status

Accepted

---

### Context

Swagger is planned for Version 3.

---

### Decision

Markdown documentation remains the source of truth.

OpenAPI specification will be generated afterwards.

---

### Consequences

Human-readable documentation remains the primary artifact.

Swagger stays synchronized with documentation.

---

# ADR-012

## Title

Single-Tenant Authentication: Closed Registration, Guest as Absence of Token

---

### Status

Superseded by ADR-014 (2026-11-06, Version 4). Accepted on 2026-07-01 (Version 2 planning; recorded 2026-07-02).

---

### Context

Version 2 introduces authentication. The application serves exactly one real data owner (a personal platform), while anonymous visitors should keep exploring the demo world without registering (ADR-006). `roadmap.md`'s original wording implied open self-registration and a stored `GUEST` role.

---

### Decision

- The application is **single-tenant**: exactly one user row ever exists — the admin, provisioned once via an out-of-band bootstrap script (`scripts/create-admin.ts`). There is no public `POST /auth/register`.
- **Guest is the absence of a valid `Authorization` token**, not a stored account or role. Guests are scoped to demo data (`isDemo: true`) on every read and write; the admin is scoped to real data (`isDemo: false`). By-id access outside the caller's scope returns `404`.
- A presented-but-invalid/expired token returns `401` on any endpoint — never a silent downgrade to guest.
- Users live in a third D1 database (`auth-db`), keeping the one-database-per-domain rule; no business table gains a `userId` — `isDemo` remains the only data partition.

---

### Rationale

- No open registration endpoint means no abuse surface and no user-management scope creep for a single-owner application.
- Guest-as-no-token preserves V1's frictionless demo mode and full backward compatibility.
- One role in practice ("authenticated = admin") removes the need for a role-authorization layer that would have no second consumer.

---

### Consequences

- Multi-user support (roles, ownership columns, registration) becomes a deliberate future migration, not a latent half-built feature.
- `roadmap.md`'s Version 2 section was rewritten to the as-designed scope; details live in `plans/v2-plan.md`.
- The `role` column is kept on `users` for schema durability but only ever holds `'ADMIN'` in V2.

---

# ADR-013

## Title

Google Login as an Additional Method for the Single Admin Account, No New-Account Creation

---

### Status

Superseded by ADR-014 (2026-11-06, Version 4). Accepted on 2026-07-03 (Version 3 planning).

---

### Context

Version 3 adds Google OAuth as an alternative login method. Version 2's single-tenant model (ADR-012) established that exactly one admin account exists, created only via the out-of-band bootstrap script. Google Sign-In conventionally auto-provisions an account on first login — that behavior would silently reopen the registration surface ADR-012 deliberately closed.

---

### Decision

- Google login is matched against the single admin's existing `email` in `auth-db` (case-insensitive exact match). If the Google account's email doesn't match, the login is rejected (`401`) and **no new account is ever created**.
- `passwordHash` stays required on `users` — the admin account must already exist (via `scripts/create-admin.ts`) before Google login can ever succeed for it. Google is purely an additional login method for that same account, never a Google-only signup path.
- The OAuth redirect (`GET /auth/google` → `GET /auth/google/callback`) is protected against CSRF via a signed, storageless `state` parameter (a short-lived JWT signed with the existing `JWT_SECRET`, carrying a `purpose: 'oauth_state'` claim) rather than a server-side session — consistent with the stateless architecture ADR-012 established.
- The code→token and token→profile exchange with Google uses two raw `fetch` calls, not an OAuth client library — the exchange itself has no cryptography of its own (unlike JWT signing, which justified adding `jose` in V2).

---

### Rationale

- Preserves the single-tenant guarantee: however a request authenticates, it can only ever resolve to the one provisioned admin, never mint a new identity.
- A signed `state` token needs no new infrastructure (no KV, no sessions table) and reuses a secret and library the app already trusts.
- Avoiding a new OAuth dependency keeps the same "add a library only for capabilities you can't safely reimplement" discipline `jose`'s addition followed.

---

### Consequences

- A Google account that has never been the admin's login method still works the moment its email matches the existing row — no separate "link your Google account" step is needed or offered.
- If the admin ever changes their Google account's email, Google login for the new address won't work until `scripts/create-admin.ts` is re-run to update the stored email — an accepted operational tradeoff of matching on email rather than Google's stable account ID.
- `resolveIdentity` (V2) requires zero changes — a Google-issued token is indistinguishable in shape from a password-issued one.

---

# ADR-014

## Title

Open Multi-User Model with Username Accounts, No Email

---

### Status

Accepted (2026-11-06, Version 4 planning). Supersedes ADR-012 and ADR-013.

---

### Context

ADR-012 made the platform single-tenant (one admin, guests read and write demo data) and ADR-013 restricted Google login to that admin's email. The two portfolio frontends now need to be usable by visitors: they must be able to look around without an account and to create their own account in seconds. The owner's explicit concern is that asking for an email address scares visitors away. Production holds no real data yet (verified 2026-11-06: zero non-demo rows in all five business tables), so there is nothing to migrate.

---

### Decision

- **Guests are read-only.** A request without a token sees only demo data (`user_id IS NULL`) and cannot create, update, delete, ignore or restore anything: any write is `401 Authentication required`, raised before body validation.
- **Anyone can register** with a username (3–32 characters, `[A-Za-z0-9_-]`, unique case-insensitively) and a password (8–128 characters). No email is collected or stored anywhere, so there is no password recovery: a lost password means a lost account, and the frontend warns about it.
- **Google Sign-In works by Google's stable account id** (OpenID `sub`), with the `openid` scope only — no email is requested. The first Google login creates an account with a generated username (`user-` + 6 hex characters) and no password; repeat logins find it.
- **Account linking in both directions, no merging.** A password account can link Google (`POST /auth/google/link` returns the Google URL, because a browser navigation cannot carry the `Authorization` header); a Google-only account can set a password (`POST /auth/me/password`). A Google account already linked to another user is refused. No unlinking.
- **No roles.** All users are equal; the `ADMIN` role, the admin bootstrap script and the `isDemo` flag are removed.
- **Per-user data.** Every business row carries a nullable `user_id` (plain text, no foreign key — D1 cannot reference another database); demo rows have `user_id = NULL`. An authenticated user sees and edits only their own rows, never demo rows.
- **Existence check on every authenticated request.** A valid token of a deleted account is `401 Invalid or expired token`, never a silent fallback to guest.
- **Account deletion** (`DELETE /auth/me`) removes the business data in both business databases first and the `auth-db` user row last, so a partial failure leaves the account in place and a repeated request finishes the job.
- **Google redirect goes back to the frontend** with the result in the URL fragment (`#token=`, `#linked=google`, `#error=<code>`). The frontend URL travels inside the signed `state` and must pass an origin allowlist (`ALLOWED_FRONTEND_ORIGINS` plus `localhost` / `127.0.0.1`); adding a frontend is a config change and a deploy, with no Google Console change.

---

### Rationale

- A username-only registration removes the main source of sign-up friction while keeping accounts private; Google is offered as the more reliable option, since it can be recovered.
- Matching Google accounts by `sub` rather than by email makes the identity stable and keeps email out of the system entirely.
- A scope check in a dedicated guard before validation gives frontends one stable signal (`401 Authentication required`) for the "register to add your own data" prompt.
- Returning the token in the fragment keeps it out of server logs and `Referer` headers; the allowlist stops the callback from leaking a token to a foreign origin.
- A nullable `user_id` replaces the boolean `isDemo` with a strictly more general partition: the same column separates demo data from every user.

---

### Consequences

- Breaking API change: login body, user shape, guest writes and the Google callback all change. Acceptable, since the only consumers are the owner's two frontends.
- There is no rate limiting or CAPTCHA on registration or login in V4 (backlog).
- Tokens are not revocable server-side; logout stays client-side. Only deletion of the account invalidates its tokens (through the existence check).
- A request racing with account deletion could insert one unreachable row; the window is accepted (no tombstone).
- Deployment must re-count non-demo rows right before migrating: any such row would otherwise silently become public demo data (see `deployment.md`).
- Frontend behaviour is specified in `frontend-guide.md`; adding a frontend is described in `connecting-a-frontend.md`.

---

# Future Decisions

Future ADRs may include:

- PostgreSQL migration;
- Redis caching;
- Background jobs;
- Cloudflare Queues;
- API versioning;
- Rate limiting;
- Full-text search.

---

# Decision Process

Every architectural decision should answer four questions:

1. What problem are we solving?
2. What decision was made?
3. Why was it chosen?
4. What consequences does it have?
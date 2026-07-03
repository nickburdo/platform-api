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

Accepted (2026-07-01, Version 2 planning; recorded 2026-07-02)

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

Accepted (2026-07-03, Version 3 planning)

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
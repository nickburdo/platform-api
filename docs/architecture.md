# Architecture

> This document describes the overall architecture of the Platform API project.
>
> It explains the design goals, architectural principles, chosen technologies and major design decisions.
>
> Details about API endpoints, data models and deployment are documented separately.

---

## Purpose

Platform API is a reusable REST API backend designed to serve multiple client applications through a single HTTP interface.

Supported clients include:

- Vue applications
- React applications
- Mobile applications
- CLI tools
- Postman
- Future third-party integrations

The backend is completely independent from any frontend framework.

---

## Design Principles

The project follows several architectural principles.

### API First

The REST API is the primary interface.

All clients communicate through HTTP.

The backend never contains UI-specific logic.

---

### Framework Agnostic

The API has no knowledge about Vue, React, Angular or any other frontend framework.

Any HTTP client should be able to consume the API.

---

### Serverless

The application runs entirely on Cloudflare Workers.

Benefits:

- no server administration
- automatic scaling
- global edge network
- high availability

---

### Type Safety

Type safety is maintained throughout the entire stack.

- TypeScript
- Drizzle ORM
- Zod

This minimizes runtime errors and improves developer experience.

---

### Simplicity First

The project intentionally avoids unnecessary complexity.

Every architectural decision follows one principle:

> Build the simplest solution that satisfies today's requirements.

New technologies are introduced only when they solve a real problem.

---

## High Level Architecture

```text
                    HTTP
                     │
                     ▼
        +-------------------------+
        |      Client Apps        |
        |-------------------------|
        | Vue                     |
        | React                   |
        | Mobile                  |
        | HTTP Client / curl      |
        | CLI                     |
        +------------┬------------+
                     │
                     ▼
             Cloudflare Workers
                     │
                     ▼
               Hono Router
                     │
                     ▼
        Identity Resolution (V2, V4)
        no token → guest (demo scope, read-only)
        valid JWT + user exists → user (own scope)
        valid JWT, user deleted → 401
        invalid JWT → 401
        (write routes: guest → 401 before validation)
                     │
         +-----------+-----------+
         |                       |
         ▼                       ▼
 Request Validation      Business Logic
      (Zod)                (Services)
                                │
                                ▼
                           Drizzle ORM
                                │
             +------------------+------------------+
             |                  |                  |
             ▼                  ▼                  ▼
  Cloudflare D1:      Cloudflare D1:      Cloudflare D1:
  job-tracker-db      health-monitor-db   auth-db (V2)
  (job_applications)  (glucose_…,         (users — all
                       blood_pressure_…,   accounts)
                       weight_…,
                       symptom_entries)
```

Each bounded domain owns its own database. The databases never share a schema, a migration history or a query — there is no cross-database access anywhere in the application.

---

## Technology Stack

| Technology | Responsibility |
|------------|----------------|
| TypeScript | Primary programming language |
| Hono | HTTP routing |
| Cloudflare Workers | Serverless runtime |
| Cloudflare D1 | Three independent databases: `job-tracker-db`, `health-monitor-db`, `auth-db` |
| Drizzle ORM | Database access (one client, schema and migration history per database) |
| Zod | Validation |
| Wrangler | Development & deployment |

---

## Component Responsibilities

### Hono

Responsible for:

- routing
- middleware
- request handling
- response generation

---

### Cloudflare Workers

Responsible for:

- executing API code
- HTTPS endpoints
- scalability
- deployment

Workers contain the entire application.

---

### Cloudflare D1

Responsible for:

- persistent storage
- indexes
- SQL execution

The project uses **three independent D1 databases**, one per bounded domain:

- `job-tracker-db` — one table, `job_applications`;
- `health-monitor-db` — four tables: `glucose_measurements`, `blood_pressure_measurements`, `weight_measurements`, `symptom_entries`;
- `auth-db` (Version 2) — one table, `users`, holding all accounts (username, optional password hash, optional Google `sub`; ADR-014).

Each database has its own Drizzle schema, client and migrations directory under `src/db/<domain>/`. The domains never reference each other's data: business rows point at their owner with a plain `user_id` text column (`NULL` = demo record), not a foreign key.

The application communicates with the databases exclusively through Drizzle ORM.

There is no local database: development, testing against real infrastructure and production all target the same three cloud D1 instances (`--remote` everywhere).

---

### Drizzle ORM

Responsible for:

- SQL generation
- type-safe database access
- migrations

Raw SQL should only be used when absolutely necessary.

---

### Zod

Responsible for validating:

- request body
- query parameters
- path parameters

Invalid requests should never reach business logic.

---

## Request Flow

Every request follows the same lifecycle. The write guard runs before validation, so a guest sending an invalid body to a write route gets `401`, not `400`. Business logic receives the resolved owner scope (`null` = demo for guests, the user id for users) and passes it to every query.

```text
HTTP Request
      │
      ▼
Hono Route
      │
      ▼
Identity Resolution (guest / user / 401)
      │
      ▼
Write guard — guests get 401 (write routes only)
      │
      ▼
Zod Validation
      │
      ▼
Business Logic
      │
      ▼
Drizzle ORM
      │
      ▼
Cloudflare D1
      │
      ▼
JSON Response
```

### Scheduled Flow (V4.2)

Besides HTTP requests, the Worker has a second entrypoint: a `scheduled` handler invoked by a Cron Trigger (`"0 0 * * *"`, daily at 00:00 UTC, configured in `wrangler.jsonc`). It does not pass through Hono, identity resolution or validation; it calls one repository function that shifts the Health Monitor demo dates forward by whole elapsed days (ADR-015).

```text
Cron Trigger (00:00 UTC)
      │
      ▼
scheduled handler (src/index.ts)
      │
      ▼
shiftDemoDates — one D1 batch (transaction)
      │
      ▼
Cloudflare D1: health-monitor-db (demo rows only)
```

---

## Design Decisions

### Why Hono?

Chosen because it is:

- lightweight
- Cloudflare-native
- TypeScript-first

---

### Why Cloudflare Workers?

Workers eliminate server management while providing automatic scaling and global deployment.

---

### Why D1?

Chosen because:

- simple deployment
- native Workers integration
- sufficient for project scale

If future requirements exceed SQLite capabilities, D1 can later be replaced with PostgreSQL without changing the public REST API.

---

### Why REST?

REST was chosen because it is:

- simple
- widely supported
- language independent
- easy to debug
- suitable for browser, mobile and CLI clients

---

## Project Scope

The Platform API provides:

- REST endpoints
- validation
- authentication
- business logic
- persistent storage

The project intentionally does **not** provide:

- HTML rendering
- server-side templates
- frontend components
- GraphQL
- WebSockets
- background jobs (currently)

---

## Future Evolution

Possible future improvements include:

- PostgreSQL
- Redis caching
- Cloudflare Queues
- Cloudflare R2
- Full-text search
- AI-powered endpoints

These features should only be introduced when justified by real requirements.

---

## Related Documents

- `roadmap.md`
- `models.md`
- `api.md`
- `development.md`
- `deployment.md`
- `decisions.md`
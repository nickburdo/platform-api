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
        | Postman                 |
        | CLI                     |
        +------------┬------------+
                     │
                     ▼
             Cloudflare Workers
                     │
                     ▼
               Hono Router
                     │
         +-----------+-----------+
         |                       |
         ▼                       ▼
 Request Validation      Business Logic
      (Zod)
         │
         ▼
      Drizzle ORM
         │
         ▼
   Cloudflare D1 Database
```

---

## Technology Stack

| Technology | Responsibility |
|------------|----------------|
| TypeScript | Primary programming language |
| Hono | HTTP routing |
| Cloudflare Workers | Serverless runtime |
| Cloudflare D1 | Database |
| Drizzle ORM | Database access |
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

The application communicates with the database exclusively through Drizzle ORM.

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

Every request follows the same lifecycle.

```text
HTTP Request
      │
      ▼
Hono Route
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
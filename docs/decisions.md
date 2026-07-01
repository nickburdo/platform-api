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

Planned

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
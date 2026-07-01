# Development

> This document describes how to develop the Platform API project.
>
> It explains how to run the project locally, work with the database, add new endpoints and follow the project's development conventions.
>
> Production deployment is described separately in `deployment.md`.

See also:

- `architecture.md`
- `models.md`
- `api.md`
- `deployment.md`

---

# Purpose

This document answers the following questions:

- How do I run the project locally?
- How is the project organized?
- How do I add a new endpoint?
- How should validation be implemented?
- Where should business logic live?
- How should responses be formatted?

---

# Requirements

Development requires:

- Node.js
- npm
- Cloudflare account
- Wrangler CLI

Recommended tools:

- VS Code or WebStorm
- Git
- Postman

---

# Installation

Clone the repository.

```bash
git clone <repository-url>
cd platform-api
```

Install dependencies.

```bash
npm install
```

---

# Running the API

Start the local development server.

```bash
wrangler dev
```

The API will usually be available at:

```text
http://localhost:8787
```

---

# Environment Variables

Secrets must never be committed to Git.

Future environment variables include:

```text
JWT_SECRET

GOOGLE_CLIENT_ID

GOOGLE_CLIENT_SECRET
```

Authentication secrets become mandatory in Version 2.

---

# Project Structure

The project should be organized by responsibility.

```text
src/

├── app.ts
├── index.ts
│
├── db/
│   ├── client.ts
│   ├── schema.ts
│   └── migrations/
│
├── routes/
│
├── services/
│
├── repositories/
│
├── schemas/
│
├── middleware/
│
└── utils/
```

---

# Responsibility of Each Layer

## Routes

Responsible only for HTTP.

Routes should:

- read request parameters;
- validate input;
- call services;
- return HTTP responses.

Routes should not contain business logic.

---

## Services

Contain business logic.

Examples:

- calculate statistics;
- determine interview rate;
- apply demo data rules;
- normalize filters;
- validate cross-field rules.

---

## Repositories

Responsible only for database operations.

Repositories should not contain business rules.

They should only:

- execute queries;
- insert records;
- update records;
- delete records.

---

## Schemas

Contain Zod validation schemas.

Validation must exist for:

- request body;
- query parameters;
- path parameters.

---

## Middleware

Contains reusable HTTP middleware.

Examples:

- authentication;
- logging;
- error handling;
- CORS.

---

## Utils

Contains reusable helper functions.

Examples:

- pagination;
- date formatting;
- response helpers.

---

# Validation

All incoming data must be validated using Zod.

Every endpoint validates:

- request body;
- query parameters;
- path parameters.

Invalid requests must return

```http
400 Bad Request
```

Business logic should never receive invalid input.

---

# Response Format

All endpoints follow the response format described in `api.md`.

Single resource:

```json
{
    "data": {}
}
```

Collection:

```json
{
    "data": []
}
```

Paginated collection:

```json
{
    "data": [],
    "meta": {
        "page": 1,
        "limit": 20,
        "total": 73,
        "totalPages": 4
    }
}
```

Error:

```json
{
    "error": {
        "message": "Validation error",
        "details": {}
    }
}
```

---

# Database

The project uses:

- Cloudflare D1
- Drizzle ORM

Database access should always go through Drizzle.

Raw SQL should only be used when Drizzle cannot express the required query.

---

# Migrations

Every database change must be implemented through migrations.

Recommended workflow:

1. Update Drizzle schema.
2. Generate migration.
3. Review generated SQL.
4. Apply migration locally.
5. Test locally.
6. Apply migration during deployment.

Example commands:

```bash
npm run db:generate

npm run db:migrate:local
```

---

# Seed Data

Version 1 includes demo seed data.

Seed creates:

- Job applications;
- Glucose measurements;
- Blood pressure measurements;
- Weight measurements;
- Symptom entries.

Every seeded record must contain:

```ts
isDemo: true
```

Recommended command:

```bash
npm run db:seed
```

---

# Demo Data Rules

The client never controls the `isDemo` field.

The server assigns it automatically.

Rules:

- seed data uses `isDemo = true`;
- guest-created data uses `isDemo = true`;
- admin-created data uses `isDemo = false`.

---

# Pagination

Pagination is used only by Job Tracker.

Supported query parameters:

```text
page

limit
```

Default values:

```text
page = 1

limit = 20
```

Recommended maximum:

```text
limit <= 100
```

Offset calculation:

```text
offset = (page - 1) * limit
```

---

# Filtering

## Job Tracker

Supports:

- status
- company

Search fields:

- company
- position
- source
- notes

Example:

```http
GET /jobs?status=APPLIED&company=Google&search=frontend
```

---

## Health Monitor

Supports only:

- date_from
- date_to

Example:

```http
GET /glucose?date_from=2026-06-01&date_to=2026-06-30
```

Pagination is not used.

---

# Ignore Mechanism

Health Monitor records are never physically deleted through the public API.

Instead, they are ignored.

Example:

```http
PATCH /glucose/:id
```

```json
{
    "ignored": true,
    "reason": "Incorrect measurement"
}
```

To restore:

```json
{
    "ignored": false,
    "reason": ""
}
```

---

# Adding a New Endpoint

Every new endpoint should follow the same workflow.

1. Update `models.md`.
2. Update `api.md`.
3. Update Drizzle schema.
4. Create Zod validation schema.
5. Implement repository.
6. Implement service.
7. Implement route.
8. Test using Postman.

The implementation should always follow the documentation, not vice versa.

---

# Development Workflow

Every new feature should follow the same implementation order.

```text
Documentation
        │
        ▼
Data Model
        │
        ▼
API Contract
        │
        ▼
Database Schema
        │
        ▼
Validation
        │
        ▼
Repository
        │
        ▼
Service
        │
        ▼
Route
        │
        ▼
Testing
```

Documentation should always be updated before implementation.

---

# Recommended Scripts

The following scripts are recommended.

```json
{
    "scripts": {
        "dev": "wrangler dev",
        "deploy": "wrangler deploy",

        "db:generate": "drizzle-kit generate",
        "db:migrate:local": "wrangler d1 migrations apply platform-api --local",
        "db:migrate:remote": "wrangler d1 migrations apply platform-api --remote",

        "db:seed": "tsx scripts/seed.ts",

        "typecheck": "tsc --noEmit",
        "lint": "eslint .",
        "format": "prettier --write ."
    }
}
```

Script names may change during development.

---

# Health Check Endpoint

The API should expose a lightweight endpoint for monitoring.

```http
GET /health
```

Example response:

```json
{
    "data": {
        "status": "ok"
    }
}
```

The endpoint should:

- not require authentication;
- not access the database unless necessary;
- return quickly.

Typical usage:

- deployment verification;
- uptime monitoring;
- load balancers;
- CI/CD smoke tests.

---

# Testing

Version 1 relies primarily on manual API testing.

Recommended tools:

- Postman
- Bruno
- curl

Recommended collection structure:

```text
Platform API

├── Health
│
├── Job Tracker
│   ├── List
│   ├── Details
│   ├── Create
│   ├── Update
│   ├── Delete
│   └── Meta
│
├── Health Monitor
│   ├── Glucose
│   ├── Blood Pressure
│   ├── Weight
│   ├── Symptoms
│   └── Dashboard
│
└── Authentication
```

Each endpoint should be tested for:

- successful request;
- validation error;
- resource not found;
- invalid identifier;
- empty result;
- demo data behavior.

---

# Code Style

General principles:

- use TypeScript everywhere;
- avoid `any`;
- prefer explicit types;
- keep functions small;
- avoid duplicated logic;
- keep routes thin;
- validate every request;
- return consistent responses.

Business logic belongs in services.

Database logic belongs in repositories.

---

# Server Managed Fields

The client must never control the following fields:

```text
id

createdAt

updatedAt

isDemo
```

These values are generated or maintained by the server.

---

# Error Handling

Validation errors:

```http
400 Bad Request
```

Authentication errors:

```http
401 Unauthorized
```

Access denied:

```http
403 Forbidden
```

Resource not found:

```http
404 Not Found
```

Unexpected server errors:

```http
500 Internal Server Error
```

Internal implementation details should never be exposed in production responses.

---

# Logging

The application should log:

- unexpected errors;
- startup information;
- deployment information.

Sensitive information must never be logged.

Examples:

- passwords;
- JWT secrets;
- authentication tokens.

---

# Version 1 Checklist

Infrastructure

- [ ] Create Cloudflare Worker
- [ ] Configure Wrangler
- [ ] Create D1 database
- [ ] Configure Drizzle

Core

- [ ] Health endpoint
- [ ] Job Tracker CRUD
- [ ] Health Monitor CRUD
- [ ] Filtering
- [ ] Pagination
- [ ] Demo data support
- [ ] Seed

Validation

- [ ] Zod schemas
- [ ] Error handling

Testing

- [ ] Postman collection
- [ ] Manual endpoint verification

Deployment

- [ ] Deploy to Cloudflare

---

# Version 2 Checklist

Authentication

- [ ] Users table
- [ ] Password hashing
- [ ] Register endpoint
- [ ] Login endpoint
- [ ] JWT issuing
- [ ] Authentication middleware
- [ ] Authorization middleware

Roles

- [ ] ADMIN
- [ ] GUEST

Demo Data

- [ ] Guest users work only with demo data
- [ ] Admin users work with real data

---

# Version 3 Checklist

Authentication

- [ ] Google Login

Documentation

- [ ] OpenAPI specification
- [ ] Swagger UI

Platform

- [ ] Production monitoring
- [ ] API versioning (if required)

---

# Related Documents

This document should be read together with:

- `architecture.md`
- `roadmap.md`
- `models.md`
- `api.md`
- `deployment.md`
- `decisions.md`

---

# Development Philosophy

The project follows one simple principle:

> Documentation defines the system.

Implementation follows the documentation.

When implementation and documentation diverge, the documentation should be reviewed first.

The goal is to keep architecture, API contract and implementation synchronized throughout the entire project.
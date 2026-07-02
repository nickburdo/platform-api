# Platform API

> A reusable REST API platform built with Hono, Cloudflare Workers, D1 and Drizzle ORM.
>
> The project is designed to serve multiple frontend applications through a single, framework-independent REST API.

---

# Project Goals

Platform API is intended to provide:

- reusable REST API;
- serverless deployment;
- type-safe development;
- framework-independent backend;
- simple deployment;
- comprehensive documentation.

Supported clients include:

- Vue
- React
- Mobile
- CLI
- Any HTTP client (curl, JetBrains HTTP Client, Postman)
- Third-party integrations

Production: **https://platform-api.nick-burdo.workers.dev**

---

# Technology Stack

| Technology | Purpose |
|------------|---------|
| TypeScript | Programming language |
| Hono | HTTP framework |
| Cloudflare Workers | Runtime |
| Cloudflare D1 | Two independent databases (`job-tracker-db`, `health-monitor-db`) |
| Drizzle ORM | ORM |
| Zod | Validation |
| Vitest | Automated tests (incl. real-D1 runs via `@cloudflare/vitest-pool-workers`) |
| Wrangler | Development & Deployment |

---

# Project Architecture

For the complete architecture documentation see:

```
docs/architecture.md
```

---

# Documentation

The project documentation is organized by responsibility.

| Document | Description |
|----------|-------------|
| `docs/index.md` | Documentation table of contents |
| `docs/architecture.md` | System architecture and design principles |
| `docs/roadmap.md` | Project roadmap |
| `docs/models.md` | Business entities |
| `docs/api.md` | REST API specification |
| `docs/development.md` | Development guide |
| `docs/deployment.md` | Deployment guide |
| `docs/decisions.md` | Architectural decisions (ADR) |
| `docs/plans/` | Per-version implementation plans with decision logs |

---

# Development Workflow

Every feature should follow the same workflow.

```text
Architecture
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

Documentation is written before implementation.

---

# Project Structure

```text
README.md            this file
src/                 application code (routes, services, schemas, middleware, db)
http/                JetBrains HTTP Client request files (manual testing)
docs/
├── index.md         documentation table of contents
├── architecture.md
├── roadmap.md
├── models.md
├── api.md
├── development.md
├── deployment.md
├── decisions.md
└── plans/           one implementation plan per version, with decision log
```

---

# Current Features

Version 1

- Cloudflare Workers
- Hono
- D1
- Drizzle ORM
- Job Tracker
- Health Monitor
- Demo data
- Seed
- REST API

Version 2

- Authentication
- JWT
- Roles

Version 3

- Google Login
- OpenAPI
- Swagger UI

See:

```
docs/roadmap.md
```

---

# API Resources

## Job Tracker

- Job Applications
- Job Metadata

## Health Monitor

- Dashboard
- Glucose
- Blood Pressure
- Weight
- Symptoms

---

# Design Principles

The project follows several principles.

- API First
- REST
- Serverless
- Type Safety
- Simplicity First
- Documentation First

Detailed explanation:

```
docs/architecture.md
```

---

# Quick Start

Install dependencies.

```bash
npm install
```

Run the development server (against the cloud D1 databases — the project has no local database).

```bash
npm run dev
```

Run the test suite.

```bash
npm test
```

Deploy.

```bash
npx wrangler deploy
```

More information:

```
docs/development.md

docs/deployment.md
```

---

# Contributing

Before implementing new functionality:

1. Update the data model.
2. Update the API contract.
3. Update architecture if required.
4. Implement the feature.
5. Test the API.
6. Update documentation.

---

# Future Improvements

Planned improvements include:

- PostgreSQL
- Redis
- Cloudflare Queues
- Object Storage
- Full-text Search
- OpenAPI
- Swagger UI

---

# License

Project license TBD.
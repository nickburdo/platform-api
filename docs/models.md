# Data Models

> This document describes all business entities used by the Platform API.
>
> It defines the data structures exchanged through the REST API, common conventions, validation rules and relationships between entities.
>
> Database implementation details (Drizzle, D1, SQL types, indexes) are intentionally omitted.
>
> See also:
>
> - `architecture.md`
> - `api.md`

---

# Naming Conventions

The following conventions apply to every model in the project.

## Identifiers

All entity identifiers are strings.

Example:

```ts
id: string
```

---

## Dates

All dates are serialized as ISO-8601 strings.

Example:

```text
2026-07-01T14:35:00.000Z
```

The API never returns Unix timestamps.

---

## Demo Data

Every business entity contains the following field:

```ts
isDemo: boolean
```

Purpose:

- separate demonstration data from real user data;
- allow guest users to work with the application without authentication.

Rules:

- the client never sends `isDemo`;
- the server assigns its value from the caller's identity: no valid token (guest) → `true`, valid admin token → `false`;
- the two worlds never overlap: guests read and write only demo records, the admin reads and writes only real records — including by-id operations, where a record outside the caller's scope behaves as nonexistent (`404`).

---

## Audit Fields

Most entities contain:

```ts
id
createdAt
updatedAt
```

Rules:

- `id` is immutable;
- `createdAt` never changes;
- `updatedAt` changes after every successful update.

---

# Health Monitor

Health Monitor stores medical measurements.

Records are never physically removed through the public API.

Instead, incorrect records are marked as ignored.

---

## Ignore Mechanism

Every Health Monitor entity contains:

```ts
ignored: boolean;
reason: string;
```

Ignored records remain in the database.

They can still appear in reports depending on client settings.

Ignoring a record is performed via `PATCH`.

Validation rule: when `ignored` is set to `true`, a non-empty `reason` is required. Restoring a record (`ignored: false`) conventionally sends `reason: ""`.

---

## GlucoseMeasurement

Represents a single blood glucose measurement.

### Fields

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| id | string | ✓ | Unique identifier |
| createdAt | ISO string | ✓ | Record creation time |
| updatedAt | ISO string | ✓ | Last update time |
| measuredAt | ISO string | ✓ | Measurement time |
| fastingValue | number \| null | | Fasting glucose value |
| afterMealValue | number \| null | | After-meal glucose value |
| note | string | | Optional note |
| ignored | boolean | ✓ | Ignore flag |
| reason | string | | Ignore reason |
| isDemo | boolean | ✓ | Demo data flag |

A measurement is taken either fasting or after a meal — never both at once, never neither.

### Validation Rules

- exactly one of `fastingValue` / `afterMealValue` is present (the other is `null`);
- the present value is > 0.

This also holds across partial updates: setting one value field clears the other.

---

## BloodPressureMeasurement

Represents one blood pressure measurement.

### Fields

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| systolic | number | ✓ | Systolic pressure |
| diastolic | number | ✓ | Diastolic pressure |
| pulse | number | ✓ | Heart rate |

Common fields are inherited from the previous model.

### Validation Rules

- systolic > diastolic
- pulse > 0

---

## WeightMeasurement

Represents a body weight measurement.

### Fields

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| value | number | ✓ | Weight in kilograms |

Common fields are inherited.

### Validation Rules

- value > 0

---

## SymptomEntry

Represents a manually entered symptom.

### Fields

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| happenedAt | ISO string | ✓ | Time when symptom occurred |
| type | string | ✓ | Symptom type |
| intensity | number | ✓ | Severity (1..10) |
| note | string | | Additional information |

Common fields are inherited.

### Validation Rules

- intensity ∈ [1,10]

---

## DashboardData

Aggregated data returned by dashboard endpoints.

```ts
interface DashboardData {
    glucoseMeasurements: GlucoseMeasurement[];
    bloodPressureMeasurements: BloodPressureMeasurement[];
    weightMeasurements: WeightMeasurement[];
    symptomEntries: SymptomEntry[];
}
```

---

# Job Tracker

Job Tracker stores information about submitted job applications.

Unlike Health Monitor, job applications can be physically deleted.

---

## JobApplicationStatus

```ts
type JobApplicationStatus =
    | 'SAVED'
    | 'APPLIED'
    | 'SCREENING'
    | 'TECHNICAL_INTERVIEW'
    | 'FINAL_INTERVIEW'
    | 'OFFER'
    | 'REJECTED'
    | 'WITHDRAWN'
    | 'ARCHIVED';
```

---

## RemoteType

```ts
type RemoteType =
    | 'REMOTE'
    | 'HYBRID'
    | 'OFFICE';
```

---

## Status Lifecycle

Typical application flow:

```text
SAVED
   │
   ▼
APPLIED
   │
   ▼
SCREENING
   │
   ▼
TECHNICAL_INTERVIEW
   │
   ▼
FINAL_INTERVIEW
   │
   ├────────────► OFFER
   │
   ├────────────► REJECTED
   │
   └────────────► WITHDRAWN

ARCHIVED may be applied at any time.
```

---

## JobApplication

Represents a single job application.

### Fields

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| company | string | ✓ | Company name |
| position | string | ✓ | Position title |
| vacancyUrl | string | | Vacancy URL |
| status | JobApplicationStatus | ✓ | Current status |
| source | string | | Source (LinkedIn, Djinni, etc.) |
| salaryMin | number | | Minimum salary |
| salaryMax | number | | Maximum salary |
| currency | string | | Salary currency, defaults to `"USD"` when omitted on create |
| location | string | | Job location |
| remoteType | RemoteType | | `REMOTE` \| `HYBRID` \| `OFFICE` |
| notes | string | | User notes |
| appliedAt | ISO string | | Application date |
| nextFollowUpAt | ISO string | | Planned follow-up |
| isDemo | boolean | ✓ | Demo data flag |

### Validation Rules

- company is required
- position is required
- salaryMin ≤ salaryMax
- appliedAt ≤ nextFollowUpAt

---

## Searchable Fields

The following fields participate in text search:

- company
- position
- source
- notes

---

## Filterable Fields

The following fields can be filtered:

- status
- company

---

## Sortable Fields

Recommended sorting fields:

- createdAt
- updatedAt
- appliedAt
- company

---

## JobsMeta

Returned by:

```http
GET /jobs/meta
```

### Fields

```ts
interface JobsMeta {
    companies: string[];
    statuses: JobApplicationStatus[];
    stats: JobsStats;
}
```

---

## JobsStats

```ts
interface JobsStats {
    total: number;

    interviews: number;
    interviewRate: number;

    offers: number;
    offerRate: number;

    rejections: number;
    rejectionRate: number;
}
```

Rates are calculated as:

```text
count / total
```

---

# Authentication

Authentication is introduced in Version 2.

The application is **single-tenant**: exactly one real user (the admin) exists. "Guest" is **not** a stored account or role — it is the absence of a valid `Authorization` token on a request. Guests are scoped to demo data; the admin is scoped to real data (see Demo Data above).

---

## UserRole

```ts
type UserRole = 'ADMIN';
```

The `role` column exists for schema durability (future multi-role support), but only ever holds `'ADMIN'` in Version 2. `GUEST` is never persisted.

---

## User

```ts
interface User {
    id: string;
    email: string;
    passwordHash: string;
    role: UserRole;
    createdAt: string;
    updatedAt: string;
}
```

Rules:

- only one row ever exists (the single admin), created via an out-of-band bootstrap script — there is no public registration;
- `email` is stored lowercase and unique;
- `passwordHash` (salted PBKDF2, self-describing parameter format) is **never** serialized into any API response;
- the `User` entity has no `isDemo` field — it lives in its own `auth-db` database, separate from both business domains.

---

# Relationships

```text
User (Version 2, single admin — implicit ownership, no foreign keys)
        │
        ├───────────────┐
        │               │
        ▼               ▼
JobApplication    Health Monitor
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
     Glucose     BloodPressure   Weight
                      │
                      ▼
                 SymptomEntry
```

Ownership is implicit: all `isDemo: false` records belong to the single admin. No `userId` column exists on any business entity — the `isDemo` flag is the only data partition, and the three databases (`auth-db`, `job-tracker-db`, `health-monitor-db`) never reference each other.

---

# Future Extensions

Possible future entities include:

- Attachments
- Companies
- Contacts
- Interview Notes
- Tags
- Skills

These entities are intentionally omitted from Version 1.
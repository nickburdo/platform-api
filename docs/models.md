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

## Ownership and Demo Data

Every business entity belongs to a user. In storage each row carries a nullable owner reference:

```ts
userId: string | null
```

Purpose:

- keep every user's data private — an authenticated user sees only their own records;
- keep a set of **demo records** (`userId` is `null`) that guests can browse without an account.

Rules:

- the client never sends `userId`; it is also never returned in API responses;
- the server derives the scope from the caller's identity: no valid token (guest) → demo records only (`userId IS NULL`), read-only; valid token → records where `userId` equals the caller's id;
- the worlds never overlap — guests never see user data, users never see demo data or each other's data — including by-id operations, where a record outside the caller's scope behaves as nonexistent (`404`);
- demo records are created and changed only through the seed — plus, for Health Monitor, the daily date shift below.

### Health Monitor Demo Date Shift (V4.2)

A daily Cron Trigger (00:00 UTC) moves every date of the Health Monitor demo records — `measuredAt` / `happenedAt`, `createdAt`, `updatedAt` — forward by the number of **whole days** elapsed since the last shift, so the demo data keeps looking current. User records are never touched. Job Tracker demo records are not shifted. See ADR-015.

The state is a single-row internal table in `health-monitor-db` (not exposed by the API):

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer, primary key | always `1` (`CHECK (id = 1)`) |
| `refreshed_at` | text, ISO-8601 | moment the demo dates correspond to; set by the seed, advanced by exactly N days on every shift |

Without this row (no seed run since the table was created) the shift does nothing.

---

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

## Free-text Note Field: Known Naming Inconsistency

`JobApplication` has `notes` (plural); every Health Monitor entity (`GlucoseMeasurement`, `BloodPressureMeasurement`, `WeightMeasurement`, `SymptomEntry`) has `note` (singular) — both are the same kind of optional free-text field, named differently.

This was surfaced during V3 Section 4's response-shape review and deliberately left as-is: renaming either field is a breaking change to an already-deployed, already-documented contract (a DB column rename plus a client-facing field rename), which is out of scope for a developer-experience pass. Revisit only alongside an actual API version bump, not as a standalone fix.

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
| fastingValue | number \| null | | Fasting glucose value, mmol/L |
| afterMealValue | number \| null | | After-meal glucose value, mmol/L |
| note | string | | Optional note |
| ignored | boolean | ✓ | Ignore flag |
| reason | string | | Ignore reason |

A measurement is taken either fasting or after a meal — never both at once, never neither.

All glucose values are in **mmol/L** (mg/dL ÷ 18). The unit is not stored per record and not validated beyond `> 0` (Version 4.3).

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

Authentication is introduced in Version 2; Version 4 makes it an open multi-user model (ADR-014).

"Guest" is **not** a stored account or role — it is the absence of a valid `Authorization` token on a request. Guests are scoped to demo data, read-only; a user is scoped to their own data (see Ownership and Demo Data above). There are no roles: all users are equal.

---

## User

```ts
interface User {
    id: string;
    username: string;
    passwordHash?: string;
    googleSub?: string;
    createdAt: string;
    updatedAt: string;
}
```

Rules:

- `username`: 3–32 characters, `[A-Za-z0-9_-]`; unique **case-insensitively**; stored and displayed as entered;
- `passwordHash` (salted PBKDF2, self-describing parameter format) is absent for Google-only accounts and is **never** serialized into any API response;
- `googleSub` is Google's stable account identifier (OpenID `sub`); absent for accounts that never used Google; unique; never serialized into any API response;
- **invariant:** at least one of `passwordHash` / `googleSub` is present — an account always has a way to sign in;
- no email is collected or stored; there is no role field;
- the API exposes a derived `hasPassword: boolean` instead of the hash (see `api.md`);
- the `User` entity has no `userId`/owner field — it lives in its own `auth-db` database, separate from both business domains.

---

# Relationships

```text
User (auth-db) — owns records by plain-text reference, no foreign keys
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

Ownership is a plain `userId` text column on each business entity (`NULL` = demo record). It is not a foreign key, because the three databases (`auth-db`, `job-tracker-db`, `health-monitor-db`) never reference each other. Deleting an account therefore removes the user's rows in each business database explicitly (see `api.md`, `DELETE /auth/me`).

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
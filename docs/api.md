# REST API

> This document describes the public REST API contract for the Platform API project.
>
> It defines resources, endpoints, request formats, response formats, filtering, pagination and error conventions.
>
> The document is intentionally written in a format that can later be converted into an OpenAPI / Swagger specification.

---

# API Conventions

## Base URL

Development:

```http
http://localhost:8787
```

Production:

```http
https://platform-api.nick-burdo.workers.dev
```

---

## Content Type

All requests and responses use JSON.

```http
Content-Type: application/json
```

---

## Response Wrapper

All successful responses are wrapped in a `data` field.

```json
{
  "data": {}
}
```

List responses use:

```json
{
  "data": []
}
```

Paginated responses additionally include `meta`.

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

---

## Error Response

All errors use the same structure.

```json
{
  "error": {
    "message": "Validation error",
    "details": {}
  }
}
```

For validation errors (`400`), `details` is Zod's flattened field-error map: each key is a field name, each value an array of messages. Errors that belong to the request body as a whole — an unrecognized key, or an empty `PATCH` body — appear under the root key `_errors`:

```json
{
  "error": {
    "message": "Validation error",
    "details": {
      "salaryMin": ["salaryMin must be less than or equal to salaryMax"],
      "_errors": ["Unrecognized key: \"isDemo\""]
    }
  }
}
```

For non-validation errors (`404`, `500`, malformed JSON), `details` is omitted and only `message` is present.

### Strict Request Bodies

`POST` and `PATCH` bodies are validated strictly:

* any unknown key — including server-managed fields and typos — is rejected with `400`;
* an empty `PATCH` body (`{}`) is rejected with `400` ("At least one field must be provided");
* a syntactically malformed JSON body is rejected with `400`.

Unknown **query parameters**, by contrast, are ignored.

---

## HTTP Status Codes

| Status | Meaning                                  |
| ------ | ---------------------------------------- |
| 200    | Successful request                       |
| 201    | Resource created                         |
| 204    | Successful request without response body |
| 302    | Redirect (Google Sign-In only)           |
| 400    | Validation error                         |
| 401    | Unauthorized                             |
| 403    | Forbidden                                |
| 404    | Resource not found                       |
| 500    | Internal server error                    |

---

## IDs

All IDs are strings.

Example:

```json
{
  "id": "job_1"
}
```

---

## Dates

All dates are ISO-8601 strings.

Example:

```json
{
  "createdAt": "2026-06-29T10:00:00.000Z"
}
```

---

## Demo Data

Business entities contain `isDemo`.

The client must not send this field.

The server derives it from the caller's identity (see Authentication):

* requests without a token (guests) read and create only demo records (`isDemo: true`);
* requests with a valid admin token read and create only real records (`isDemo: false`);
* the two worlds never overlap — a record outside the caller's scope behaves as nonexistent: by-id operations return `404`;
* seed data is created with `isDemo: true`.

---

## Authentication

Authentication is introduced in Version 2. The application is single-tenant: one admin account, no public registration.

Identity resolution on every request:

* **no `Authorization` header** — the request proceeds as a **guest**, scoped to demo data. All V1 endpoints keep working without a token.
* **`Authorization: Bearer <token>` with a valid, unexpired token** — the request proceeds as the **admin**, scoped to real data.
* **header present but invalid, malformed or expired** — `401 Unauthorized` on any endpoint. A stale token is never silently downgraded to guest:

```json
{
  "error": {
    "message": "Invalid or expired token"
  }
}
```

Tokens are JWTs (HS256) issued by `POST /auth/login`, valid for 30 days. Payload: `sub` (user id), `role`, `iat`, `exp`. There is no refresh token and no server-side logout — the client discards the token.

```http
Authorization: Bearer <access_token>
```

---

# Job Tracker API

Job Tracker manages job applications.

Unlike Health Monitor records, job applications may be physically deleted.

---

# Job Application Resource

## GET /jobs

Returns a paginated list of job applications.

---

### Query Parameters

| Name    | Type                 | Required | Description                                         |
| ------- | -------------------- | -------- | --------------------------------------------------- |
| page    | number               | No       | Page number. Starts from `1`. Default: `1`.         |
| limit   | number               | No       | Number of records per page. Default: `20`.          |
| status  | JobApplicationStatus | No       | Filter by status.                                   |
| company | string               | No       | Filter by company name.                             |
| search  | string               | No       | Search by `company`, `position`, `source`, `notes`. |

---

### Example

```http
GET /jobs?page=1&limit=20&status=APPLIED&company=Google&search=frontend
```

---

### Response

```json
{
  "data": [
    {
      "id": "job_1",
      "company": "Google",
      "position": "Frontend Developer",
      "vacancyUrl": "https://example.com/jobs/1",
      "status": "APPLIED",
      "source": "LinkedIn",
      "salaryMin": 3000,
      "salaryMax": 5000,
      "currency": "USD",
      "location": "Remote",
      "remoteType": "REMOTE",
      "notes": "Interesting position",
      "appliedAt": "2026-06-29T10:00:00.000Z",
      "nextFollowUpAt": "2026-07-06T10:00:00.000Z",
      "createdAt": "2026-06-29T10:00:00.000Z",
      "updatedAt": "2026-06-29T10:00:00.000Z",
      "isDemo": false
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 73,
    "totalPages": 4
  }
}
```

---

## GET /jobs/:id

Returns a single job application.

---

### Path Parameters

| Name | Type   | Required | Description        |
| ---- | ------ | -------- | ------------------ |
| id   | string | Yes      | Job application ID |

---

### Example

```http
GET /jobs/job_1
```

---

### Response

```json
{
  "data": {
    "id": "job_1",
    "company": "Google",
    "position": "Frontend Developer",
    "vacancyUrl": "https://example.com/jobs/1",
    "status": "APPLIED",
    "source": "LinkedIn",
    "salaryMin": 3000,
    "salaryMax": 5000,
    "currency": "USD",
    "location": "Remote",
    "remoteType": "REMOTE",
    "notes": "Interesting position",
    "appliedAt": "2026-06-29T10:00:00.000Z",
    "nextFollowUpAt": "2026-07-06T10:00:00.000Z",
    "createdAt": "2026-06-29T10:00:00.000Z",
    "updatedAt": "2026-06-29T10:00:00.000Z",
    "isDemo": false
  }
}
```

---

## POST /jobs

Creates a job application.

---

### Request Body

```json
{
  "company": "Google",
  "position": "Frontend Developer",
  "vacancyUrl": "https://example.com/jobs/1",
  "status": "APPLIED",
  "source": "LinkedIn",
  "salaryMin": 3000,
  "salaryMax": 5000,
  "currency": "USD",
  "location": "Remote",
  "remoteType": "REMOTE",
  "notes": "Interesting position",
  "appliedAt": "2026-06-29T10:00:00.000Z",
  "nextFollowUpAt": "2026-07-06T10:00:00.000Z"
}
```

---

### Server Managed Fields

The client must not send:

* `id`
* `createdAt`
* `updatedAt`
* `isDemo`

Sending any of them is rejected with `400` (see Strict Request Bodies).

When omitted, `status` defaults to `SAVED` and `currency` defaults to `"USD"`.

---

### Response

Status:

```http
201 Created
```

```json
{
  "data": {
    "id": "job_1",
    "company": "Google",
    "position": "Frontend Developer",
    "vacancyUrl": "https://example.com/jobs/1",
    "status": "APPLIED",
    "source": "LinkedIn",
    "salaryMin": 3000,
    "salaryMax": 5000,
    "currency": "USD",
    "location": "Remote",
    "remoteType": "REMOTE",
    "notes": "Interesting position",
    "appliedAt": "2026-06-29T10:00:00.000Z",
    "nextFollowUpAt": "2026-07-06T10:00:00.000Z",
    "createdAt": "2026-06-29T10:00:00.000Z",
    "updatedAt": "2026-06-29T10:00:00.000Z",
    "isDemo": false
  }
}
```

---

## PATCH /jobs/:id

Updates a job application.

All fields are optional.

---

### Request Body

```json
{
  "status": "SCREENING",
  "notes": "Recruiter contacted me",
  "nextFollowUpAt": "2026-07-10T10:00:00.000Z"
}
```

---

### Response

```json
{
  "data": {
    "id": "job_1",
    "company": "Google",
    "position": "Frontend Developer",
    "vacancyUrl": "https://example.com/jobs/1",
    "status": "SCREENING",
    "source": "LinkedIn",
    "salaryMin": 3000,
    "salaryMax": 5000,
    "currency": "USD",
    "location": "Remote",
    "remoteType": "REMOTE",
    "notes": "Recruiter contacted me",
    "appliedAt": "2026-06-29T10:00:00.000Z",
    "nextFollowUpAt": "2026-07-10T10:00:00.000Z",
    "createdAt": "2026-06-29T10:00:00.000Z",
    "updatedAt": "2026-06-29T12:00:00.000Z",
    "isDemo": false
  }
}
```

---

## DELETE /jobs/:id

Physically deletes a job application.

---

### Example

```http
DELETE /jobs/job_1
```

---

### Response

```json
{
  "data": {
    "success": true
  }
}
```

---

### Errors

A malformed body — here, `salaryMin` greater than `salaryMax` — returns `400` (`POST`/`PATCH`):

```json
{
  "error": {
    "message": "Validation error",
    "details": {
      "salaryMin": ["salaryMin must be less than or equal to salaryMax"]
    }
  }
}
```

An invalid or expired token returns `401` on any Job Application endpoint (see Authentication).

An unknown or out-of-scope job application ID returns `404` (`GET`/`PATCH`/`DELETE /jobs/:id`):

```json
{
  "error": {
    "message": "Resource not found"
  }
}
```

---

# Job Metadata Resource

## GET /jobs/meta

Returns metadata used by Job Tracker filters and statistics widgets.

---

### Response

```json
{
  "data": {
    "companies": ["Google", "Microsoft", "Meta"],
    "statuses": ["APPLIED", "SCREENING", "REJECTED"],
    "stats": {
      "interviewRate": 0.0273972602739726,
      "interviews": 2,
      "offerRate": 0,
      "offers": 0,
      "rejectionRate": 0.0136986301369863,
      "rejections": 1,
      "total": 73
    }
  }
}
```

---

### Stats Rules

| Field         | Rule                                         |
| ------------- | -------------------------------------------- |
| total         | Total number of job applications             |
| interviews    | Count of interview-related applications      |
| interviewRate | `interviews / total`                         |
| offers        | Count of applications with `OFFER` status    |
| offerRate     | `offers / total`                             |
| rejections    | Count of applications with `REJECTED` status |
| rejectionRate | `rejections / total`                         |

Interview-related statuses:

* `SCREENING`
* `TECHNICAL_INTERVIEW`
* `FINAL_INTERVIEW`

---

# Health Monitor API

Health Monitor manages medical measurements.

Health Monitor list endpoints are not paginated.

Records are not physically deleted through the public API.

Incorrect records are marked as ignored using `PATCH`.

---

## Common Query Parameters

All Health Monitor collection endpoints support date range filtering.

| Name      | Type       | Required | Description |
| --------- | ---------- | -------- | ----------- |
| date_from | ISO string | No       | Start date  |
| date_to   | ISO string | No       | End date    |

---

## Ignore / Unignore Convention

Any Health Monitor record can be ignored by sending:

```json
{
  "ignored": true,
  "reason": "Incorrect measurement"
}
```

It can be restored by sending:

```json
{
  "ignored": false,
  "reason": ""
}
```

A non-empty `reason` is required whenever `ignored: true` is sent — `{ "ignored": true }` alone is a `400`.

Health Monitor create bodies must not include `ignored`/`reason` (server-managed on create, rejected with `400`).

---

# Glucose Resource

## GET /glucose

Returns glucose measurements.

---

### Example

```http
GET /glucose?date_from=2026-06-01&date_to=2026-06-30
```

---

### Response

```json
{
  "data": [
    {
      "id": "glucose_1",
      "createdAt": "2026-06-29T10:00:00.000Z",
      "updatedAt": "2026-06-29T10:00:00.000Z",
      "measuredAt": "2026-06-29T08:00:00.000Z",
      "fastingValue": 5.4,
      "afterMealValue": null,
      "note": "Before breakfast",
      "ignored": false,
      "reason": "",
      "isDemo": false
    }
  ]
}
```

Exactly one of `fastingValue` / `afterMealValue` is populated per record; the other is `null` (see `models.md`).

---

## POST /glucose

Creates a glucose measurement.

---

### Request Body

```json
{
  "measuredAt": "2026-06-29T08:00:00.000Z",
  "fastingValue": 5.4,
  "note": "Before breakfast"
}
```

Exactly one of `fastingValue` / `afterMealValue` must be provided — both or neither is a `400`. The provided value must be greater than `0`.

---

## PATCH /glucose/:id

Updates, ignores or restores a glucose measurement.

---

### Request Body

```json
{
  "ignored": true,
  "reason": "Incorrect measurement"
}
```

---

### Errors

Both `fastingValue`/`afterMealValue` provided returns `400` on `POST`/`PATCH`; neither provided returns `400` on `POST` only — a `PATCH` may omit both (e.g. to update just `note`, or to ignore/restore a record):

```json
{
  "error": {
    "message": "Validation error",
    "details": {
      "fastingValue": ["Exactly one of fastingValue or afterMealValue must be provided"]
    }
  }
}
```

An invalid or expired token returns `401` on any Glucose endpoint (see Authentication).

An unknown or out-of-scope glucose measurement ID returns `404` (`PATCH /glucose/:id`):

```json
{
  "error": {
    "message": "Resource not found"
  }
}
```

---

# Blood Pressure Resource

## GET /blood-pressure

Returns blood pressure measurements.

---

### Example

```http
GET /blood-pressure?date_from=2026-06-01&date_to=2026-06-30
```

---

## POST /blood-pressure

Creates a blood pressure measurement.

---

### Request Body

```json
{
  "measuredAt": "2026-06-29T08:00:00.000Z",
  "systolic": 120,
  "diastolic": 80,
  "pulse": 72,
  "note": "Morning measurement"
}
```

---

## PATCH /blood-pressure/:id

Updates, ignores or restores a blood pressure measurement.

---

### Request Body

```json
{
  "ignored": true,
  "reason": "Wrong cuff position"
}
```

---

### Errors

`systolic` not greater than `diastolic` returns `400` (`POST`/`PATCH`):

```json
{
  "error": {
    "message": "Validation error",
    "details": {
      "systolic": ["systolic must be greater than diastolic"]
    }
  }
}
```

An invalid or expired token returns `401` on any Blood Pressure endpoint (see Authentication).

An unknown or out-of-scope blood pressure measurement ID returns `404` (`PATCH /blood-pressure/:id`):

```json
{
  "error": {
    "message": "Resource not found"
  }
}
```

---

# Weight Resource

## GET /weight

Returns weight measurements.

---

### Example

```http
GET /weight?date_from=2026-06-01&date_to=2026-06-30
```

---

## POST /weight

Creates a weight measurement.

---

### Request Body

```json
{
  "measuredAt": "2026-06-29T08:00:00.000Z",
  "value": 82.5,
  "note": "Morning"
}
```

---

## PATCH /weight/:id

Updates, ignores or restores a weight measurement.

---

### Request Body

```json
{
  "ignored": true,
  "reason": "Measurement duplicated"
}
```

---

### Errors

A non-positive `value` returns `400` (`POST`/`PATCH`):

```json
{
  "error": {
    "message": "Validation error",
    "details": {
      "value": ["value must be greater than 0"]
    }
  }
}
```

An invalid or expired token returns `401` on any Weight endpoint (see Authentication).

An unknown or out-of-scope weight measurement ID returns `404` (`PATCH /weight/:id`):

```json
{
  "error": {
    "message": "Resource not found"
  }
}
```

---

# Symptoms Resource

## GET /symptoms

Returns symptom entries.

---

### Example

```http
GET /symptoms?date_from=2026-06-01&date_to=2026-06-30
```

---

## POST /symptoms

Creates a symptom entry.

---

### Request Body

```json
{
  "happenedAt": "2026-06-29T08:00:00.000Z",
  "type": "HEADACHE",
  "intensity": 3,
  "note": "Mild headache"
}
```

---

## PATCH /symptoms/:id

Updates, ignores or restores a symptom entry.

---

### Request Body

```json
{
  "ignored": true,
  "reason": "Created by mistake"
}
```

---

### Errors

An `intensity` outside `1`–`10` returns `400` (`POST`/`PATCH`):

```json
{
  "error": {
    "message": "Validation error",
    "details": {
      "intensity": ["intensity must be a whole number between 1 and 10"]
    }
  }
}
```

An invalid or expired token returns `401` on any Symptoms endpoint (see Authentication).

An unknown or out-of-scope symptom entry ID returns `404` (`PATCH /symptoms/:id`):

```json
{
  "error": {
    "message": "Resource not found"
  }
}
```

---

# Dashboard Resource

## GET /dashboard

Returns aggregated Health Monitor data.

---

### Query Parameters

| Name      | Type       | Required | Description |
| --------- | ---------- | -------- | ----------- |
| date_from | ISO string | No       | Start date  |
| date_to   | ISO string | No       | End date    |

---

### Response

```json
{
  "data": {
    "glucoseMeasurements": [],
    "bloodPressureMeasurements": [],
    "weightMeasurements": [],
    "symptomEntries": []
  }
}
```

---

### Errors

`date_from` after `date_to` returns `400`:

```json
{
  "error": {
    "message": "Validation error",
    "details": {
      "date_from": ["date_from must be less than or equal to date_to"]
    }
  }
}
```

An invalid or expired token returns `401` (see Authentication). There is no `404` case — `/dashboard` is not a by-id resource.

---

# Authentication API

Introduced in Version 2. See the Authentication section above for identity-resolution rules.

Version 3 adds Google Sign-In as an alternative login method for the same single admin account — see ADR-013. It never creates a new account: a Google account whose email doesn't match the existing admin is rejected.

---

## POST /auth/register

**Not implemented.** The application is single-tenant: the only account (the admin) is provisioned once via an out-of-band bootstrap script (`scripts/create-admin.ts`, see `development.md`), never through the public API. Self-service registration is intentionally deferred until a multi-user version is actually needed.

Requests to this path return the standard `404` envelope.

---

## POST /auth/login

Authenticates the admin and returns an access token.

### Request Body

```json
{
  "email": "admin@example.com",
  "password": "correct horse battery staple"
}
```

### Response

```json
{
  "data": {
    "token": "<jwt>",
    "user": {
      "id": "user_1",
      "email": "admin@example.com",
      "role": "ADMIN",
      "createdAt": "2026-07-02T10:00:00.000Z",
      "updatedAt": "2026-07-02T10:00:00.000Z"
    }
  }
}
```

`passwordHash` is never included.

### Errors

Wrong email and wrong password are indistinguishable — both return:

```http
401 Unauthorized
```

```json
{
  "error": {
    "message": "Invalid credentials"
  }
}
```

A structurally invalid body (missing/malformed fields, unknown keys) returns `400` with the standard validation envelope.

---

## GET /auth/me

Returns the current authenticated user. Requires a valid admin token.

### Response

```json
{
  "data": {
    "id": "user_1",
    "email": "admin@example.com",
    "role": "ADMIN",
    "createdAt": "2026-07-02T10:00:00.000Z",
    "updatedAt": "2026-07-02T10:00:00.000Z"
  }
}
```

### Errors

Missing, invalid or expired token:

```http
401 Unauthorized
```

---

## GET /auth/google

Redirects the browser to Google's consent screen to begin Google Sign-In. Requested scope: `openid email` only.

### Response

```http
302 Found
Location: https://accounts.google.com/o/oauth2/v2/auth?...&state=<signed-state>
```

`state` is a short-lived (10 minute), server-signed token — not a value the client generates or interprets.

---

## GET /auth/google/callback

Google redirects here after the user consents, with `code` and `state` query parameters. On success, behaves exactly like a successful `POST /auth/login`:

### Response

```json
{
  "data": {
    "token": "<jwt>",
    "user": {
      "id": "user_1",
      "email": "admin@example.com",
      "role": "ADMIN",
      "createdAt": "2026-07-02T10:00:00.000Z",
      "updatedAt": "2026-07-02T10:00:00.000Z"
    }
  }
}
```

The issued token is identical in shape (claims, expiry) to one issued by `POST /auth/login` — callers cannot tell which method was used to obtain it.

### Errors

`state` missing, invalid, expired, or not issued by this server → `401`, before any call to Google is made:

```json
{
  "error": {
    "message": "Invalid or expired state"
  }
}
```

`state` valid, but the Google account's email doesn't match the existing admin's email (case-insensitive), Google reports the email as unverified, or the token/userinfo exchange with Google itself fails → `401`. **No account is ever created** in any of these cases:

```json
{
  "error": {
    "message": "Invalid credentials"
  }
}
```

---

# OpenAPI / Swagger Notes

This document should be treated as the human-readable source for the future OpenAPI specification.

When OpenAPI is added, the following sections should be mapped directly:

* resources;
* endpoints;
* path parameters;
* query parameters;
* request bodies;
* response bodies;
* error responses;
* authentication rules.

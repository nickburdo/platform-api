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
      "_errors": ["Unrecognized key: \"userId\""]
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
| 400    | Validation error (also: disallowed `redirect`, invalid or expired link ticket) |
| 401    | Unauthorized (guest on a write endpoint, invalid token, wrong credentials) |
| 403    | Forbidden                                |
| 404    | Resource not found                       |
| 409    | Conflict (username taken, Google already linked or used by another user, password already set) |
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

## Data Ownership and Demo Data

Business entities belong to a user. The ownership column (`userId`) is internal: it is never present in responses, and the client must not send it (strict bodies reject it, see Strict Request Bodies).

The server derives the scope from the caller's identity (see Authentication):

* requests without a token (**guests**) read only **demo records** — read-only, no write is possible;
* requests with a valid token (**users**) read and write only **their own records** — demo records are not visible to them;
* the worlds never overlap — a record outside the caller's scope behaves as nonexistent: by-id operations return `404`, and the existence of other users' records is never disclosed;
* demo records are changed only through the seed (`seed.sql`).

---

## Authentication

Authentication is introduced in Version 2. Since Version 4 the API is multi-user: anyone can register an account with a username and password (no email is collected), or sign in with Google. All users are equal — there are no roles.

Identity resolution on every request:

* **no `Authorization` header** — the request proceeds as a **guest**, scoped to demo data, **read-only**. Reads work without a token; any write (`POST`, `PATCH`, `DELETE`, ignore/restore) is `401 Authentication required`.
* **`Authorization: Bearer <token>` with a valid, unexpired token of an existing user** — the request proceeds as that **user**, scoped to the user's own data.
* **header present but the token is invalid, malformed or expired, or the account it belongs to has been deleted** — `401 Unauthorized` on any endpoint. A stale token is never silently downgraded to guest:

```json
{
  "error": {
    "message": "Invalid or expired token"
  }
}
```

"Any endpoint" includes `POST /auth/register` and `POST /auth/login`: a request that carries a stale token there also gets this `401` instead of registering or logging in. Clients must therefore **not** send an `Authorization` header to `/auth/register` or `/auth/login` (and should drop a stored token once it gets a `401 Invalid or expired token`).

A guest calling a write endpoint (or `GET`/`DELETE /auth/me`, `POST /auth/me/password`, `POST /auth/google/link`, `POST /auth/google/link/complete`) receives:

```json
{
  "error": {
    "message": "Authentication required"
  }
}
```

The check runs **before request body validation**: a guest sending an invalid body to a write endpoint gets `401`, not `400`. Frontends use this `401` to show a "register to add your own data" prompt (see `frontend-guide.md`).

Tokens are JWTs (HS256) issued by `POST /auth/register`, `POST /auth/login` and the Google callback, valid for 30 days. Payload: `sub` (user id), `iat`, `exp`. Tokens obtained by any method are indistinguishable. On every authenticated request the API checks that the user still exists. There is no refresh token and no server-side logout — the client discards the token.

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
      "updatedAt": "2026-06-29T10:00:00.000Z"
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
    "updatedAt": "2026-06-29T10:00:00.000Z"
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
* `userId`

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
    "updatedAt": "2026-06-29T10:00:00.000Z"
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
    "updatedAt": "2026-06-29T12:00:00.000Z"
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

A guest (no token) calling a write endpoint (`POST`/`PATCH`/`DELETE`) returns `401` with `Authentication required`, before body validation:

```json
{
  "error": {
    "message": "Authentication required"
  }
}
```

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
      "reason": ""
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

A guest (no token) calling a write endpoint (`POST`/`PATCH`) returns `401` with `Authentication required`, before body validation:

```json
{
  "error": {
    "message": "Authentication required"
  }
}
```

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

A guest (no token) calling a write endpoint (`POST`/`PATCH`) returns `401` with `Authentication required`, before body validation:

```json
{
  "error": {
    "message": "Authentication required"
  }
}
```

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

A guest (no token) calling a write endpoint (`POST`/`PATCH`) returns `401` with `Authentication required`, before body validation:

```json
{
  "error": {
    "message": "Authentication required"
  }
}
```

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

A guest (no token) calling a write endpoint (`POST`/`PATCH`) returns `401` with `Authentication required`, before body validation:

```json
{
  "error": {
    "message": "Authentication required"
  }
}
```

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

An invalid or expired token returns `401` (see Authentication). A guest receives demo data, a user receives their own data. There is no `404` case — `/dashboard` is not a by-id resource.

---

# Authentication API

Introduced in Version 2; rebuilt in Version 4 as an open multi-user model — see ADR-014. See the Authentication section above for identity-resolution rules.

A user account has a `username` and at least one login method: a password, a linked Google account, or both. No email is collected or stored anywhere.

**User object** returned by the API:

```json
{
  "id": "5b1c9a52-0e7a-4a43-9e8b-2d1a7f6c3e10",
  "username": "nick",
  "hasPassword": true,
  "createdAt": "2026-11-06T10:00:00.000Z",
  "updatedAt": "2026-11-06T10:00:00.000Z"
}
```

`hasPassword` is `false` for accounts created through Google that have not set a password. The user object never contains `passwordHash`, the Google `sub`, an email or a role.

---

## POST /auth/register

Creates an account and signs it in immediately — no separate login step.

### Request Body

```json
{
  "username": "nick",
  "password": "correct horse battery staple"
}
```

* `username`: 3–32 characters, `[A-Za-z0-9_-]` only. Unique **case-insensitively** (`Nick` and `nick` are the same name); stored and displayed as entered.
* `password`: 8–128 characters. Passwords cannot be recovered — a lost password means a lost account.

### Response

```http
201 Created
```

```json
{
  "data": {
    "token": "<jwt>",
    "user": {
      "id": "5b1c9a52-0e7a-4a43-9e8b-2d1a7f6c3e10",
      "username": "nick",
      "hasPassword": true,
      "createdAt": "2026-11-06T10:00:00.000Z",
      "updatedAt": "2026-11-06T10:00:00.000Z"
    }
  }
}
```

### Errors

Username already taken (case-insensitive) → `409`:

```json
{
  "error": {
    "message": "Username is already taken"
  }
}
```

A structurally invalid body (username/password rules, missing fields, unknown keys) returns `400` with the standard validation envelope.

---

## POST /auth/login

Authenticates a user by username and password and returns an access token. The username is matched case-insensitively (`NICK` logs into `nick`).

### Request Body

```json
{
  "username": "nick",
  "password": "correct horse battery staple"
}
```

* `username`, `password`: non-empty strings; `password` at most 128 characters (the register upper bound). No format rule is applied to `username` here — a malformed username simply matches no account and gets the `401` below, not a `400`.

Do not send an `Authorization` header: a stale token gets `401 Invalid or expired token` before the credentials are checked (see Authentication above).

### Response

```http
200 OK
```

Same shape as `POST /auth/register` (`{ data: { token, user } }`).

### Errors

Unknown username (including a malformed one), wrong password, and a Google-only account (no password) are indistinguishable — all return:

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

A structurally invalid body (missing or empty fields, a password longer than 128 characters, unknown keys) returns `400` with the standard validation envelope.

---

## GET /auth/me

Returns the current user. Requires a valid token.

### Response

```json
{
  "data": {
    "id": "5b1c9a52-0e7a-4a43-9e8b-2d1a7f6c3e10",
    "username": "nick",
    "hasPassword": true,
    "createdAt": "2026-11-06T10:00:00.000Z",
    "updatedAt": "2026-11-06T10:00:00.000Z"
  }
}
```

### Errors

No token (guest) → `401` `Authentication required`. Invalid or expired token, or a deleted account → `401` `Invalid or expired token`.

---

## DELETE /auth/me

Deletes the caller's account together with **all of its data** in every business table (job applications, glucose, blood pressure, weight, symptoms). Irreversible. No password re-entry is required (Google accounts have no password) — confirmation is the frontend's job.

### Response

```http
204 No Content
```

### Behaviour

Business data is deleted first, the account row last. A partial failure leaves the account in place, and repeating the request finishes the job. After the account is gone, its token is rejected with `401 Invalid or expired token`.

### Errors

No token (guest) → `401` `Authentication required`. Invalid or expired token → `401` `Invalid or expired token`.

---

## POST /auth/me/password

Sets a password on an account that has none — a Google-only account (`hasPassword: false`). Optional capability: frontends may or may not expose it.

### Request Body

```json
{
  "password": "correct horse battery staple",
  "username": "nick"
}
```

* `password`: required, 8–128 characters.
* `username`: optional; replaces the generated username (same rules as registration).

### Response

```http
200 OK
```

```json
{
  "data": {
    "id": "5b1c9a52-0e7a-4a43-9e8b-2d1a7f6c3e10",
    "username": "nick",
    "hasPassword": true,
    "createdAt": "2026-11-06T10:00:00.000Z",
    "updatedAt": "2026-11-06T10:05:00.000Z"
  }
}
```

### Errors

The account already has a password → `409`. There is no password change in V4:

```json
{
  "error": {
    "message": "Password is already set"
  }
}
```

The requested `username` is taken → `409` `Username is already taken` (nothing is changed). Invalid body → `400`. No token (guest) → `401` `Authentication required`; invalid or expired token → `401` `Invalid or expired token`.

---

## POST /auth/google/link

Step 1 of 2 of linking a Google account to the signed-in (password) account. Requires a valid token. This is a `POST` with a JSON body because a browser navigation cannot carry the `Authorization` header and a token must never be put into a URL.

### Request Body

```json
{
  "redirect": "https://job-tracker-new.pages.dev/auth/callback"
}
```

`redirect` must pass the frontend-origin allowlist (see `GET /auth/google`).

### Response

```http
200 OK
```

```json
{
  "data": {
    "url": "https://accounts.google.com/o/oauth2/v2/auth?...&state=<signed-state>"
  }
}
```

The frontend navigates the browser to `url`. The signed `state` carries the user id and the link intent. After consent, Google returns to `GET /auth/google/callback`, which **does not link anything**: it redirects to `<redirect>#link_ticket=<ticket>`, and the frontend finishes with step 2, `POST /auth/google/link/complete`. (The browser that completes Google's consent may not belong to the user who started the link — an attacker can hand a victim their own link URL — so the link is made only when the started-by user redeems the ticket with their own token. See ADR-014.)

### Errors

The account already has a Google account linked → `409`:

```json
{
  "error": {
    "message": "Google account is already linked"
  }
}
```

A `redirect` that fails the allowlist → `400` `redirect must be an allowed frontend URL`. No token (guest) → `401` `Authentication required`; invalid or expired token → `401` `Invalid or expired token`.

If the Google account is already linked to a different user, the failure surfaces at step 2 as `409 Google account is already used by another user` (accounts are never merged). There is no unlinking.

---

## POST /auth/google/link/complete

Step 2 of 2 of linking a Google account. Requires a valid token — the token of the same user who called `POST /auth/google/link`.

### Request Body

```json
{
  "ticket": "<link ticket>"
}
```

* `ticket`: the value of `#link_ticket=` from the callback redirect, URL-decoded (`URLSearchParams` does this). A ticket is valid for **5 minutes** and only for the user who started the link. Unknown keys → `400`.

### Response

```http
200 OK
```

```json
{
  "data": {
    "id": "5b1c9a52-0e7a-4a43-9e8b-2d1a7f6c3e10",
    "username": "nick",
    "hasPassword": true,
    "createdAt": "2026-11-06T10:00:00.000Z",
    "updatedAt": "2026-11-06T10:05:00.000Z"
  }
}
```

The updated user. From now on, Google sign-in with that Google account signs into this account.

### Errors

The ticket is malformed, tampered, expired, not a link ticket, **or was issued for a different user than the caller** → `400`. These cases are deliberately indistinguishable:

```json
{
  "error": {
    "message": "Invalid or expired link ticket"
  }
}
```

The Google account already belongs to another user → `409`:

```json
{
  "error": {
    "message": "Google account is already used by another user"
  }
}
```

The caller already has a Google account linked (for example, a second ticket redeemed after the first) → `409` `Google account is already linked`.

Missing `ticket` or unknown keys → `400` with the standard validation envelope. No token (guest) → `401` `Authentication required` (checked before the body); invalid or expired token → `401` `Invalid or expired token`. Nothing is changed on any error.

---

## GET /auth/google

Redirects the browser to Google's consent screen to begin Google Sign-In. Requested scope: `openid` only — no email is requested from Google or stored.

### Query Parameters

| Name     | Type   | Required | Description                                                                 |
| -------- | ------ | -------- | --------------------------------------------------------------------------- |
| redirect | string | Yes      | Frontend page the browser is sent back to, with the result in the URL fragment. |

`redirect` is validated against the allowlist of frontend origins (`ALLOWED_FRONTEND_ORIGINS`, plus any `http(s)://localhost:<port>` and `http(s)://127.0.0.1:<port>`): it must be an `http`/`https` URL whose origin matches an allowed origin exactly and must not contain a `#`. It is stored inside the signed `state`, so the callback trusts only what the server signed itself.

### Response

```http
302 Found
Location: https://accounts.google.com/o/oauth2/v2/auth?...&scope=openid&state=<signed-state>
```

`state` is a short-lived (10 minute), server-signed token — not a value the client generates or interprets.

### Errors

Missing or non-allowlisted `redirect` → `400` JSON, **no redirect** is made:

```json
{
  "error": {
    "message": "redirect must be an allowed frontend URL"
  }
}
```

---

## GET /auth/google/callback

Google redirects here after the user consents (or cancels), with `state` and either `code` or `error` query parameters. The result is always delivered to the frontend as a `302` to `<redirect>#...` — the token travels in the URL **fragment**, which is never sent to servers or logged.

The first Google sign-in with an unknown Google account creates a user with a generated username (`user-` + 6 hex characters) and no password. Repeat sign-ins find the existing user.

### Response

| Outcome                              | Redirect                                |
| ------------------------------------ | --------------------------------------- |
| Sign-in succeeded                    | `<redirect>#token=<jwt>`                |
| Google consent completed (`link` flow) — nothing is linked yet; redeem the ticket with `POST /auth/google/link/complete` | `<redirect>#link_ticket=<ticket>` (URL-encoded) |
| User cancelled on Google's screen    | `<redirect>#error=access_denied`        |
| Any other failure after a valid `state` (no `code`, code exchange failed, Google account unusable) | `<redirect>#error=google_failed` |

The token is identical in shape (claims, expiry) to one issued by `POST /auth/login` — callers cannot tell which method was used.

The signed `state` proves only that this server started the flow; it does not prove that the browser arriving here is the one that started it. Frontends must therefore apply the nonce rule in `frontend-guide.md` before accepting `#token=` or `#link_ticket=`.

### Errors

`state` missing, invalid, expired, or not issued by this server (this includes a state issued before a deploy that changed its format — the user simply starts again) → `401` JSON (the redirect target is unknown, so there is nobody to redirect to), before any call to Google is made:

```json
{
  "error": {
    "message": "Invalid or expired state"
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

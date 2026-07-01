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
https://api.example.com
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

---

## HTTP Status Codes

| Status | Meaning                                  |
| ------ | ---------------------------------------- |
| 200    | Successful request                       |
| 201    | Resource created                         |
| 204    | Successful request without response body |
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

The server controls it automatically.

Rules:

* guest users can access only demo data;
* admin users can access real data;
* seed data is created with `isDemo: true`.

---

## Authentication

Authentication is planned for Version 2.

Until authentication is implemented, endpoints may be used without an access token.

After Version 2, protected requests must use:

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
      "value": 5.4,
      "note": "Before breakfast",
      "ignored": false,
      "reason": "",
      "isDemo": false
    }
  ]
}
```

---

## POST /glucose

Creates a glucose measurement.

---

### Request Body

```json
{
  "measuredAt": "2026-06-29T08:00:00.000Z",
  "value": 5.4,
  "note": "Before breakfast"
}
```

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

# Authentication API

Authentication is planned for Version 2.

---

## POST /auth/register

Registers a new user.

---

## POST /auth/login

Authenticates a user and returns an access token.

---

## GET /auth/me

Returns the current authenticated user.

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

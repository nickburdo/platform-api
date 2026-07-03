import './extend-zod';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { USER_ROLES } from '../db/auth/schema';
import { JOB_APPLICATION_STATUSES, REMOTE_TYPES } from '../db/job-tracker/schema';
import { googleCallbackQuerySchema, loginSchema } from '../schemas/auth.schema';
import { createBloodPressureSchema, updateBloodPressureSchema } from '../schemas/blood-pressure.schema';
import { dateRangeQuerySchema, idParamSchema } from '../schemas/common.schema';
import { createGlucoseSchema, updateGlucoseSchema } from '../schemas/glucose.schema';
import {
  createJobApplicationSchema,
  listJobApplicationsQuerySchema,
  updateJobApplicationSchema,
} from '../schemas/job-applications.schema';
import { createSymptomSchema, updateSymptomSchema } from '../schemas/symptom.schema';
import { createWeightSchema, updateWeightSchema } from '../schemas/weight.schema';

// Decision #14: `extendZodWithOpenApi` (called in ./extend-zod, imported
// above) mutates Zod's global prototype, but this module is only ever
// imported by scripts/generate-openapi.ts (a standalone build script) —
// never by the running Worker — so the mutation has no effect on the
// deployed app, existing routes, or existing tests.

export const registry = new OpenAPIRegistry();

const bearerAuth = registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description:
    "Optional on most endpoints: absent -> guest, scoped to demo data; present and valid -> admin, scoped to real data. A present-but-invalid token always 401s (never silently downgraded to guest). Required in practice for GET /auth/me.",
});

// Decision #10: every schema below is either the project's existing
// src/schemas/*.ts export (wrapped here with .openapi() metadata, not
// mutated in place) or, where no request schema exists (response shapes,
// the not-yet-implemented Google callback query), a schema authored here.
// Route files under src/routes/*.ts are never touched.

const OPTIONAL_AUTH = [{}, { [bearerAuth.name]: [] }];
const REQUIRED_AUTH = [{ [bearerAuth.name]: [] }];

// ---------------------------------------------------------------------------
// Shared error envelope (api.md: { error: { message, details? } })
// ---------------------------------------------------------------------------

const errorEnvelopeSchema = registry.register(
  'ErrorEnvelope',
  z.object({
    error: z.object({
      message: z.string().openapi({ example: 'Validation error' }),
      details: z
        .record(z.string(), z.array(z.string()))
        .optional()
        .openapi({
          description:
            "Present for 400s: Zod's flattened field-error map (object-wide issues under `_errors`). Omitted for 401/404/500.",
        }),
    }),
  }),
);

function errorResponse(description: string) {
  return {
    description,
    content: { 'application/json': { schema: errorEnvelopeSchema } },
  };
}

const VALIDATION_ERROR = errorResponse(
  'Validation error — malformed body, unknown key, or empty PATCH body',
);
const UNAUTHORIZED = errorResponse('Missing, invalid, or expired token');
const NOT_FOUND = errorResponse("Resource not found, or outside the caller's isDemo scope");
const INTERNAL_ERROR = errorResponse('Internal server error');

function okResponse(schema: z.ZodTypeAny, description: string) {
  return {
    description,
    content: { 'application/json': { schema: z.object({ data: schema }) } },
  };
}

// ---------------------------------------------------------------------------
// Reusable component schemas
// ---------------------------------------------------------------------------

const paginationMetaSchema = registry.register(
  'PaginationMeta',
  z.object({
    page: z.number().int().openapi({ example: 1 }),
    limit: z.number().int().openapi({ example: 20 }),
    total: z.number().int().openapi({ example: 73 }),
    totalPages: z.number().int().openapi({ example: 4 }),
  }),
);

const deleteResultSchema = registry.register('DeleteResult', z.object({ success: z.literal(true) }));

const healthStatusSchema = registry.register('HealthStatus', z.object({ status: z.literal('ok') }));

// --- Job Tracker ---

const jobApplicationSchema = registry.register(
  'JobApplication',
  z.object({
    id: z.string().openapi({ example: 'job_1' }),
    company: z.string(),
    position: z.string(),
    vacancyUrl: z.string().url().nullable(),
    status: z.enum(JOB_APPLICATION_STATUSES),
    source: z.string().nullable(),
    salaryMin: z.number().int().nullable(),
    salaryMax: z.number().int().nullable(),
    currency: z.string(),
    location: z.string().nullable(),
    remoteType: z.enum(REMOTE_TYPES).nullable(),
    notes: z.string().nullable(),
    appliedAt: z.string().datetime().nullable(),
    nextFollowUpAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    isDemo: z.boolean(),
  }),
);

const jobsStatsSchema = registry.register(
  'JobsStats',
  z.object({
    total: z.number().int(),
    interviews: z.number().int(),
    interviewRate: z.number(),
    offers: z.number().int(),
    offerRate: z.number(),
    rejections: z.number().int(),
    rejectionRate: z.number(),
  }),
);

const jobApplicationsMetaSchema = registry.register(
  'JobApplicationsMeta',
  z.object({
    companies: z.array(z.string()),
    statuses: z.array(z.enum(JOB_APPLICATION_STATUSES)),
    stats: jobsStatsSchema,
  }),
);

// --- Health Monitor ---

// Shared by all four Health Monitor resources (glucose, blood pressure,
// weight, symptoms) — only the timestamp field name (measuredAt/happenedAt)
// and the measurement-specific fields differ per resource.
const measurementBaseFields = {
  id: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  note: z.string().nullable(),
  ignored: z.boolean(),
  reason: z.string().nullable(),
  isDemo: z.boolean(),
};

const glucoseMeasurementSchema = registry.register(
  'GlucoseMeasurement',
  z.object({
    ...measurementBaseFields,
    id: z.string().openapi({ example: 'glucose_1' }),
    measuredAt: z.string().datetime(),
    fastingValue: z.number().nullable(),
    afterMealValue: z.number().nullable(),
  }),
);

const bloodPressureMeasurementSchema = registry.register(
  'BloodPressureMeasurement',
  z.object({
    ...measurementBaseFields,
    id: z.string().openapi({ example: 'bp_1' }),
    measuredAt: z.string().datetime(),
    systolic: z.number().int(),
    diastolic: z.number().int(),
    pulse: z.number().int(),
  }),
);

const weightMeasurementSchema = registry.register(
  'WeightMeasurement',
  z.object({
    ...measurementBaseFields,
    id: z.string().openapi({ example: 'weight_1' }),
    measuredAt: z.string().datetime(),
    value: z.number(),
  }),
);

const symptomEntrySchema = registry.register(
  'SymptomEntry',
  z.object({
    ...measurementBaseFields,
    id: z.string().openapi({ example: 'symptom_1' }),
    happenedAt: z.string().datetime(),
    type: z.string(),
    intensity: z.number().int().min(1).max(10),
  }),
);

const dashboardDataSchema = registry.register(
  'DashboardData',
  z.object({
    glucoseMeasurements: z.array(glucoseMeasurementSchema),
    bloodPressureMeasurements: z.array(bloodPressureMeasurementSchema),
    weightMeasurements: z.array(weightMeasurementSchema),
    symptomEntries: z.array(symptomEntrySchema),
  }),
);

// --- Auth ---

const publicUserSchema = registry.register(
  'PublicUser',
  z.object({
    id: z.string().openapi({ example: 'user_1' }),
    email: z.string().email(),
    role: z.enum(USER_ROLES),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  }),
);

const loginResultSchema = registry.register(
  'LoginResult',
  z.object({
    token: z.string().openapi({ description: 'JWT (HS256), valid 30 days' }),
    user: publicUserSchema,
  }),
);

// ---------------------------------------------------------------------------
// Request component schemas — wraps each existing src/schemas/*.ts export
// with .openapi() metadata and registers it (Section 2 checklist / Decision
// #10), so request bodies/params/query render as named, documented
// components instead of anonymous inline shapes. The source schemas
// themselves are never mutated — .openapi() returns a new instance.
// ---------------------------------------------------------------------------

// Not wrapped via registry.register() (no name) — request.params/request.query
// schemas are always flattened into individual OpenAPI "parameter" entries by
// the generator, never emitted as a $ref, so a named component here would
// just show up as an "unused component" in spec-lint. Metadata-only .openapi()
// still satisfies the checklist's "wrap with .openapi()" requirement.
const idParamRequestSchema = idParamSchema.openapi({
  description: 'Path parameter identifying a resource by id',
});

const dateRangeQueryRequestSchema = dateRangeQuerySchema.openapi({
  description: 'Optional inclusive date range filter shared by all Health Monitor list endpoints',
});

const listJobApplicationsQueryRequestSchema = listJobApplicationsQuerySchema.openapi({
  description: 'Pagination and filter parameters for GET /jobs',
});

const googleCallbackQueryRequestSchema = googleCallbackQuerySchema.openapi({
  description: 'Forwarded by Google after the user consents',
});

const loginRequestSchema = registry.register(
  'LoginRequest',
  loginSchema.openapi({
    description: 'Admin login credentials',
    example: { email: 'admin@example.com', password: 'correct horse battery staple' },
  }),
);

const createJobApplicationRequestSchema = registry.register(
  'CreateJobApplicationRequest',
  createJobApplicationSchema.openapi({
    description: 'status defaults to SAVED, currency defaults to USD when omitted.',
    example: {
      company: 'Google',
      position: 'Frontend Developer',
      vacancyUrl: 'https://example.com/jobs/1',
      status: 'APPLIED',
      source: 'LinkedIn',
      salaryMin: 3000,
      salaryMax: 5000,
      currency: 'USD',
      location: 'Remote',
      remoteType: 'REMOTE',
      notes: 'Interesting position',
      appliedAt: '2026-06-29T10:00:00.000Z',
      nextFollowUpAt: '2026-07-06T10:00:00.000Z',
    },
  }),
);

const updateJobApplicationRequestSchema = registry.register(
  'UpdateJobApplicationRequest',
  updateJobApplicationSchema.openapi({
    description: 'Partial update — all fields optional, but at least one is required.',
    example: {
      status: 'SCREENING',
      notes: 'Recruiter contacted me',
      nextFollowUpAt: '2026-07-10T10:00:00.000Z',
    },
  }),
);

const createGlucoseRequestSchema = registry.register(
  'CreateGlucoseRequest',
  createGlucoseSchema.openapi({
    description: 'Exactly one of fastingValue/afterMealValue must be provided.',
    example: { measuredAt: '2026-06-29T08:00:00.000Z', fastingValue: 5.4, note: 'Before breakfast' },
  }),
);

const updateGlucoseRequestSchema = registry.register(
  'UpdateGlucoseRequest',
  updateGlucoseSchema.openapi({
    description: 'Partial update, or ignore/restore a record via `ignored`+`reason`.',
    example: { ignored: true, reason: 'Incorrect measurement' },
  }),
);

const createBloodPressureRequestSchema = registry.register(
  'CreateBloodPressureRequest',
  createBloodPressureSchema.openapi({
    description: 'systolic must be greater than diastolic.',
    example: {
      measuredAt: '2026-06-29T08:00:00.000Z',
      systolic: 120,
      diastolic: 80,
      pulse: 72,
      note: 'Morning measurement',
    },
  }),
);

const updateBloodPressureRequestSchema = registry.register(
  'UpdateBloodPressureRequest',
  updateBloodPressureSchema.openapi({
    description: 'Partial update, or ignore/restore a record via `ignored`+`reason`.',
    example: { ignored: true, reason: 'Wrong cuff position' },
  }),
);

const createWeightRequestSchema = registry.register(
  'CreateWeightRequest',
  createWeightSchema.openapi({
    description: 'Create a weight measurement.',
    example: { measuredAt: '2026-06-29T08:00:00.000Z', value: 82.5, note: 'Morning' },
  }),
);

const updateWeightRequestSchema = registry.register(
  'UpdateWeightRequest',
  updateWeightSchema.openapi({
    description: 'Partial update, or ignore/restore a record via `ignored`+`reason`.',
    example: { ignored: true, reason: 'Measurement duplicated' },
  }),
);

const createSymptomRequestSchema = registry.register(
  'CreateSymptomRequest',
  createSymptomSchema.openapi({
    description: 'Create a symptom entry. intensity is 1-10.',
    example: {
      happenedAt: '2026-06-29T08:00:00.000Z',
      type: 'HEADACHE',
      intensity: 3,
      note: 'Mild headache',
    },
  }),
);

const updateSymptomRequestSchema = registry.register(
  'UpdateSymptomRequest',
  updateSymptomSchema.openapi({
    description: 'Partial update, or ignore/restore a record via `ignored`+`reason`.',
    example: { ignored: true, reason: 'Created by mistake' },
  }),
);

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/health',
  tags: ['Health'],
  summary: 'Liveness probe',
  description: 'No auth, no DB access, constant response.',
  security: [],
  responses: {
    200: okResponse(healthStatusSchema, 'Service is up'),
  },
});

// --- Job Tracker ---

registry.registerPath({
  method: 'get',
  path: '/jobs',
  tags: ['Job Tracker'],
  summary: 'List job applications',
  security: OPTIONAL_AUTH,
  request: { query: listJobApplicationsQueryRequestSchema },
  responses: {
    200: {
      description: 'Paginated list of job applications',
      content: {
        'application/json': {
          schema: z.object({ data: z.array(jobApplicationSchema), meta: paginationMetaSchema }),
        },
      },
    },
    400: VALIDATION_ERROR,
    401: UNAUTHORIZED,
    500: INTERNAL_ERROR,
  },
});

registry.registerPath({
  method: 'get',
  path: '/jobs/meta',
  tags: ['Job Tracker'],
  summary: 'Job Tracker filter/statistics metadata',
  security: OPTIONAL_AUTH,
  responses: {
    200: okResponse(jobApplicationsMetaSchema, 'Metadata used by Job Tracker filters and stats widgets'),
    401: UNAUTHORIZED,
    500: INTERNAL_ERROR,
  },
});

registry.registerPath({
  method: 'get',
  path: '/jobs/{id}',
  tags: ['Job Tracker'],
  summary: 'Get a single job application',
  security: OPTIONAL_AUTH,
  request: { params: idParamRequestSchema },
  responses: {
    200: okResponse(jobApplicationSchema, 'The job application'),
    401: UNAUTHORIZED,
    404: NOT_FOUND,
    500: INTERNAL_ERROR,
  },
});

registry.registerPath({
  method: 'post',
  path: '/jobs',
  tags: ['Job Tracker'],
  summary: 'Create a job application',
  security: OPTIONAL_AUTH,
  request: {
    body: { required: true, content: { 'application/json': { schema: createJobApplicationRequestSchema } } },
  },
  responses: {
    201: okResponse(jobApplicationSchema, 'Job application created'),
    400: VALIDATION_ERROR,
    401: UNAUTHORIZED,
    500: INTERNAL_ERROR,
  },
});

registry.registerPath({
  method: 'patch',
  path: '/jobs/{id}',
  tags: ['Job Tracker'],
  summary: 'Update a job application',
  security: OPTIONAL_AUTH,
  request: {
    params: idParamRequestSchema,
    body: { required: true, content: { 'application/json': { schema: updateJobApplicationRequestSchema } } },
  },
  responses: {
    200: okResponse(jobApplicationSchema, 'Job application updated'),
    400: VALIDATION_ERROR,
    401: UNAUTHORIZED,
    404: NOT_FOUND,
    500: INTERNAL_ERROR,
  },
});

registry.registerPath({
  method: 'delete',
  path: '/jobs/{id}',
  tags: ['Job Tracker'],
  summary: 'Delete a job application',
  description: 'Physically deletes the row — the only Job Tracker/Health Monitor resource that does.',
  security: OPTIONAL_AUTH,
  request: { params: idParamRequestSchema },
  responses: {
    200: okResponse(deleteResultSchema, 'Job application deleted'),
    401: UNAUTHORIZED,
    404: NOT_FOUND,
    500: INTERNAL_ERROR,
  },
});

// --- Health Monitor: Glucose / Blood Pressure / Weight / Symptoms ---
//
// The four resources share an identical GET-list/POST-create/PATCH-update
// shape (same security, same response-code set, same description pattern) —
// only the path, entity/create/update schemas, and singular/plural labels
// differ, so they're driven from one table instead of 12 near-identical
// registerPath() calls.

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

interface HealthMonitorResource {
  path: string;
  singular: string;
  plural: string;
  entitySchema: z.ZodTypeAny;
  createSchema: z.ZodTypeAny;
  updateSchema: z.ZodTypeAny;
}

function registerHealthMonitorResource(resource: HealthMonitorResource): void {
  const { path, singular, plural, entitySchema, createSchema, updateSchema } = resource;

  registry.registerPath({
    method: 'get',
    path,
    tags: ['Health Monitor'],
    summary: `List ${plural}`,
    security: OPTIONAL_AUTH,
    request: { query: dateRangeQueryRequestSchema },
    responses: {
      200: okResponse(z.array(entitySchema), `${capitalize(plural)} (not paginated)`),
      400: VALIDATION_ERROR,
      401: UNAUTHORIZED,
      500: INTERNAL_ERROR,
    },
  });

  registry.registerPath({
    method: 'post',
    path,
    tags: ['Health Monitor'],
    summary: `Create a ${singular}`,
    security: OPTIONAL_AUTH,
    request: {
      body: { required: true, content: { 'application/json': { schema: createSchema } } },
    },
    responses: {
      201: okResponse(entitySchema, `${capitalize(singular)} created`),
      400: VALIDATION_ERROR,
      401: UNAUTHORIZED,
      500: INTERNAL_ERROR,
    },
  });

  registry.registerPath({
    method: 'patch',
    path: `${path}/{id}`,
    tags: ['Health Monitor'],
    summary: `Update, ignore, or restore a ${singular}`,
    security: OPTIONAL_AUTH,
    request: {
      params: idParamRequestSchema,
      body: { required: true, content: { 'application/json': { schema: updateSchema } } },
    },
    responses: {
      200: okResponse(entitySchema, `${capitalize(singular)} updated`),
      400: VALIDATION_ERROR,
      401: UNAUTHORIZED,
      404: NOT_FOUND,
      500: INTERNAL_ERROR,
    },
  });
}

const HEALTH_MONITOR_RESOURCES: HealthMonitorResource[] = [
  {
    path: '/glucose',
    singular: 'glucose measurement',
    plural: 'glucose measurements',
    entitySchema: glucoseMeasurementSchema,
    createSchema: createGlucoseRequestSchema,
    updateSchema: updateGlucoseRequestSchema,
  },
  {
    path: '/blood-pressure',
    singular: 'blood pressure measurement',
    plural: 'blood pressure measurements',
    entitySchema: bloodPressureMeasurementSchema,
    createSchema: createBloodPressureRequestSchema,
    updateSchema: updateBloodPressureRequestSchema,
  },
  {
    path: '/weight',
    singular: 'weight measurement',
    plural: 'weight measurements',
    entitySchema: weightMeasurementSchema,
    createSchema: createWeightRequestSchema,
    updateSchema: updateWeightRequestSchema,
  },
  {
    path: '/symptoms',
    singular: 'symptom entry',
    plural: 'symptom entries',
    entitySchema: symptomEntrySchema,
    createSchema: createSymptomRequestSchema,
    updateSchema: updateSymptomRequestSchema,
  },
];

for (const resource of HEALTH_MONITOR_RESOURCES) {
  registerHealthMonitorResource(resource);
}

// --- Health Monitor: Dashboard ---

registry.registerPath({
  method: 'get',
  path: '/dashboard',
  tags: ['Health Monitor'],
  summary: 'Aggregated Health Monitor data',
  security: OPTIONAL_AUTH,
  request: { query: dateRangeQueryRequestSchema },
  responses: {
    200: okResponse(dashboardDataSchema, 'All four Health Monitor resources over the given date range'),
    400: VALIDATION_ERROR,
    401: UNAUTHORIZED,
    500: INTERNAL_ERROR,
  },
});

// --- Auth ---

registry.registerPath({
  method: 'post',
  path: '/auth/login',
  tags: ['Auth'],
  summary: 'Authenticate the admin and issue an access token',
  security: [],
  request: {
    body: { required: true, content: { 'application/json': { schema: loginRequestSchema } } },
  },
  responses: {
    200: okResponse(loginResultSchema, 'Login succeeded'),
    400: VALIDATION_ERROR,
    401: errorResponse('Invalid credentials (wrong email and wrong password are indistinguishable)'),
    500: INTERNAL_ERROR,
  },
});

registry.registerPath({
  method: 'get',
  path: '/auth/me',
  tags: ['Auth'],
  summary: 'Get the current authenticated user',
  security: REQUIRED_AUTH,
  responses: {
    200: okResponse(publicUserSchema, 'The authenticated admin user'),
    401: UNAUTHORIZED,
    500: INTERNAL_ERROR,
  },
});

registry.registerPath({
  method: 'get',
  path: '/auth/google',
  tags: ['Auth'],
  summary: 'Begin Google Sign-In',
  security: [],
  responses: {
    302: {
      description:
        "Redirects to Google's consent screen (scope openid email) with a signed, short-lived state param (Decision #8)",
    },
    500: INTERNAL_ERROR,
  },
});

registry.registerPath({
  method: 'get',
  path: '/auth/google/callback',
  tags: ['Auth'],
  summary: 'Complete Google Sign-In',
  security: [],
  request: { query: googleCallbackQueryRequestSchema },
  responses: {
    200: okResponse(loginResultSchema, "Email matched the existing admin — behaves like POST /auth/login"),
    400: VALIDATION_ERROR,
    401: errorResponse(
      "state missing/invalid/expired/not issued by this server, the Google account's email does not match the existing admin, or Google reports the email as unverified (no account is ever created in any case)",
    ),
    500: INTERNAL_ERROR,
  },
});

import type { z } from 'zod';
import type { JobTrackerDb } from '../db/job-tracker/client';
import {
  createJobApplication as createJobApplicationRow,
  deleteJobApplication as deleteJobApplicationRow,
  findJobApplicationById as findJobApplicationByIdRow,
  getJobApplicationsMeta as getJobApplicationsMetaRow,
  listJobApplications as listJobApplicationsRows,
  updateJobApplication as updateJobApplicationRow,
} from '../db/job-tracker/job-applications.repository';
import type { JOB_APPLICATION_STATUSES, JobApplication } from '../db/job-tracker/schema';
import type {
  createJobApplicationSchema,
  listJobApplicationsQuerySchema,
  updateJobApplicationSchema,
} from '../schemas/job-applications.schema';

type JobApplicationStatus = (typeof JOB_APPLICATION_STATUSES)[number];

const INTERVIEW_STATUSES: JobApplicationStatus[] = [
  'SCREENING',
  'TECHNICAL_INTERVIEW',
  'FINAL_INTERVIEW',
];

export async function createJobApplication(
  db: JobTrackerDb,
  id: string,
  input: z.infer<typeof createJobApplicationSchema>,
): Promise<JobApplication> {
  const now = new Date().toISOString();
  // Every V1 record is demo data — there's no auth yet to distinguish real
  // users from guests (Decision #10).
  return createJobApplicationRow(db, {
    id,
    ...input,
    isDemo: true,
    createdAt: now,
    updatedAt: now,
  });
}

export async function updateJobApplication(
  db: JobTrackerDb,
  id: string,
  input: z.infer<typeof updateJobApplicationSchema>,
): Promise<JobApplication | undefined> {
  return updateJobApplicationRow(db, id, {
    ...input,
    updatedAt: new Date().toISOString(),
  });
}

export async function findJobApplicationById(
  db: JobTrackerDb,
  id: string,
): Promise<JobApplication | undefined> {
  return findJobApplicationByIdRow(db, id);
}

export async function deleteJobApplication(db: JobTrackerDb, id: string): Promise<boolean> {
  return deleteJobApplicationRow(db, id);
}

export interface ListJobApplicationsResult {
  rows: JobApplication[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export async function listJobApplications(
  db: JobTrackerDb,
  query: z.infer<typeof listJobApplicationsQuerySchema>,
): Promise<ListJobApplicationsResult> {
  const { rows, total } = await listJobApplicationsRows(db, query);
  return {
    rows,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export interface JobsStats {
  total: number;
  interviews: number;
  interviewRate: number;
  offers: number;
  offerRate: number;
  rejections: number;
  rejectionRate: number;
}

export interface JobApplicationsMeta {
  companies: string[];
  statuses: JobApplicationStatus[];
  stats: JobsStats;
}

export interface GetJobApplicationsMetaParams {
  isDemo?: boolean;
}

export async function getJobApplicationsMeta(
  db: JobTrackerDb,
  params: GetJobApplicationsMetaParams = {},
): Promise<JobApplicationsMeta> {
  const raw = await getJobApplicationsMetaRow(db, params);

  const interviews = INTERVIEW_STATUSES.reduce(
    (sum, status) => sum + (raw.statusCounts[status] ?? 0),
    0,
  );
  const offers = raw.statusCounts.OFFER ?? 0;
  const rejections = raw.statusCounts.REJECTED ?? 0;
  const rate = (count: number) => (raw.total > 0 ? count / raw.total : 0);

  return {
    companies: raw.companies,
    statuses: Object.keys(raw.statusCounts) as JobApplicationStatus[],
    stats: {
      total: raw.total,
      interviews,
      interviewRate: rate(interviews),
      offers,
      offerRate: rate(offers),
      rejections,
      rejectionRate: rate(rejections),
    },
  };
}

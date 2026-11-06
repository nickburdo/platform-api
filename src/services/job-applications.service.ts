import type { z } from 'zod';
import { omitUserId, type OwnerId } from '../utils/owner';
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

export type JobApplicationView = Omit<JobApplication, 'userId'>;
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
  ownerId: OwnerId,
): Promise<JobApplicationView> {
  const now = new Date().toISOString();
  // `userId` comes from the caller's identity, never from the client body.
  const row = await createJobApplicationRow(db, {
    id,
    ...input,
    userId: ownerId,
    createdAt: now,
    updatedAt: now,
  });
  return omitUserId(row);
}

export async function updateJobApplication(
  db: JobTrackerDb,
  id: string,
  input: z.infer<typeof updateJobApplicationSchema>,
  ownerId: OwnerId,
): Promise<JobApplicationView | undefined> {
  const row = await updateJobApplicationRow(
    db,
    id,
    {
      ...input,
      updatedAt: new Date().toISOString(),
    },
    ownerId,
  );
  return row && omitUserId(row);
}

export async function findJobApplicationById(
  db: JobTrackerDb,
  id: string,
  ownerId: OwnerId,
): Promise<JobApplicationView | undefined> {
  const row = await findJobApplicationByIdRow(db, id, ownerId);
  return row && omitUserId(row);
}

export async function deleteJobApplication(
  db: JobTrackerDb,
  id: string,
  ownerId: OwnerId,
): Promise<boolean> {
  return deleteJobApplicationRow(db, id, ownerId);
}

export interface ListJobApplicationsResult {
  rows: JobApplicationView[];
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
  ownerId: OwnerId,
): Promise<ListJobApplicationsResult> {
  const { rows, total } = await listJobApplicationsRows(db, { ...query, ownerId });
  return {
    rows: rows.map(omitUserId),
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

export async function getJobApplicationsMeta(
  db: JobTrackerDb,
  ownerId: OwnerId,
): Promise<JobApplicationsMeta> {
  const raw = await getJobApplicationsMetaRow(db, { ownerId });

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

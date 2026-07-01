import { and, Column, count, eq, or, sql } from 'drizzle-orm';
import type { JobTrackerDb } from './client';
import {
  jobApplications,
  type JobApplication,
  type NewJobApplication,
  type JOB_APPLICATION_STATUSES,
} from './schema';

type JobApplicationStatus = (typeof JOB_APPLICATION_STATUSES)[number];

export interface ListJobApplicationsParams {
  page: number;
  limit: number;
  status?: JobApplicationStatus;
  company?: string;
  search?: string;
  isDemo?: boolean;
}

export interface ListJobApplicationsResult {
  rows: JobApplication[];
  total: number;
}

// Escapes SQLite LIKE wildcard metacharacters (`%`, `_`) and the escape
// character itself, so a literal `_`/`%` in a user's search term is matched
// literally instead of acting as a wildcard (e.g. searching "co_op" would
// otherwise also match "coXop").
function escapeLikeTerm(term: string): string {
  return term.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function likeEscaped(column: Column, term: string) {
  return sql`${column} LIKE ${term} ESCAPE '\\'`;
}

function buildFilters(params: {
  status?: JobApplicationStatus;
  company?: string;
  search?: string;
  isDemo?: boolean;
}) {
  const conditions = [];
  if (params.status) conditions.push(eq(jobApplications.status, params.status));
  if (params.company) conditions.push(eq(jobApplications.company, params.company));
  if (params.isDemo !== undefined) conditions.push(eq(jobApplications.isDemo, params.isDemo));
  if (params.search) {
    const term = `%${escapeLikeTerm(params.search)}%`;
    conditions.push(
      or(
        likeEscaped(jobApplications.company, term),
        likeEscaped(jobApplications.position, term),
        likeEscaped(jobApplications.source, term),
        likeEscaped(jobApplications.notes, term),
      ),
    );
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

export async function listJobApplications(
  db: JobTrackerDb,
  params: ListJobApplicationsParams,
): Promise<ListJobApplicationsResult> {
  const where = buildFilters(params);
  const offset = (params.page - 1) * params.limit;

  const [rows, totalRows] = await Promise.all([
    db.select().from(jobApplications).where(where).limit(params.limit).offset(offset),
    db.select({ value: count() }).from(jobApplications).where(where),
  ]);

  return { rows, total: totalRows[0]?.value ?? 0 };
}

export async function findJobApplicationById(
  db: JobTrackerDb,
  id: string,
): Promise<JobApplication | undefined> {
  const [row] = await db.select().from(jobApplications).where(eq(jobApplications.id, id));
  return row;
}

export async function createJobApplication(
  db: JobTrackerDb,
  data: NewJobApplication,
): Promise<JobApplication> {
  const [row] = await db.insert(jobApplications).values(data).returning();
  if (!row) throw new Error('Insert did not return a row');
  return row;
}

export async function updateJobApplication(
  db: JobTrackerDb,
  id: string,
  data: Partial<NewJobApplication>,
): Promise<JobApplication | undefined> {
  const [row] = await db
    .update(jobApplications)
    .set(data)
    .where(eq(jobApplications.id, id))
    .returning();
  return row;
}

export async function deleteJobApplication(db: JobTrackerDb, id: string): Promise<boolean> {
  const result = await db
    .delete(jobApplications)
    .where(eq(jobApplications.id, id))
    .returning({ id: jobApplications.id });
  return result.length > 0;
}

export interface JobApplicationsMetaRaw {
  companies: string[];
  statusCounts: Partial<Record<JobApplicationStatus, number>>;
  total: number;
}

export interface GetJobApplicationsMetaParams {
  isDemo?: boolean;
}

export async function getJobApplicationsMeta(
  db: JobTrackerDb,
  params: GetJobApplicationsMetaParams = {},
): Promise<JobApplicationsMetaRaw> {
  const isDemoFilter =
    params.isDemo !== undefined ? eq(jobApplications.isDemo, params.isDemo) : undefined;

  const [companyRows, statusRows, totalRows] = await Promise.all([
    db
      .selectDistinct({ company: jobApplications.company })
      .from(jobApplications)
      .where(isDemoFilter),
    db
      .select({ status: jobApplications.status, value: count() })
      .from(jobApplications)
      .where(isDemoFilter)
      .groupBy(jobApplications.status),
    db.select({ value: count() }).from(jobApplications).where(isDemoFilter),
  ]);

  const statusCounts: Partial<Record<JobApplicationStatus, number>> = {};
  for (const row of statusRows) {
    statusCounts[row.status] = row.value;
  }

  return {
    companies: companyRows.map((row) => row.company),
    statusCounts,
    total: totalRows[0]?.value ?? 0,
  };
}

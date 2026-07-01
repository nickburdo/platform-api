import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const jobApplications = sqliteTable(
  'job_applications',
  {
    id: text('id').primaryKey(),
    company: text('company').notNull(),
    position: text('position').notNull(),
    vacancyUrl: text('vacancy_url'),
    status: text('status', {
      enum: [
        'SAVED',
        'APPLIED',
        'SCREENING',
        'TECHNICAL_INTERVIEW',
        'FINAL_INTERVIEW',
        'OFFER',
        'REJECTED',
        'WITHDRAWN',
        'ARCHIVED',
      ],
    })
      .notNull()
      .default('SAVED'),
    source: text('source'),
    salaryMin: integer('salary_min'),
    salaryMax: integer('salary_max'),
    currency: text('currency').notNull().default('USD'),
    location: text('location'),
    remoteType: text('remote_type', { enum: ['REMOTE', 'HYBRID', 'OFFICE'] }),
    notes: text('notes'),
    appliedAt: text('applied_at'),
    nextFollowUpAt: text('next_follow_up_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    isDemo: integer('is_demo', { mode: 'boolean' }).notNull().default(false),
  },
  (table) => [
    index('job_applications_status_idx').on(table.status),
    index('job_applications_company_idx').on(table.company),
    index('job_applications_is_demo_idx').on(table.isDemo),
  ],
);

export type JobApplication = typeof jobApplications.$inferSelect;
export type NewJobApplication = typeof jobApplications.$inferInsert;

-- Demo fixtures adapted from docs/seed/job-tracker/seed.ts (see docs/plans/v1-plan.md Decision #18).
-- Dates are relative to the seed run time (SQLite date functions), not fixed, so demo data
-- always looks current instead of aging into the past. Re-running this file is always safe:
-- it only ever touches rows where is_demo = 1.

DELETE FROM job_applications WHERE is_demo = 1;

INSERT INTO job_applications (
  id, company, position, vacancy_url, status, source,
  salary_min, salary_max, currency, location, remote_type, notes,
  applied_at, next_follow_up_at, created_at, updated_at, is_demo
) VALUES
  ('f380597d-c0d4-4051-9fa6-0a8b5f5383dd', 'Northstar Labs', 'Frontend Engineer', 'https://example.com/jobs/northstar-frontend-engineer', 'APPLIED', 'LinkedIn',
   85000, 105000, 'USD', 'Remote, US', 'REMOTE', 'Applied with portfolio link and Nuxt project highlights.',
   strftime('%Y-%m-%dT%H:%M:%f', 'now', '-4 days') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+3 days') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1),

  ('f6abb765-b1bf-4a10-9b53-2abec770ffa7', 'Atlas CRM', 'Full Stack Developer', 'https://example.com/jobs/atlas-full-stack-developer', 'SCREENING', 'Company careers page',
   90000, 120000, 'USD', 'Austin, TX', 'HYBRID', 'Recruiter screen scheduled. Ask about product team ownership.',
   strftime('%Y-%m-%dT%H:%M:%f', 'now', '-9 days') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+1 days') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1),

  ('7c89ded1-ada9-49f9-86d2-c28bc5dd8469', 'Beacon Health', 'Vue Engineer', 'https://example.com/jobs/beacon-vue-engineer', 'TECHNICAL_INTERVIEW', 'Referral',
   95000, 125000, 'USD', 'Remote, EU/US overlap', 'REMOTE', 'Technical interview focuses on Vue composables and API design.',
   strftime('%Y-%m-%dT%H:%M:%f', 'now', '-14 days') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+2 days') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1),

  ('f5a74d3a-946f-4967-886e-4f630ac0a988', 'Ledgerly', 'Product Engineer', 'https://example.com/jobs/ledgerly-product-engineer', 'FINAL_INTERVIEW', 'Wellfound',
   110000, 140000, 'USD', 'New York, NY', 'HYBRID', 'Final round with CTO. Prepare examples about tradeoffs.',
   strftime('%Y-%m-%dT%H:%M:%f', 'now', '-21 days') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+4 days') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1),

  ('dd2d7bc8-44b5-4c75-8165-15838f8f2bb3', 'SignalForge', 'Nuxt Developer', 'https://example.com/jobs/signalforge-nuxt-developer', 'SAVED', 'Hacker News',
   80000, 100000, 'USD', 'Remote', 'REMOTE', 'Strong fit. Need tailor resume before applying.',
   NULL, strftime('%Y-%m-%dT%H:%M:%f', 'now', '+5 days') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1),

  ('8d56e7d3-a88a-47c3-95f5-037e02886d67', 'Riverbank AI', 'Frontend Platform Engineer', 'https://example.com/jobs/riverbank-frontend-platform', 'REJECTED', 'LinkedIn',
   120000, 155000, 'USD', 'San Francisco, CA', 'OFFICE', 'Rejected after screening. Needed more design system experience.',
   strftime('%Y-%m-%dT%H:%M:%f', 'now', '-28 days') || 'Z', NULL, strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1),

  ('a8d092a0-fab1-4526-9302-59c1f6e06eb6', 'CraftDesk', 'Senior UI Engineer', 'https://example.com/jobs/craftdesk-senior-ui-engineer', 'OFFER', 'Recruiter',
   115000, 135000, 'USD', 'Remote, US', 'REMOTE', 'Offer received. Compare benefits and equity terms.',
   strftime('%Y-%m-%dT%H:%M:%f', 'now', '-35 days') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+1 days') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1),

  ('30ee14d0-021b-4b2c-be04-dd6e8f57091c', 'OrbitOps', 'Dashboard Engineer', 'https://example.com/jobs/orbitops-dashboard-engineer', 'APPLIED', 'Indeed',
   78000, 98000, 'USD', 'Chicago, IL', 'HYBRID', 'Role is dashboard-heavy. Good portfolio angle.',
   strftime('%Y-%m-%dT%H:%M:%f', 'now', '-2 days') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+6 days') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1),

  ('c7541518-f876-41c4-86fe-3c871f70e6bd', 'BluePeak Systems', 'Software Engineer II', 'https://example.com/jobs/bluepeak-software-engineer-ii', 'ARCHIVED', 'Company careers page',
   70000, 90000, 'USD', 'Denver, CO', 'OFFICE', 'Archived because relocation requirement is too strict.',
   strftime('%Y-%m-%dT%H:%M:%f', 'now', '-40 days') || 'Z', NULL, strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1),

  ('6f1ebd2e-7bc0-4ecd-98a0-82c9b410cccd', 'HirePilot', 'Full Stack TypeScript Engineer', 'https://example.com/jobs/hirepilot-typescript-engineer', 'SCREENING', 'Twitter',
   100000, 130000, 'USD', 'Remote', 'REMOTE', 'Screening call complete. Waiting for take-home assignment.',
   strftime('%Y-%m-%dT%H:%M:%f', 'now', '-11 days') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now', '-1 days') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1),

  ('0c28b655-be89-47ed-b7e4-78f09d245316', 'MetricHouse', 'Analytics UI Developer', 'https://example.com/jobs/metrichouse-analytics-ui', 'TECHNICAL_INTERVIEW', 'LinkedIn',
   88000, 115000, 'USD', 'Boston, MA', 'HYBRID', 'Prepare chart accessibility and table performance examples.',
   strftime('%Y-%m-%dT%H:%M:%f', 'now', '-17 days') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+7 days') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1),

  ('eb805acc-a13e-450d-8c3b-c3ac512c0395', 'GreenGrid', 'Climate Tech Frontend Engineer', 'https://example.com/jobs/greengrid-frontend', 'APPLIED', 'Otta',
   82000, 108000, 'USD', 'Remote, Europe', 'REMOTE', 'Mission-aligned role. Mention data visualization work.',
   strftime('%Y-%m-%dT%H:%M:%f', 'now', '-6 days') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+2 days') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1),

  ('dea6717d-1673-406e-a068-2b2711bb84f4', 'StackFoundry', 'Application Developer', 'https://example.com/jobs/stackfoundry-app-developer', 'SAVED', 'Glassdoor',
   75000, 95000, 'USD', 'Remote', 'REMOTE', 'Review job description again before applying.',
   NULL, strftime('%Y-%m-%dT%H:%M:%f', 'now', '+8 days') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1),

  ('63ec397d-d026-4db3-bcce-569d400ad992', 'BrightCart', 'E-commerce Frontend Engineer', 'https://example.com/jobs/brightcart-frontend', 'REJECTED', 'Recruiter',
   90000, 115000, 'USD', 'Seattle, WA', 'HYBRID', 'Rejected after technical interview. Improve testing examples.',
   strftime('%Y-%m-%dT%H:%M:%f', 'now', '-31 days') || 'Z', NULL, strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1),

  ('a5026a76-6299-440c-9f06-c55a412aaa92', 'CoreBridge', 'Backend-leaning Full Stack Engineer', 'https://example.com/jobs/corebridge-full-stack', 'FINAL_INTERVIEW', 'Referral',
   105000, 145000, 'USD', 'Remote, US', 'REMOTE', 'Final conversation about backend depth and ownership.',
   strftime('%Y-%m-%dT%H:%M:%f', 'now', '-24 days') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+3 days') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1),

  ('2d8c489e-7e10-41e1-9c1e-4e86a8c2b8f7', 'PixelRail', 'Design Systems Engineer', 'https://example.com/jobs/pixelrail-design-systems', 'APPLIED', 'Company careers page',
   98000, 128000, 'USD', 'Portland, OR', 'HYBRID', 'Highlight component library and accessibility experience.',
   strftime('%Y-%m-%dT%H:%M:%f', 'now', '-1 days') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 days') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1),

  ('0730e1e2-f04c-45e8-9515-0e8d2b4f6b6d', 'Quartz Analytics', 'Data Visualization Engineer', 'https://example.com/jobs/quartz-data-viz', 'WITHDRAWN', 'LinkedIn',
   92000, 118000, 'USD', 'Remote, US', 'REMOTE', 'Withdrew after accepting that on-call rotation does not fit current schedule.',
   strftime('%Y-%m-%dT%H:%M:%f', 'now', '-19 days') || 'Z', NULL, strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1);

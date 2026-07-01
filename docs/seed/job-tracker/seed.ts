import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { JobApplicationStatus, PrismaClient } from '../generated/prisma/client';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(9, 0, 0, 0);
  return date;
};

const daysFromNow = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(10, 0, 0, 0);
  return date;
};

const applications = [
  {
    company: 'Northstar Labs',
    position: 'Frontend Engineer',
    vacancyUrl: 'https://example.com/jobs/northstar-frontend-engineer',
    status: JobApplicationStatus.APPLIED,
    source: 'LinkedIn',
    salaryMin: 85000,
    salaryMax: 105000,
    currency: 'USD',
    location: 'Remote, US',
    remoteType: 'Remote',
    notes: 'Applied with portfolio link and Nuxt project highlights.',
    appliedAt: daysAgo(4),
    nextFollowUpAt: daysFromNow(3),
  },
  {
    company: 'Atlas CRM',
    position: 'Full Stack Developer',
    vacancyUrl: 'https://example.com/jobs/atlas-full-stack-developer',
    status: JobApplicationStatus.SCREENING,
    source: 'Company careers page',
    salaryMin: 90000,
    salaryMax: 120000,
    currency: 'USD',
    location: 'Austin, TX',
    remoteType: 'Hybrid',
    notes: 'Recruiter screen scheduled. Ask about product team ownership.',
    appliedAt: daysAgo(9),
    nextFollowUpAt: daysFromNow(1),
  },
  {
    company: 'Beacon Health',
    position: 'Vue Engineer',
    vacancyUrl: 'https://example.com/jobs/beacon-vue-engineer',
    status: JobApplicationStatus.TECHNICAL_INTERVIEW,
    source: 'Referral',
    salaryMin: 95000,
    salaryMax: 125000,
    currency: 'USD',
    location: 'Remote, EU/US overlap',
    remoteType: 'Remote',
    notes: 'Technical interview focuses on Vue composables and API design.',
    appliedAt: daysAgo(14),
    nextFollowUpAt: daysFromNow(2),
  },
  {
    company: 'Ledgerly',
    position: 'Product Engineer',
    vacancyUrl: 'https://example.com/jobs/ledgerly-product-engineer',
    status: JobApplicationStatus.FINAL_INTERVIEW,
    source: 'Wellfound',
    salaryMin: 110000,
    salaryMax: 140000,
    currency: 'USD',
    location: 'New York, NY',
    remoteType: 'Hybrid',
    notes: 'Final round with CTO. Prepare examples about tradeoffs.',
    appliedAt: daysAgo(21),
    nextFollowUpAt: daysFromNow(4),
  },
  {
    company: 'SignalForge',
    position: 'Nuxt Developer',
    vacancyUrl: 'https://example.com/jobs/signalforge-nuxt-developer',
    status: JobApplicationStatus.SAVED,
    source: 'Hacker News',
    salaryMin: 80000,
    salaryMax: 100000,
    currency: 'USD',
    location: 'Remote',
    remoteType: 'Remote',
    notes: 'Strong fit. Need tailor resume before applying.',
    nextFollowUpAt: daysFromNow(5),
  },
  {
    company: 'Riverbank AI',
    position: 'Frontend Platform Engineer',
    vacancyUrl: 'https://example.com/jobs/riverbank-frontend-platform',
    status: JobApplicationStatus.REJECTED,
    source: 'LinkedIn',
    salaryMin: 120000,
    salaryMax: 155000,
    currency: 'USD',
    location: 'San Francisco, CA',
    remoteType: 'On-site',
    notes: 'Rejected after screening. Needed more design system experience.',
    appliedAt: daysAgo(28),
  },
  {
    company: 'CraftDesk',
    position: 'Senior UI Engineer',
    vacancyUrl: 'https://example.com/jobs/craftdesk-senior-ui-engineer',
    status: JobApplicationStatus.OFFER,
    source: 'Recruiter',
    salaryMin: 115000,
    salaryMax: 135000,
    currency: 'USD',
    location: 'Remote, US',
    remoteType: 'Remote',
    notes: 'Offer received. Compare benefits and equity terms.',
    appliedAt: daysAgo(35),
    nextFollowUpAt: daysFromNow(1),
  },
  {
    company: 'OrbitOps',
    position: 'Dashboard Engineer',
    vacancyUrl: 'https://example.com/jobs/orbitops-dashboard-engineer',
    status: JobApplicationStatus.APPLIED,
    source: 'Indeed',
    salaryMin: 78000,
    salaryMax: 98000,
    currency: 'USD',
    location: 'Chicago, IL',
    remoteType: 'Hybrid',
    notes: 'Role is dashboard-heavy. Good portfolio angle.',
    appliedAt: daysAgo(2),
    nextFollowUpAt: daysFromNow(6),
  },
  {
    company: 'BluePeak Systems',
    position: 'Software Engineer II',
    vacancyUrl: 'https://example.com/jobs/bluepeak-software-engineer-ii',
    status: JobApplicationStatus.ARCHIVED,
    source: 'Company careers page',
    salaryMin: 70000,
    salaryMax: 90000,
    currency: 'USD',
    location: 'Denver, CO',
    remoteType: 'On-site',
    notes: 'Archived because relocation requirement is too strict.',
    appliedAt: daysAgo(40),
  },
  {
    company: 'HirePilot',
    position: 'Full Stack TypeScript Engineer',
    vacancyUrl: 'https://example.com/jobs/hirepilot-typescript-engineer',
    status: JobApplicationStatus.SCREENING,
    source: 'Twitter',
    salaryMin: 100000,
    salaryMax: 130000,
    currency: 'USD',
    location: 'Remote',
    remoteType: 'Remote',
    notes: 'Screening call complete. Waiting for take-home assignment.',
    appliedAt: daysAgo(11),
    nextFollowUpAt: daysAgo(1),
  },
  {
    company: 'MetricHouse',
    position: 'Analytics UI Developer',
    vacancyUrl: 'https://example.com/jobs/metrichouse-analytics-ui',
    status: JobApplicationStatus.TECHNICAL_INTERVIEW,
    source: 'LinkedIn',
    salaryMin: 88000,
    salaryMax: 115000,
    currency: 'USD',
    location: 'Boston, MA',
    remoteType: 'Hybrid',
    notes: 'Prepare chart accessibility and table performance examples.',
    appliedAt: daysAgo(17),
    nextFollowUpAt: daysFromNow(7),
  },
  {
    company: 'GreenGrid',
    position: 'Climate Tech Frontend Engineer',
    vacancyUrl: 'https://example.com/jobs/greengrid-frontend',
    status: JobApplicationStatus.APPLIED,
    source: 'Otta',
    salaryMin: 82000,
    salaryMax: 108000,
    currency: 'USD',
    location: 'Remote, Europe',
    remoteType: 'Remote',
    notes: 'Mission-aligned role. Mention data visualization work.',
    appliedAt: daysAgo(6),
    nextFollowUpAt: daysFromNow(2),
  },
  {
    company: 'StackFoundry',
    position: 'Application Developer',
    vacancyUrl: 'https://example.com/jobs/stackfoundry-app-developer',
    status: JobApplicationStatus.SAVED,
    source: 'Glassdoor',
    salaryMin: 75000,
    salaryMax: 95000,
    currency: 'USD',
    location: 'Remote',
    remoteType: 'Remote',
    notes: 'Review job description again before applying.',
    nextFollowUpAt: daysFromNow(8),
  },
  {
    company: 'BrightCart',
    position: 'E-commerce Frontend Engineer',
    vacancyUrl: 'https://example.com/jobs/brightcart-frontend',
    status: JobApplicationStatus.REJECTED,
    source: 'Recruiter',
    salaryMin: 90000,
    salaryMax: 115000,
    currency: 'USD',
    location: 'Seattle, WA',
    remoteType: 'Hybrid',
    notes: 'Rejected after technical interview. Improve testing examples.',
    appliedAt: daysAgo(31),
  },
  {
    company: 'CoreBridge',
    position: 'Backend-leaning Full Stack Engineer',
    vacancyUrl: 'https://example.com/jobs/corebridge-full-stack',
    status: JobApplicationStatus.FINAL_INTERVIEW,
    source: 'Referral',
    salaryMin: 105000,
    salaryMax: 145000,
    currency: 'USD',
    location: 'Remote, US',
    remoteType: 'Remote',
    notes: 'Final conversation about backend depth and ownership.',
    appliedAt: daysAgo(24),
    nextFollowUpAt: daysFromNow(3),
  },
  {
    company: 'PixelRail',
    position: 'Design Systems Engineer',
    vacancyUrl: 'https://example.com/jobs/pixelrail-design-systems',
    status: JobApplicationStatus.APPLIED,
    source: 'Company careers page',
    salaryMin: 98000,
    salaryMax: 128000,
    currency: 'USD',
    location: 'Portland, OR',
    remoteType: 'Hybrid',
    notes: 'Highlight component library and accessibility experience.',
    appliedAt: daysAgo(1),
    nextFollowUpAt: daysFromNow(9),
  },
];

const seedApplications = applications.map((application) => ({
  ...application,
  isDemo: true,
}));

async function main() {
  await prisma.jobApplication.deleteMany({
    where: {
      isDemo: true,
    },
  });

  await prisma.jobApplication.createMany({
    data: seedApplications,
  });

  console.log(`Seeded ${seedApplications.length} job applications.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

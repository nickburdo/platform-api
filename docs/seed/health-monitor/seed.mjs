import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const dayMs = 24 * 60 * 60 * 1000;
const baseDate = new Date();
baseDate.setHours(12, 0, 0, 0);

function daysAgo(days) {
  return new Date(baseDate.getTime() - days * dayMs);
}

const glucoseSeed = [
  { measuredAt: daysAgo(0), fastingValue: 91, note: 'Morning check', isDemo: true },
  { measuredAt: daysAgo(2), afterMealValue: 128, note: 'After lunch', isDemo: true },
  { measuredAt: daysAgo(7), fastingValue: 89, note: 'Stable morning', isDemo: true },
  { measuredAt: daysAgo(9), afterMealValue: 132, note: 'After dinner', isDemo: true },
  { measuredAt: daysAgo(14), fastingValue: 87, note: 'Before breakfast', isDemo: true },
  { measuredAt: daysAgo(16), afterMealValue: 124, note: 'After snack', isDemo: true },
  { measuredAt: daysAgo(21), fastingValue: 90, note: 'Morning check', isDemo: true },
  { measuredAt: daysAgo(23), afterMealValue: 130, note: 'After meal', isDemo: true },
  { measuredAt: daysAgo(28), fastingValue: 92, note: 'Morning check', isDemo: true },
  { measuredAt: daysAgo(30), afterMealValue: 126, note: 'After meal', isDemo: true },
];

const bloodPressureSeed = [
  { measuredAt: daysAgo(0), systolic: 118, diastolic: 76, pulse: 68, note: 'Morning check', isDemo: true },
  { measuredAt: daysAgo(2), systolic: 122, diastolic: 80, pulse: 71, note: 'After walk', isDemo: true },
  { measuredAt: daysAgo(7), systolic: 124, diastolic: 78, pulse: 69, note: 'Rested', isDemo: true },
  { measuredAt: daysAgo(9), systolic: 130, diastolic: 82, pulse: 72, note: 'Evening', isDemo: true },
  { measuredAt: daysAgo(14), systolic: 116, diastolic: 74, pulse: 66, note: 'Calm', isDemo: true },
  { measuredAt: daysAgo(16), systolic: 128, diastolic: 84, pulse: 74, note: 'After stress', isDemo: true },
  { measuredAt: daysAgo(21), systolic: 120, diastolic: 77, pulse: 70, note: 'Morning check', isDemo: true },
  { measuredAt: daysAgo(23), systolic: 134, diastolic: 86, pulse: 76, note: 'After work', isDemo: true },
  { measuredAt: daysAgo(28), systolic: 117, diastolic: 73, pulse: 67, note: 'Rested', isDemo: true },
  { measuredAt: daysAgo(30), systolic: 126, diastolic: 79, pulse: 71, note: 'Morning check', isDemo: true },
];

const weightSeed = [
  { measuredAt: daysAgo(0), value: 84.6, note: 'Morning weight', isDemo: true },
  { measuredAt: daysAgo(2), value: 84.8, note: 'Morning weight', isDemo: true },
  { measuredAt: daysAgo(7), value: 85.0, note: 'Morning weight', isDemo: true },
  { measuredAt: daysAgo(9), value: 85.1, note: 'Morning weight', isDemo: true },
  { measuredAt: daysAgo(14), value: 85.3, note: 'Morning weight', isDemo: true },
  { measuredAt: daysAgo(16), value: 85.4, note: 'Morning weight', isDemo: true },
  { measuredAt: daysAgo(21), value: 85.6, note: 'Morning weight', isDemo: true },
  { measuredAt: daysAgo(23), value: 85.7, note: 'Morning weight', isDemo: true },
  { measuredAt: daysAgo(28), value: 85.9, note: 'Morning weight', isDemo: true },
  { measuredAt: daysAgo(30), value: 86.0, note: 'Morning weight', isDemo: true },
];

const symptomSeed = [
  { happenedAt: daysAgo(0), type: 'bloating', intensity: 2, note: 'Light discomfort', isDemo: true },
  { happenedAt: daysAgo(2), type: 'headache', intensity: 3, note: 'Short episode', isDemo: true },
  { happenedAt: daysAgo(7), type: 'bloating', intensity: 1, note: 'Brief note', isDemo: true },
  { happenedAt: daysAgo(9), type: 'bloating', intensity: 4, note: 'Managed well', isDemo: true },
  { happenedAt: daysAgo(14), type: 'headache', intensity: 2, note: 'Mild issue', isDemo: true },
  { happenedAt: daysAgo(16), type: 'stress', intensity: 5, note: 'Noticeable symptom', isDemo: true },
  { happenedAt: daysAgo(21), type: 'bloating', intensity: 3, note: 'Short episode', isDemo: true },
  { happenedAt: daysAgo(23), type: 'headache', intensity: 4, note: 'Evening note', isDemo: true },
  { happenedAt: daysAgo(28), type: 'bloating', intensity: 2, note: 'Mild issue', isDemo: true },
  { happenedAt: daysAgo(30), type: 'bloating', intensity: 1, note: 'Brief note', isDemo: true },
];

async function main() {
  await prisma.$transaction([
    prisma.glucoseMeasurement.deleteMany({ where: { isDemo: true } }),
    prisma.bloodPressureMeasurement.deleteMany({ where: { isDemo: true } }),
    prisma.weightMeasurement.deleteMany({ where: { isDemo: true } }),
    prisma.symptomEntry.deleteMany({ where: { isDemo: true } }),
  ]);

  await prisma.$transaction([
    prisma.glucoseMeasurement.createMany({ data: glucoseSeed }),
    prisma.bloodPressureMeasurement.createMany({ data: bloodPressureSeed }),
    prisma.weightMeasurement.createMany({ data: weightSeed }),
    prisma.symptomEntry.createMany({ data: symptomSeed }),
  ]);

  const counts = await prisma.$transaction([
    prisma.glucoseMeasurement.count(),
    prisma.bloodPressureMeasurement.count(),
    prisma.weightMeasurement.count(),
    prisma.symptomEntry.count(),
  ]);

  const latest = await prisma.$transaction([
    prisma.glucoseMeasurement.findFirst({
      orderBy: { measuredAt: 'desc' },
      select: { measuredAt: true },
    }),
    prisma.bloodPressureMeasurement.findFirst({
      orderBy: { measuredAt: 'desc' },
      select: { measuredAt: true },
    }),
    prisma.weightMeasurement.findFirst({
      orderBy: { measuredAt: 'desc' },
      select: { measuredAt: true },
    }),
    prisma.symptomEntry.findFirst({
      orderBy: { happenedAt: 'desc' },
      select: { happenedAt: true },
    }),
  ]);

  console.log(
    JSON.stringify(
      {
        glucose: counts[0],
        bloodPressure: counts[1],
        weight: counts[2],
        symptoms: counts[3],
        latest: {
          glucose: latest[0]?.measuredAt.toISOString(),
          bloodPressure: latest[1]?.measuredAt.toISOString(),
          weight: latest[2]?.measuredAt.toISOString(),
          symptoms: latest[3]?.happenedAt.toISOString(),
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

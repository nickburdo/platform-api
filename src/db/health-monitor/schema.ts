import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

const commonColumns = {
  id: text('id').primaryKey(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  isDemo: integer('is_demo', { mode: 'boolean' as const })
    .notNull()
    .default(false),
  ignored: integer('ignored', { mode: 'boolean' as const })
    .notNull()
    .default(false),
  reason: text('reason'),
};

export const glucoseMeasurements = sqliteTable(
  'glucose_measurements',
  {
    ...commonColumns,
    measuredAt: text('measured_at').notNull(),
    fastingValue: real('fasting_value'),
    afterMealValue: real('after_meal_value'),
    note: text('note'),
  },
  (table) => [index('glucose_measurements_measured_at_idx').on(table.measuredAt)],
);

export const bloodPressureMeasurements = sqliteTable(
  'blood_pressure_measurements',
  {
    ...commonColumns,
    measuredAt: text('measured_at').notNull(),
    systolic: integer('systolic').notNull(),
    diastolic: integer('diastolic').notNull(),
    pulse: integer('pulse').notNull(),
    note: text('note'),
  },
  (table) => [index('blood_pressure_measurements_measured_at_idx').on(table.measuredAt)],
);

export const weightMeasurements = sqliteTable(
  'weight_measurements',
  {
    ...commonColumns,
    measuredAt: text('measured_at').notNull(),
    value: real('value').notNull(),
    note: text('note'),
  },
  (table) => [index('weight_measurements_measured_at_idx').on(table.measuredAt)],
);

export const symptomEntries = sqliteTable(
  'symptom_entries',
  {
    ...commonColumns,
    happenedAt: text('happened_at').notNull(),
    type: text('type').notNull(),
    intensity: integer('intensity').notNull(),
    note: text('note'),
  },
  (table) => [
    index('symptom_entries_happened_at_idx').on(table.happenedAt),
    index('symptom_entries_type_idx').on(table.type),
  ],
);

export type GlucoseMeasurement = typeof glucoseMeasurements.$inferSelect;
export type NewGlucoseMeasurement = typeof glucoseMeasurements.$inferInsert;
export type BloodPressureMeasurement = typeof bloodPressureMeasurements.$inferSelect;
export type NewBloodPressureMeasurement = typeof bloodPressureMeasurements.$inferInsert;
export type WeightMeasurement = typeof weightMeasurements.$inferSelect;
export type NewWeightMeasurement = typeof weightMeasurements.$inferInsert;
export type SymptomEntry = typeof symptomEntries.$inferSelect;
export type NewSymptomEntry = typeof symptomEntries.$inferInsert;

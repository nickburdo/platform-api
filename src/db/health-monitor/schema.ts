import { sql } from 'drizzle-orm';
import { check, index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

const commonColumns = {
  id: text('id').primaryKey(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  // null = demo scope (v4 Decision 1).
  userId: text('user_id'),
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
  (table) => [
    index('glucose_measurements_measured_at_idx').on(table.measuredAt),
    index('glucose_measurements_user_id_idx').on(table.userId),
  ],
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
  (table) => [
    index('blood_pressure_measurements_measured_at_idx').on(table.measuredAt),
    index('blood_pressure_measurements_user_id_idx').on(table.userId),
  ],
);

export const weightMeasurements = sqliteTable(
  'weight_measurements',
  {
    ...commonColumns,
    measuredAt: text('measured_at').notNull(),
    value: real('value').notNull(),
    note: text('note'),
  },
  (table) => [
    index('weight_measurements_measured_at_idx').on(table.measuredAt),
    index('weight_measurements_user_id_idx').on(table.userId),
  ],
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
    index('symptom_entries_user_id_idx').on(table.userId),
  ],
);

// Single-row state of the daily demo date shift (v4.2-plan.md Decision 6,
// ADR-015). refreshed_at is the moment the demo dates correspond to; it is
// written by seed.sql and advanced by exactly N whole days on every shift.
export const demoRefreshState = sqliteTable(
  'demo_refresh_state',
  {
    id: integer('id').primaryKey(),
    refreshedAt: text('refreshed_at').notNull(),
  },
  (table) => [check('demo_refresh_state_single_row', sql`${table.id} = 1`)],
);

export type GlucoseMeasurement = typeof glucoseMeasurements.$inferSelect;
export type NewGlucoseMeasurement = typeof glucoseMeasurements.$inferInsert;
export type BloodPressureMeasurement = typeof bloodPressureMeasurements.$inferSelect;
export type NewBloodPressureMeasurement = typeof bloodPressureMeasurements.$inferInsert;
export type WeightMeasurement = typeof weightMeasurements.$inferSelect;
export type NewWeightMeasurement = typeof weightMeasurements.$inferInsert;
export type SymptomEntry = typeof symptomEntries.$inferSelect;
export type NewSymptomEntry = typeof symptomEntries.$inferInsert;

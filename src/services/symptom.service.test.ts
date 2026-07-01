import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { createHealthMonitorDb, type HealthMonitorDb } from '../db/health-monitor/client';
import { symptomEntries } from '../db/health-monitor/schema';
import {
  createSymptomEntry,
  findSymptomEntryById,
  listSymptomEntries,
  updateSymptomEntry,
} from './symptom.service';

let db: HealthMonitorDb;

beforeEach(async () => {
  db = createHealthMonitorDb(env.HEALTH_MONITOR_DB);
  await db.delete(symptomEntries);
});

const happenedAt = '2026-06-15T08:00:00.000Z';

describe('createSymptomEntry', () => {
  it('sets isDemo: true, ignored: false, reason: "", and stamps timestamps', async () => {
    const created = await createSymptomEntry(db, 's-1', {
      happenedAt,
      type: 'headache',
      intensity: 3,
    });
    expect(created.isDemo).toBe(true);
    expect(created.ignored).toBe(false);
    expect(created.reason).toBe('');
    expect(created.createdAt).toBe(created.updatedAt);
  });
});

describe('updateSymptomEntry', () => {
  it('returns undefined for a missing id', async () => {
    expect(await updateSymptomEntry(db, 'nope', { ignored: true, reason: 'x' })).toBeUndefined();
  });
});

describe('listSymptomEntries / findSymptomEntryById', () => {
  it('lists and finds created records', async () => {
    await createSymptomEntry(db, 's-2', { happenedAt, type: 'bloating', intensity: 2 });
    const rows = await listSymptomEntries(db, {});
    expect(rows.map((r) => r.id)).toEqual(['s-2']);
    expect((await findSymptomEntryById(db, 's-2'))?.type).toBe('bloating');
  });
});

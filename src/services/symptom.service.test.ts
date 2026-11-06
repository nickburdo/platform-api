import { beforeEach, describe, expect, it } from 'vitest';
import type { HealthMonitorDb } from '../db/health-monitor/client';
import { symptomEntries } from '../db/health-monitor/schema';
import { freshHealthMonitorDb } from '../db/health-monitor/test-helpers';
import {
  createSymptomEntry,
  findSymptomEntryById,
  listSymptomEntries,
  updateSymptomEntry,
} from './symptom.service';

let db: HealthMonitorDb;

beforeEach(async () => {
  db = await freshHealthMonitorDb(symptomEntries);
});

const happenedAt = '2026-06-15T08:00:00.000Z';

describe('createSymptomEntry', () => {
  it('stores the caller as owner, strips userId, ignored: false, reason: "", and stamps timestamps', async () => {
    const created = await createSymptomEntry(
      db,
      's-1',
      { happenedAt, type: 'headache', intensity: 3 },
      'user-a',
    );
    expect(created).not.toHaveProperty('userId');
    expect(created).not.toHaveProperty('isDemo');
    expect(await findSymptomEntryById(db, 's-1', 'user-a')).toBeDefined();
    expect(await findSymptomEntryById(db, 's-1', null)).toBeUndefined();
    expect(created.ignored).toBe(false);
    expect(created.reason).toBe('');
    expect(created.createdAt).toBe(created.updatedAt);
  });
});

describe('updateSymptomEntry', () => {
  it('returns undefined for a missing id', async () => {
    expect(
      await updateSymptomEntry(db, 'nope', { ignored: true, reason: 'x' }, 'user-a'),
    ).toBeUndefined();
  });

  it('returns undefined when the id exists but outside the requested owner scope', async () => {
    await createSymptomEntry(db, 's-3b', { happenedAt, type: 'headache', intensity: 3 }, 'user-b');
    expect(
      await updateSymptomEntry(db, 's-3b', { ignored: true, reason: 'x' }, 'user-a'),
    ).toBeUndefined();
  });

  it('throws if called directly with ignored: true and no reason, bypassing Zod', async () => {
    await createSymptomEntry(db, 's-3', { happenedAt, type: 'headache', intensity: 3 }, 'user-a');
    await expect(updateSymptomEntry(db, 's-3', { ignored: true }, 'user-a')).rejects.toThrow(
      'reason is required when ignored is true',
    );
  });
});

describe('listSymptomEntries / findSymptomEntryById', () => {
  it('lists and finds created records', async () => {
    await createSymptomEntry(db, 's-2', { happenedAt, type: 'bloating', intensity: 2 }, 'user-a');
    const rows = await listSymptomEntries(db, {}, 'user-a');
    expect(rows.map((r) => r.id)).toEqual(['s-2']);
    expect((await findSymptomEntryById(db, 's-2', 'user-a'))?.type).toBe('bloating');
  });
});

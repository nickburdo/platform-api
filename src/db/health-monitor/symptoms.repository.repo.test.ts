import { beforeEach, describe, expect, it } from 'vitest';
import type { HealthMonitorDb } from './client';
import { symptomEntries, type NewSymptomEntry } from './schema';
import {
  createSymptomEntry,
  findSymptomEntryById,
  listSymptomEntries,
  updateSymptomEntry,
} from './symptoms.repository';
import { freshHealthMonitorDb } from './test-helpers';

let db: HealthMonitorDb;

beforeEach(async () => {
  db = await freshHealthMonitorDb(symptomEntries);
});

function makeRow(overrides: Partial<NewSymptomEntry> = {}): NewSymptomEntry {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    happenedAt: '2026-06-15T08:00:00.000Z',
    type: 'headache',
    intensity: 3,
    isDemo: true,
    ignored: false,
    reason: '',
    createdAt: '2026-06-15T08:00:00.000Z',
    updatedAt: '2026-06-15T08:00:00.000Z',
    ...overrides,
  };
}

describe('createSymptomEntry / findSymptomEntryById', () => {
  it('creates a row and finds it by id', async () => {
    const created = await createSymptomEntry(db, makeRow({ id: 's-1', type: 'bloating' }));
    expect(created.type).toBe('bloating');

    const found = await findSymptomEntryById(db, 's-1', true);
    expect(found?.type).toBe('bloating');
  });

  it('returns undefined when the id exists but outside the requested isDemo scope', async () => {
    await createSymptomEntry(db, makeRow({ id: 's-1b', isDemo: false }));
    expect(await findSymptomEntryById(db, 's-1b', true)).toBeUndefined();
    expect((await findSymptomEntryById(db, 's-1b', false))?.id).toBe('s-1b');
  });
});

describe('updateSymptomEntry', () => {
  it('supports an ignore-only update', async () => {
    await createSymptomEntry(db, makeRow({ id: 's-2' }));
    const updated = await updateSymptomEntry(
      db,
      's-2',
      { ignored: true, reason: 'Created by mistake' },
      true,
    );
    expect(updated?.ignored).toBe(true);
    expect(updated?.type).toBe('headache');
  });

  it('returns undefined when the id exists but outside the requested isDemo scope', async () => {
    await createSymptomEntry(db, makeRow({ id: 's-2b', isDemo: false }));
    expect(
      await updateSymptomEntry(db, 's-2b', { ignored: true, reason: 'x' }, true),
    ).toBeUndefined();
  });
});

describe('listSymptomEntries', () => {
  it('filters by date range using happenedAt', async () => {
    await Promise.all([
      createSymptomEntry(db, makeRow({ id: 'd-1', happenedAt: '2026-06-01T08:00:00.000Z' })),
      createSymptomEntry(db, makeRow({ id: 'd-2', happenedAt: '2026-06-15T08:00:00.000Z' })),
    ]);
    const rows = await listSymptomEntries(db, { date_from: '2026-06-10' });
    expect(rows.map((r) => r.id)).toEqual(['d-2']);
  });
});

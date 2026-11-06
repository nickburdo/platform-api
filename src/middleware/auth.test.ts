import { describe, expect, it } from 'vitest';
import { ownerIdOf } from './auth';

describe('ownerIdOf', () => {
  it('maps a guest to the demo scope (null)', () => {
    expect(ownerIdOf({ scope: 'guest' })).toBeNull();
  });

  it('maps a user to their id', () => {
    expect(ownerIdOf({ scope: 'user', userId: 'user-1' })).toBe('user-1');
  });
});

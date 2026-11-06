import { describe, expect, it } from 'vitest';
import { ownerIdOf, scopeIsDemo, type Identity } from './auth';

describe('ownerIdOf', () => {
  it('maps a guest to the demo scope (null)', () => {
    expect(ownerIdOf({ scope: 'guest' })).toBeNull();
  });

  it('maps a user to their id', () => {
    expect(ownerIdOf({ scope: 'user', userId: 'user-1' })).toBe('user-1');
  });
});

describe('scopeIsDemo (temporary)', () => {
  it('is true for guests and false for users', () => {
    const guest: Identity = { scope: 'guest' };
    const user: Identity = { scope: 'user', userId: 'user-1' };
    expect(scopeIsDemo(guest)).toBe(true);
    expect(scopeIsDemo(user)).toBe(false);
  });
});

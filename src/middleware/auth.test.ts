import { describe, expect, it } from 'vitest';
import { scopeIsDemo, type Identity } from './auth';

describe('scopeIsDemo', () => {
  it('scopes guests to the demo world', () => {
    const guest: Identity = { scope: 'guest' };
    expect(scopeIsDemo(guest)).toBe(true);
  });

  it('scopes the admin to the real world', () => {
    const admin: Identity = { scope: 'admin', userId: 'user-1' };
    expect(scopeIsDemo(admin)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('hashPassword / verifyPassword', () => {
  it('round-trips a correct password', async () => {
    const stored = await hashPassword('correct horse battery staple');
    expect(stored.startsWith('pbkdf2-sha256:100000:')).toBe(true);
    expect(await verifyPassword('correct horse battery staple', stored)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const stored = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('wrong horse', stored)).toBe(false);
  });

  it('produces a different salt (and hash) every time', async () => {
    const first = await hashPassword('same password');
    const second = await hashPassword('same password');
    expect(first).not.toBe(second);
    expect(await verifyPassword('same password', first)).toBe(true);
    expect(await verifyPassword('same password', second)).toBe(true);
  });

  it('rejects tampered or foreign stored formats', async () => {
    expect(await verifyPassword('anything', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('anything', 'bcrypt:10:abc:def')).toBe(false);
    expect(await verifyPassword('anything', 'pbkdf2-sha256:oops:c2FsdA==:aGFzaA==')).toBe(false);
    expect(await verifyPassword('anything', 'pbkdf2-sha256:100000:!!!:???')).toBe(false);
  });

  it('honors the iteration count embedded in the stored value', async () => {
    const stored = await hashPassword('parameterized');
    const [, , salt, hash] = stored.split(':');
    // Same salt+hash but a different declared iteration count must not verify.
    expect(await verifyPassword('parameterized', `pbkdf2-sha256:50000:${salt}:${hash}`)).toBe(
      false,
    );
  });
});

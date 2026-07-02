import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { issueToken, verifyToken } from './jwt';

const SECRET = 'unit-test-secret';

describe('issueToken / verifyToken', () => {
  it('round-trips a valid token', async () => {
    const token = await issueToken('user-1', SECRET);
    const payload = await verifyToken(token, SECRET);
    expect(payload).toEqual({ sub: 'user-1', role: 'ADMIN' });
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await issueToken('user-1', 'other-secret');
    expect(await verifyToken(token, SECRET)).toBeNull();
  });

  it('rejects garbage and empty strings', async () => {
    expect(await verifyToken('not.a.jwt', SECRET)).toBeNull();
    expect(await verifyToken('', SECRET)).toBeNull();
  });

  it('rejects an expired token', async () => {
    const expired = await new SignJWT({ role: 'ADMIN' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-1')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 120)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(SECRET));
    expect(await verifyToken(expired, SECRET)).toBeNull();
  });

  it('rejects a structurally valid token without the expected claims', async () => {
    const noRole = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-1')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(SECRET));
    expect(await verifyToken(noRole, SECRET)).toBeNull();
  });
});

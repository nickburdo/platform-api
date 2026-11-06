import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { issueToken, verifyToken } from './jwt';

const SECRET = 'unit-test-secret';

function sign(claims: Record<string, unknown>, subject?: string) {
  const jwt = new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h');
  if (subject !== undefined) {
    jwt.setSubject(subject);
  }
  return jwt.sign(new TextEncoder().encode(SECRET));
}

describe('issueToken / verifyToken', () => {
  it('round-trips a valid token (no role claim)', async () => {
    const token = await issueToken('user-1', SECRET);
    expect(await verifyToken(token, SECRET)).toEqual({ sub: 'user-1' });
  });

  it('verifies a token without any role claim', async () => {
    expect(await verifyToken(await sign({}, 'user-1'), SECRET)).toEqual({ sub: 'user-1' });
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
    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-1')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 120)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(SECRET));
    expect(await verifyToken(expired, SECRET)).toBeNull();
  });

  it('rejects a token with an empty or missing sub', async () => {
    expect(await verifyToken(await sign({}, ''), SECRET)).toBeNull();
    expect(await verifyToken(await sign({}), SECRET)).toBeNull();
  });
});

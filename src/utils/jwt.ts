import { SignJWT, jwtVerify } from 'jose';

// Access tokens per v2-plan.md Decisions #4/#7/#12: HS256, 30-day expiry,
// payload sub/role/iat/exp. No refresh tokens, no server-side revocation.

export const TOKEN_TTL = '30d';

export interface AuthTokenPayload {
  sub: string;
  role: 'ADMIN';
}

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function issueToken(userId: string, secret: string): Promise<string> {
  return new SignJWT({ role: 'ADMIN' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(secretKey(secret));
}

// Returns the payload for a valid, unexpired token; null for anything else
// (bad signature, malformed, expired, unexpected shape). The caller decides
// what null means — per Decision #9 a presented-but-invalid token is a 401.
export async function verifyToken(token: string, secret: string): Promise<AuthTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(secret));
    if (typeof payload.sub !== 'string' || payload.sub.length === 0 || payload.role !== 'ADMIN') {
      return null;
    }
    return { sub: payload.sub, role: 'ADMIN' };
  } catch {
    return null;
  }
}

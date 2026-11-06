import { SignJWT, jwtVerify } from 'jose';

// Access tokens: HS256, 30-day expiry, payload sub/iat/exp. No role claim
// (V4 removed roles), no refresh tokens, no server-side revocation.

export const TOKEN_TTL = '30d';

export interface AuthTokenPayload {
  sub: string;
}

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function issueToken(userId: string, secret: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(secretKey(secret));
}

// Returns the payload for a valid, unexpired token; null for anything else
// (bad signature, malformed, expired, empty sub). The caller decides what
// null means — a presented-but-invalid token is a 401.
export async function verifyToken(token: string, secret: string): Promise<AuthTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(secret));
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      return null;
    }
    return { sub: payload.sub };
  } catch {
    return null;
  }
}

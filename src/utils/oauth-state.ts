import { SignJWT, jwtVerify } from 'jose';

// CSRF protection for GET /auth/google's redirect (v3-plan.md Decision #8):
// a signed, storageless `state` — a short-lived JWT distinguished from a real
// access token by its `purpose` claim, not by a different signing key.

export const STATE_TTL = '10m';
const STATE_PURPOSE = 'oauth_state';

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

// Decision 19: a login state carries only the redirect; a link state also
// carries the id of the user who started the link.
export type OAuthStateClaims =
  | { intent: 'login'; redirect: string }
  | { intent: 'link'; redirect: string; userId: string };

// `redirect` (the allow-listed frontend URL, validated before issuing) travels
// inside the signed state so the callback trusts only what this server signed
// itself (v4-plan.md Decision 13).
export async function issueOAuthState(secret: string, claims: OAuthStateClaims): Promise<string> {
  return new SignJWT({
    purpose: STATE_PURPOSE,
    ...claims,
    // Not verified by verifyOAuthState below — Decision #8's storageless
    // design has nothing to check it against (no server-side nonce
    // tracking), so it provides no replay protection by itself. CSRF
    // protection comes entirely from the signature + short expiry +
    // `purpose` claim. Kept only so two states issued within the same
    // second (same `iat`) aren't byte-identical tokens.
    nonce: crypto.randomUUID(),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(STATE_TTL)
    .sign(secretKey(secret));
}

// Returns the claims of a valid, unexpired state issued by this server for
// this exact purpose, or null on any failure (bad signature, malformed,
// expired, wrong `purpose`, missing `redirect`) — the caller rejects before
// calling Google.
export async function verifyOAuthState(
  token: string,
  secret: string,
): Promise<OAuthStateClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(secret), { algorithms: ['HS256'] });
    if (payload.purpose !== STATE_PURPOSE || typeof payload.redirect !== 'string') {
      return null;
    }
    if (payload.intent === 'login') {
      return { intent: 'login', redirect: payload.redirect };
    }
    if (payload.intent === 'link' && typeof payload.userId === 'string' && payload.userId) {
      return { intent: 'link', redirect: payload.redirect, userId: payload.userId };
    }
    return null;
  } catch {
    return null;
  }
}

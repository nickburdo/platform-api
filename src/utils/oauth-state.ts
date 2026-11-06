import { SignJWT, jwtVerify } from 'jose';

// The OAuth `state` for GET /auth/google and POST /auth/google/link
// (v3-plan.md Decision #8): a signed, storageless, short-lived JWT
// distinguished from an access token and from a link ticket by its `purpose`
// claim, not by a different signing key.
//
// What it proves: that this server issued the state (for this redirect and
// intent) within the last 10 minutes. What it does NOT prove: that the browser
// arriving at the callback is the one that started the flow — nothing binds
// the state to a browser, so an attacker can start a flow and hand the
// resulting URL to a victim. It is therefore not CSRF protection by itself
// (this corrects the original V3 wording). The mitigations are the two-step
// link flow (Decision 22: the callback never links, it only hands out a link
// ticket) and the frontend nonce rule (spec U18) for sign-in and link
// callback pages.

export const STATE_TTL = '10m';
const STATE_PURPOSE = 'oauth_state';

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

// Decision 19: a login state carries only the redirect; a link state also
// carries the id of the user who started the link (copied into the link
// ticket, Decision 22).
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
    // tracking), so it provides no replay protection and no browser
    // binding. Kept only so two states issued within the same second (same
    // `iat`) aren't byte-identical tokens.
    nonce: crypto.randomUUID(),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(STATE_TTL)
    .sign(secretKey(secret));
}

// Returns the claims of a valid, unexpired state issued by this server for
// this exact purpose, or null on any failure — the caller rejects before
// calling Google. Null reasons: bad signature (including any state signed
// before a JWT_SECRET rotation), malformed, expired (older than 10 minutes),
// wrong `purpose` (an access token or a link ticket), missing `redirect`,
// unknown or missing `intent`, a `link` intent without a non-empty `userId`,
// and any pre-V4 state (it has neither `redirect` nor `intent`), so a Google
// sign-in in flight across the V4 deploy fails with 401 and must be retried.
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

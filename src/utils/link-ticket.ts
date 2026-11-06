import { SignJWT, jwtVerify } from 'jose';

// v4-plan.md Decision 22: the Google callback for `intent: 'link'` never links
// by itself — the browser that completes Google's consent screen may not be
// the user who started the link (an attacker can hand a victim their own link
// URL). Instead it hands the frontend this short-lived ticket, and
// POST /auth/google/link/complete links only when the caller's token belongs
// to the user named in the ticket (Decision 23).
//
// Distinguished from an access token and from an OAuth state by its `purpose`
// claim (same signing key). The Google subject travels as `googleSub`, never
// as the registered `sub` claim: an access token is any validly signed JWT
// with a non-empty `sub` (utils/jwt.ts), so a ticket carrying `sub` would be
// accepted as an access token for a user id equal to the Google subject.

export const LINK_TICKET_TTL = '5m';
const LINK_TICKET_PURPOSE = 'google_link';

export interface LinkTicketClaims {
  userId: string;
  sub: string;
}

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function issueLinkTicket(secret: string, claims: LinkTicketClaims): Promise<string> {
  return new SignJWT({
    purpose: LINK_TICKET_PURPOSE,
    userId: claims.userId,
    googleSub: claims.sub,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(LINK_TICKET_TTL)
    .sign(secretKey(secret));
}

// Returns the claims of a valid, unexpired ticket issued by this server for
// this exact purpose, or null on any failure (bad signature, malformed,
// expired, wrong `purpose`, missing or empty `userId`/`googleSub`).
export async function verifyLinkTicket(
  token: string,
  secret: string,
): Promise<LinkTicketClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(secret), { algorithms: ['HS256'] });
    if (
      payload.purpose !== LINK_TICKET_PURPOSE ||
      typeof payload.userId !== 'string' ||
      !payload.userId ||
      typeof payload.googleSub !== 'string' ||
      !payload.googleSub
    ) {
      return null;
    }
    return { userId: payload.userId, sub: payload.googleSub };
  } catch {
    return null;
  }
}

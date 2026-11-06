import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { issueToken, verifyToken } from './jwt';
import { issueLinkTicket, verifyLinkTicket } from './link-ticket';
import { issueOAuthState, verifyOAuthState } from './oauth-state';

const SECRET = 'link-ticket-test-secret';
const REDIRECT = 'https://job-tracker-new.pages.dev/auth/callback';

function sign(claims: Record<string, unknown>, expiresAt: number | string = '5m') {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(new TextEncoder().encode(SECRET));
}

describe('issueLinkTicket / verifyLinkTicket', () => {
  it('round-trips a freshly issued ticket', async () => {
    const ticket = await issueLinkTicket(SECRET, { userId: 'user-1', sub: 'google-sub-1' });
    expect(await verifyLinkTicket(ticket, SECRET)).toEqual({
      userId: 'user-1',
      sub: 'google-sub-1',
    });
  });

  it('expires after 5 minutes', async () => {
    const ticket = await issueLinkTicket(SECRET, { userId: 'user-1', sub: 'google-sub-1' });
    const payload = JSON.parse(atob(ticket.split('.')[1]!)) as { iat: number; exp: number };
    expect(payload.exp - payload.iat).toBe(300);
  });

  it('rejects an expired ticket', async () => {
    const expired = await sign(
      { purpose: 'google_link', userId: 'user-1', googleSub: 'google-sub-1' },
      Math.floor(Date.now() / 1000) - 10,
    );
    expect(await verifyLinkTicket(expired, SECRET)).toBeNull();
  });

  it('rejects a ticket signed with a different secret', async () => {
    const ticket = await issueLinkTicket('other-secret', { userId: 'user-1', sub: 'g' });
    expect(await verifyLinkTicket(ticket, SECRET)).toBeNull();
  });

  it('rejects a tampered payload (invalid signature)', async () => {
    const ticket = await issueLinkTicket(SECRET, { userId: 'user-1', sub: 'google-sub-1' });
    const [header, , signature] = ticket.split('.');
    const forged = btoa(
      JSON.stringify({ purpose: 'google_link', userId: 'attacker', googleSub: 'google-sub-1' }),
    )
      .replace(/=+$/, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    expect(await verifyLinkTicket(`${header}.${forged}.${signature}`, SECRET)).toBeNull();
  });

  it('rejects garbage and empty strings', async () => {
    expect(await verifyLinkTicket('not.a.jwt', SECRET)).toBeNull();
    expect(await verifyLinkTicket('', SECRET)).toBeNull();
  });

  it('rejects a ticket with a wrong purpose or a missing/empty userId or googleSub', async () => {
    for (const claims of [
      { purpose: 'oauth_state', userId: 'user-1', googleSub: 'g' },
      { userId: 'user-1', googleSub: 'g' },
      { purpose: 'google_link', googleSub: 'g' },
      { purpose: 'google_link', userId: '', googleSub: 'g' },
      { purpose: 'google_link', userId: 'user-1' },
      { purpose: 'google_link', userId: 'user-1', googleSub: '' },
      // The Google subject must travel as googleSub, never as `sub`.
      { purpose: 'google_link', userId: 'user-1', sub: 'g' },
    ]) {
      expect(await verifyLinkTicket(await sign(claims), SECRET)).toBeNull();
    }
  });
});

describe('cross-purpose rejection (same signing key)', () => {
  it('an access token is not a link ticket', async () => {
    const accessToken = await issueToken('user-1', SECRET);
    expect(await verifyLinkTicket(accessToken, SECRET)).toBeNull();
  });

  it('a login or link OAuth state is not a link ticket', async () => {
    const login = await issueOAuthState(SECRET, { intent: 'login', redirect: REDIRECT });
    const link = await issueOAuthState(SECRET, {
      intent: 'link',
      redirect: REDIRECT,
      userId: 'user-1',
    });
    expect(await verifyLinkTicket(login, SECRET)).toBeNull();
    expect(await verifyLinkTicket(link, SECRET)).toBeNull();
  });

  it('a link ticket is not an access token', async () => {
    const ticket = await issueLinkTicket(SECRET, { userId: 'user-1', sub: 'google-sub-1' });
    expect(await verifyToken(ticket, SECRET)).toBeNull();
  });

  it('a link ticket is not an OAuth state', async () => {
    const ticket = await issueLinkTicket(SECRET, { userId: 'user-1', sub: 'google-sub-1' });
    expect(await verifyOAuthState(ticket, SECRET)).toBeNull();
  });
});

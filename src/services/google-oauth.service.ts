// Google token exchange via raw `fetch`, no OAuth library (v3-plan.md
// Decision #7). Isolated as its own function, injected into the callback
// resolver (v3 Decision #11), so tests can substitute a fake — only this
// literal network boundary is faked.
//
// The account key (`sub`) comes from the `id_token` returned by the token
// endpoint, decoded without signature verification (v4-plan.md Decision 11):
// the token was received directly from Google over HTTPS in exchange for our
// client secret. `iss`, `aud` and `sub` are still checked.

import { decodeJwt } from 'jose';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

export interface GoogleOAuthEnv {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
}

export interface GoogleUserInfo {
  // Google's stable account id (OpenID `sub`).
  sub: string;
}

interface GoogleTokenResponse {
  id_token?: string;
}

export async function exchangeGoogleCode(
  code: string,
  env: GoogleOAuthEnv,
  redirectUri: string,
): Promise<GoogleUserInfo> {
  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!tokenResponse.ok) {
    const body = await tokenResponse.text().catch(() => '');
    throw new Error(`Google token exchange failed: ${tokenResponse.status} ${body}`);
  }
  const { id_token: idToken } = (await tokenResponse.json()) as GoogleTokenResponse;
  if (!idToken) {
    throw new Error('Google token response has no id_token');
  }

  const claims = decodeJwt(idToken);
  if (!claims.iss || !GOOGLE_ISSUERS.includes(claims.iss)) {
    throw new Error('Google id_token has an unexpected issuer');
  }
  if (claims.aud !== env.GOOGLE_CLIENT_ID) {
    throw new Error('Google id_token audience does not match the client id');
  }
  if (typeof claims.sub !== 'string' || claims.sub === '') {
    throw new Error('Google id_token has no sub');
  }
  return { sub: claims.sub };
}

// Google token exchange via raw `fetch`, no OAuth library (v3-plan.md
// Decision #7). Isolated as its own function, injected into the route
// handler rather than called inline (Decision #11), so route tests can
// substitute a fake — only this literal network boundary is faked; email
// lookup and JWT issuance are exercised for real against D1.

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

export interface GoogleOAuthEnv {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
}

export interface GoogleUserInfo {
  email: string;
}

interface GoogleTokenResponse {
  access_token: string;
}

interface GoogleUserInfoResponse {
  email?: string;
  // Present when the `email` scope is granted. Only ever explicitly `false`
  // for accounts Google itself hasn't verified — checked defensively even
  // though a personal Gmail admin account will never hit this in practice.
  verified_email?: boolean;
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
    throw new Error(`Google token exchange failed: ${tokenResponse.status}`);
  }
  const { access_token: accessToken } = (await tokenResponse.json()) as GoogleTokenResponse;

  const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!userInfoResponse.ok) {
    throw new Error(`Google userinfo fetch failed: ${userInfoResponse.status}`);
  }
  const userInfo = (await userInfoResponse.json()) as GoogleUserInfoResponse;
  if (!userInfo.email || userInfo.verified_email === false) {
    throw new Error('Google account has no verified email');
  }
  return { email: userInfo.email };
}

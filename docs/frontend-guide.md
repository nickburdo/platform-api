# Frontend Guide

> Rules for frontend developers: where to warn, where to confirm, and how to react to the API's authentication responses.
>
> Applies to every frontend that talks to Platform API (today: Health Monitor and Job Tracker). The exact request and response contracts live in `api.md`; adding a new frontend to the allowlist is described in `connecting-a-frontend.md`.

---

# The Three States of a Visitor

| State | What the API sees | What the visitor can do |
|-------|-------------------|-------------------------|
| **Guest** | no `Authorization` header | read demo data only; every write is refused |
| **User** | `Authorization: Bearer <token>` of an existing account | read and write only their own data (demo data is not shown) |
| **Stale token** | a token that is invalid, expired or belongs to a deleted account | nothing — the API answers `401` until the token is discarded |

Design the UI around this: a first-time visitor starts as a guest and sees a populated app (demo data); to add anything of their own they must register or sign in.

---

# 1. Guest Writes: Show a "Register" Prompt

A guest who tries to create, edit, delete, ignore or restore anything receives:

```http
401 Unauthorized
```

```json
{ "error": { "message": "Authentication required" } }
```

This happens before the body is validated — a guest gets this `401` even for an invalid body.

**What the frontend does:** recognise this response (status `401` and message `Authentication required`) and show a prompt such as "Register to add your own data", offering **both** options: register with a username and password, or sign in with Google (or log in, for returning users). Do not show a generic error.

You may also hide or disable write controls for guests up front, but the `401` is the authoritative signal — keep handling it.

---

# 2. Registration Form: Warn About Lost Passwords

Registration asks for a **username and password only** — no email.

- Username: 3–32 characters, letters, digits, `_` and `-`. Names are unique case-insensitively (`Nick` and `nick` are the same name).
- Password: 8–128 characters.

Because there is no email, **a lost password cannot be recovered** — the account and its data are lost. The registration form must say so explicitly, next to the password field, for example: "We don't ask for an email, so we cannot reset your password. If you forget it, your account is lost."

Also suggest **Sign in with Google** as the more reliable option: Google accounts are recoverable through Google.

On success `POST /auth/register` returns `201` with `{ data: { token, user } }` — the visitor is already signed in; no separate login step.

---

# 3. Username Taken: `409`

`POST /auth/register` returns `409` with the message `Username is already taken`. Show "This username is taken" next to the username field and let the visitor pick another. Remember that the check is case-insensitive.

The same message and status are returned by `POST /auth/me/password` when the optional `username` is taken (see "Optional: Linking" below).

---

# 4. Wrong Credentials: Login `401`

`POST /auth/login` answers `401` with the message `Invalid credentials` for an unknown username, a wrong password, **and** a Google-only account (which has no password). The API deliberately does not say which one it was. Show a single message such as "Wrong username or password".

If the visitor's account was created through Google, the message may add a hint: "If you signed up with Google, use the Google button."

---

# 5. Stale Token: Discard and Return to Guest Mode

Any request — read or write — may answer:

```http
401 Unauthorized
```

```json
{ "error": { "message": "Invalid or expired token" } }
```

This means the token is malformed, expired (tokens live 30 days), or its account has been deleted (including from the other app — see point 8). The API never silently falls back to guest data for such a token.

**What the frontend does:** discard the stored token, switch the UI to guest mode (demo data), and offer to log in again ("Your session has expired").

Keep the two `401` messages apart: `Authentication required` means "you are a guest, sign in to write"; `Invalid or expired token` means "your session is gone, sign in again".

**Never send the `Authorization` header to `POST /auth/register` or `POST /auth/login`.** The token check runs on every route, including these two: a stale token sent along would make the API answer `401 Invalid or expired token` instead of registering or logging the visitor in.

---

# 6. Logout: Discard the Token

There is no logout endpoint and no server-side session. **Logout = delete the token from the frontend's storage** and return to guest mode. Tokens are not revoked server-side; they simply stop being used.

---

# 7. Account Deletion: Confirm Explicitly

`DELETE /auth/me` deletes the account **and all of its data**, irreversibly. It requires only a valid token (no password re-entry, because Google accounts have no password), so **the confirmation is the frontend's responsibility**.

Show an explicit confirmation dialog before sending the request. It must state that:

- the account will be deleted permanently;
- **all data in both apps — Health Monitor and Job Tracker — will be deleted irreversibly**, not just the data of the app the visitor is currently using;
- this cannot be undone and the password/account cannot be recovered.

Prefer a deliberate confirmation (for example typing the username, or a clearly worded destructive button) over a plain "OK".

On `204` discard the token and return to guest mode. If the request fails midway, repeating it is safe and finishes the job.

---

# 8. One Account for Both Apps

Health Monitor and Job Tracker share one API and one user database. An account registered in one app works in the other with the same username and password (or the same Google account). Consequently:

- tell the visitor on the registration form and in account settings that the account is shared;
- account deletion in either app deletes the data of **both** (point 7);
- a token obtained in one app is a valid token for the same account in the other, but each frontend stores its own token (they live on different origins), so each app has its own sign-in and its own stale-token handling.

---

# 9. Google Sign-In Flow

Google Sign-In is a full-page redirect flow, not a popup and not an API call from JavaScript. Start it in the same tab that will receive the result (the nonce below lives in that tab's `sessionStorage`).

1. **Create a nonce (mandatory, see point 10).** Generate a random nonce, store it in `sessionStorage`, and put it into your callback page URL as `?n=<nonce>`.
2. **Start.** Link or navigate the browser (a plain `<a href>` or `window.location`) to:

   ```text
   https://platform-api.nick-burdo.workers.dev/auth/google?redirect=<your own callback page URL, including ?n=<nonce>>
   ```

   `redirect` must be a page of **your** frontend whose origin is on the API's allowlist (see `connecting-a-frontend.md`). URL-encode it. If it is missing or not allowed the API answers `400` with the message `redirect must be an allowed frontend URL` and does **not** redirect — that is a configuration bug, not something to show to visitors.
3. **Google.** The visitor consents on Google's screen. No email is requested.
4. **Return.** The API redirects the browser to `<redirect>#...` — your callback page URL, with its `?n=` intact, and the result in the URL **fragment**.
5. **Read the fragment** on your callback page:

   | Fragment | Meaning |
   |----------|---------|
   | `#token=<jwt>` | Success — the visitor is signed in (accept it only if the nonce matches, point 10). |
   | `#link_ticket=<ticket>` | Linking only: Google consent completed, nothing linked yet — finish with `POST /auth/google/link/complete` (see "Optional: Linking"; nonce rule applies). |
   | `#error=access_denied` | The visitor pressed "Cancel" on Google's screen. |
   | `#error=google_failed` | Google sign-in failed for any other reason. |

6. **Clean the address bar immediately.** After reading the fragment (and `?n`), remove both from the URL so that the token does not stay in the address bar, browser history or a bookmark:

   ```js
   history.replaceState(null, '', location.pathname);
   ```

7. **Check the nonce** (point 10). On a match, **store the token** (on `#token=`) the same way as a token from `POST /auth/login`, then load the user with `GET /auth/me` and route to the app. On a mismatch, discard the token.
8. **Map `#error` codes to messages**, for example:
   - `access_denied` → "Sign-in was cancelled." (no alarm — the visitor chose this);
   - `google_failed` → "Google sign-in failed. Please try again.";
   - any unknown code → the generic failure message.

The first Google sign-in creates an account automatically with a generated username (for example `user-3fa9c1`) and no password. Repeat sign-ins find the same account. Tokens from Google and from password login are identical — the rest of the app does not need to know which was used.

If the callback page is reached with an invalid or expired state, the API answers with `401` JSON (`Invalid or expired state`) on its own address instead of redirecting; this happens when the visitor waited more than 10 minutes on Google's screen, the link was tampered with, or an API update was deployed while the visitor was on Google's screen. Offering "try again" is enough.

---

# 10. Callback Nonce: Mandatory for Sign-In and Linking

**Every frontend must implement this rule on every Google callback page — sign-in and linking alike.**

Why: the API's signed `state` proves only that the API started the flow, not that **this browser** started it. Anyone can start a Google flow and send the resulting URL to someone else; without this rule, a visitor could be silently signed into somebody else's account (login CSRF), or a link ticket could arrive in a tab that never asked for one. The nonce binds the result to the tab that started the flow.

The rule:

1. **Before** navigating to `GET /auth/google` or calling `POST /auth/google/link`, create a random nonce, store it in `sessionStorage`, and put it into the `redirect` URL as the query parameter `n`.
2. On the callback page, accept `#token=` or `#link_ticket=` **only if** the `n` query parameter equals the stored nonce.
3. **Delete** the stored nonce right after reading it, match or not (a nonce is single-use).
4. On a mismatch, or if no nonce is stored: **discard** the token/ticket, **keep the existing session** unchanged (do not sign out, do not replace the stored token), and show at most a neutral "Sign-in could not be completed, please try again".

`#error=` fragments carry no credentials; showing their message does not depend on the nonce (but the nonce is still deleted).

```js
const NONCE_KEY = 'googleNonce';

// 1. Before starting sign-in or linking.
function callbackUrlWithNonce() {
  const nonce = crypto.randomUUID();
  sessionStorage.setItem(NONCE_KEY, nonce);
  const url = new URL('/auth/callback', location.origin);
  url.searchParams.set('n', nonce);
  return url.href;
}

// Sign-in:
location.href = `${API}/auth/google?redirect=${encodeURIComponent(callbackUrlWithNonce())}`;
// Linking: POST /auth/google/link with { redirect: callbackUrlWithNonce() }, then go to data.url.

// 2-4. On the callback page (/auth/callback).
const result = new URLSearchParams(location.hash.slice(1));
const n = new URLSearchParams(location.search).get('n');
history.replaceState(null, '', location.pathname); // drop the fragment and ?n

const expected = sessionStorage.getItem(NONCE_KEY);
sessionStorage.removeItem(NONCE_KEY); // single-use, match or not
const nonceOk = expected !== null && n === expected;

if (result.has('error')) {
  showGoogleError(result.get('error')); // point 9, step 8
} else if (!nonceOk) {
  // Not started by this tab: ignore the token/ticket, keep the current session.
  showNotice('Sign-in could not be completed, please try again.');
} else if (result.has('token')) {
  saveToken(result.get('token')); // then GET /auth/me
} else if (result.has('link_ticket')) {
  await completeGoogleLink(result.get('link_ticket')); // see "Optional: Linking"
}
```

`URLSearchParams` URL-decodes the values, so `result.get('token')` and `result.get('link_ticket')` are ready to use as they are.

---

# Optional: Linking Google and Setting a Password

Both flows are optional capabilities of the API. A frontend may expose them, for example in an account-settings page, or leave them out.

The user object from `GET /auth/me` contains `hasPassword` (boolean). It tells the frontend which flow applies: `hasPassword: false` is a Google-only account.

## Link Google to a Password Account

For a signed-in account that registered with a password and wants to add Google as a second way to sign in. Linking is **two-step**: Google's consent alone never links anything; the signed-in visitor confirms with their own token afterwards.

1. Create a nonce as in point 10 and send `POST /auth/google/link` with the token and the body `{ "redirect": "<your own callback page URL with ?n=<nonce>>" }`. A browser navigation cannot carry the `Authorization` header, which is why this is a `POST` that returns the URL instead of redirecting.
2. The response is `{ "data": { "url": "https://accounts.google.com/..." } }`. **Navigate the browser to that `url`** (same tab).
3. After consent the browser returns to your callback page with a fragment:
   - `#link_ticket=<ticket>` — Google consent done, **nothing is linked yet**; go to step 5 (after the nonce check);
   - `#error=access_denied` / `#error=google_failed` — as in point 9.
4. Clean the fragment (`history.replaceState`) and check the nonce as in points 9 and 10. On a nonce mismatch discard the ticket and stop.
5. Within **5 minutes**, send `POST /auth/google/link/complete` with the **same signed-in account's token** and the body `{ "ticket": "<ticket>" }`. On `200` the response is the updated user — show "Google account linked".

Refusals at step 1:

| Status | Message | Meaning |
|--------|---------|---------|
| `409` | `Google account is already linked` | This account already has Google linked — hide or disable the "Link Google" action (there is no unlinking). |
| `400` | `redirect must be an allowed frontend URL` | Configuration bug (redirect not on the allowlist). |
| `401` | `Authentication required` / `Invalid or expired token` | Handle as in points 1 and 5. |

Refusals at step 5 (nothing is changed in any of them):

| Status | Message | Meaning |
|--------|---------|---------|
| `409` | `Google account is already used by another user` | That Google account already belongs to a different account (accounts are never merged); show a message and leave the current account unchanged. |
| `409` | `Google account is already linked` | This account got a Google account linked meanwhile (for example in another tab). |
| `400` | `Invalid or expired link ticket` | The ticket is older than 5 minutes, damaged, or was issued for a different account than the one signed in now (for example, the visitor switched accounts in between). Offer "try again" from step 1. |
| `401` | `Authentication required` / `Invalid or expired token` | Handle as in points 1 and 5. |

## Set a Password on a Google-Only Account

For a signed-in account with `hasPassword: false` that wants a username and password too.

Send `POST /auth/me/password` with the token and the body `{ "password": "<8-128 chars>", "username": "<optional>" }`. The optional `username` replaces the generated one (same rules as registration). On `200` the response is the updated user (`hasPassword: true`). Apply the same lost-password warning as in point 2 to the form.

| Status | Message | Meaning |
|--------|---------|---------|
| `409` | `Password is already set` | The account already has a password. There is no password change — hide the form when `hasPassword` is `true`. |
| `409` | `Username is already taken` | The requested username is taken; nothing was changed. Let the visitor choose another. |
| `400` | validation error | Password length or username format; show the field messages. |
| `401` | `Authentication required` / `Invalid or expired token` | Handle as in points 1 and 5. |

---

# Quick Reference: Messages and Status Codes

| Situation | Status | Message / signal |
|-----------|--------|------------------|
| Guest tries to write, or calls a user-only auth endpoint | `401` | `Authentication required` |
| Token invalid, expired or account deleted | `401` | `Invalid or expired token` |
| Wrong login | `401` | `Invalid credentials` |
| Username taken (register, set password) | `409` | `Username is already taken` |
| Google already linked to this account (link start or complete) | `409` | `Google account is already linked` |
| Google account belongs to another user (link complete) | `409` | `Google account is already used by another user` |
| Link ticket invalid, expired or for another account | `400` | `Invalid or expired link ticket` |
| Account already has a password | `409` | `Password is already set` |
| `redirect` not allowed | `400` | `redirect must be an allowed frontend URL` |
| Invalid or expired Google `state` | `401` | `Invalid or expired state` |
| Google result in the fragment | `302` | `#token=`, `#link_ticket=`, `#error=access_denied`, `#error=google_failed` (accept `#token`/`#link_ticket` only with a matching nonce, point 10) |

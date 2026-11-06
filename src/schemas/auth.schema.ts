import { z } from 'zod';

// Username: ASCII letters, digits, underscore, hyphen; 3-32 chars. Uniqueness
// is case-insensitive and enforced by the DB (v4-plan.md Decision 5).
const USERNAME_MESSAGE = 'username must be 3-32 characters: letters, digits, "_" or "-"';

const usernameField = z
  .string('username is required')
  .min(3, USERNAME_MESSAGE)
  .max(32, USERNAME_MESSAGE)
  .regex(/^[A-Za-z0-9_-]+$/, USERNAME_MESSAGE);

const passwordField = z
  .string('password is required')
  .min(8, 'password must be at least 8 characters')
  .max(128, 'password must be at most 128 characters');

export const registerSchema = z
  .object({ username: usernameField, password: passwordField })
  .strict();

// POST /auth/me/password: a Google-only account sets its first password and
// may pick a username at the same time (Decision 21).
export const setPasswordSchema = z
  .object({ password: passwordField, username: usernameField.optional() })
  .strict();

// POST /auth/google/link: the frontend URL to return to (allow-list checked in
// the route, which needs the env).
export const googleLinkBodySchema = z
  .object({ redirect: z.string('redirect is required') })
  .strict();

// POST /auth/google/link/complete: the link ticket from the callback's
// `#link_ticket=` fragment (Decision 23). Its validity is checked in the route
// (needs the secret), so an empty or garbage ticket gets the documented 400
// message, not a schema error.
export const googleLinkCompleteBodySchema = z
  .object({ ticket: z.string('ticket is required') })
  .strict();

// No format rule on the login username: a malformed username simply fails to
// match and yields the uniform 401. The password keeps the register upper
// bound (Decision 24), so an oversized body is rejected before hashing.
// Strict per V1 Decision #32.
export const loginSchema = z
  .object({
    username: z.string('username is required').min(1, 'username is required'),
    password: z
      .string('password is required')
      .min(1, 'password is required')
      .max(128, 'password must be at most 128 characters'),
  })
  .strict();

// GET /auth/google's query: where to send the token afterwards. Allow-list
// membership (and presence) is checked in the route (needs the env), so a
// missing or empty value gets the documented 400 message, not a schema error.
export const googleStartQuerySchema = z.object({
  redirect: z.string().optional(),
});

// GET /auth/google/callback's query params, forwarded by Google. Not
// `.strict()` — Google may append extra params (e.g. `scope`, `authuser`)
// we don't care about, and unknown query params are ignored project-wide
// (api.md), unlike unknown body keys. `code` is absent when the user cancels
// on the consent screen (`error=access_denied`); a missing `state` is
// treated as an invalid state (401) in resolveGoogleCallback.
export const googleCallbackQuerySchema = z.object({
  state: z.string().optional(),
  code: z.string().optional(),
  error: z.string().optional(),
});

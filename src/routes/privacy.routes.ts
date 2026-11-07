import { Hono } from 'hono';
import type { AppEnv } from '../app';

// GET /privacy — the public privacy policy linked from the Google OAuth
// consent screen (Google Auth Platform → Branding). A static page, not an
// API endpoint, so it is not part of the OpenAPI document (v4.1-plan.md).
const REPO_ISSUES_URL = 'https://github.com/nickburdo/platform-api/issues';
const CLOUDFLARE_PRIVACY_URL = 'https://www.cloudflare.com/privacypolicy/';

const privacyPage = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Privacy Policy — Platform API</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; line-height: 1.6; max-width: 720px; margin: 0 auto; padding: 32px 16px 64px; }
  h1 { font-size: 1.8rem; margin-bottom: 0.25rem; }
  h2 { font-size: 1.15rem; margin-top: 2rem; }
  .muted { opacity: 0.7; margin-top: 0; }
  code { font-size: 0.95em; }
</style>
</head>
<body>
<h1>Privacy Policy</h1>
<p class="muted">Platform API · Effective date: 7 November 2026</p>

<h2>What this service is</h2>
<p>Platform API is a portfolio and demo project that powers two web applications: a Job Tracker and a Health Monitor. Visitors without an account see shared demo data only; registered users see and manage only their own records.</p>

<h2>What we store</h2>
<ul>
  <li><strong>Your username.</strong></li>
  <li><strong>A hash of your password</strong>, if you set one. The password itself is never stored.</li>
  <li><strong>Your Google account identifier</strong>, if you sign in with Google. This is an opaque ID issued by Google; we do not receive or store your email address, name or profile photo.</li>
  <li><strong>The records you create</strong> — job applications, and health entries such as glucose, blood pressure, weight and symptoms.</li>
</ul>

<h2>What we do not collect</h2>
<p>No email address, real name, profile photo, contacts or location. The service sets no cookies and uses no advertising or analytics trackers.</p>

<h2>Hosting and technical logs</h2>
<p>The service runs on Cloudflare. To deliver it, Cloudflare processes each request, including your IP address, under the <a href="${CLOUDFLARE_PRIVACY_URL}">Cloudflare Privacy Policy</a>. Our own request logs record the method, path, response status, timing and a request ID, and are used only to operate and debug the service.</p>

<h2>Sharing</h2>
<p>Your data is not sold or shared with anyone. When you sign in with Google, Google only learns that you signed in to this application.</p>

<h2>Health data</h2>
<p>The Health Monitor is a demo, not a medical service, and its data must not be relied on for medical decisions. You decide what, if anything, to enter.</p>

<h2>Deleting your data</h2>
<p>You can delete your account at any time with <code>DELETE /auth/me</code>. Your account and all of your records are removed immediately and permanently.</p>

<h2>Changes and contact</h2>
<p>If this policy changes, the updated version will be published on this page with a new effective date. Questions can be raised via <a href="${REPO_ISSUES_URL}">GitHub issues</a> of the project repository.</p>
</body>
</html>
`;

export const privacyRoutes = new Hono<AppEnv>().get('/privacy', (c) => c.html(privacyPage));

// Allow-list for the frontend URL the Google callback redirects back to
// (v4-plan.md Decision 12). This is the open-redirect guard: the token is
// delivered in the redirect's fragment, so a redirect to any other origin
// would hand the token to that origin.

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1']);

// Parses the comma-separated ALLOWED_FRONTEND_ORIGINS var into normalized
// origins (via `new URL`). Entries that are not valid http(s) URLs are dropped.
export function parseAllowedOrigins(raw: string): string[] {
  const origins: string[] = [];
  for (const entry of raw.split(',')) {
    const trimmed = entry.trim();
    if (trimmed === '') {
      continue;
    }
    try {
      const url = new URL(trimmed);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        origins.push(url.origin);
      }
    } catch {
      // Ignore malformed entries.
    }
  }
  return origins;
}

// Any whitespace or control character (including a leading/trailing space).
function hasWhitespaceOrControl(value: string): boolean {
  for (const ch of value) {
    const code = ch.codePointAt(0)!;
    if (code <= 0x20 || code === 0x7f || /\s/.test(ch)) {
      return true;
    }
  }
  return false;
}

// True only for an absolute http(s) URL without a fragment whose origin is
// exactly an allowed origin, or whose hostname is localhost/127.0.0.1 (any
// port, either scheme). Comparison is on the parsed `url.origin`, never on a
// string prefix, so look-alike hosts and userinfo tricks do not match.
export function isAllowedRedirect(redirect: string, allowedOrigins: string[]): boolean {
  // `new URL` silently strips tabs/newlines and surrounding spaces, so such
  // input would pass the checks below yet break the Location header later.
  if (redirect.includes('#') || hasWhitespaceOrControl(redirect)) {
    return false;
  }
  let url: URL;
  try {
    url = new URL(redirect);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return false;
  }
  if (url.username !== '' || url.password !== '') {
    return false;
  }
  return allowedOrigins.includes(url.origin) || LOCAL_HOSTNAMES.has(url.hostname);
}

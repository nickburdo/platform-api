import { describe, expect, it } from 'vitest';
import { isAllowedRedirect, parseAllowedOrigins } from './frontend-origins';

const ALLOWED = parseAllowedOrigins(
  'https://health-monitor-new.pages.dev, https://job-tracker-new.pages.dev/',
);

describe('parseAllowedOrigins', () => {
  it('trims entries and normalizes them to origins', () => {
    expect(ALLOWED).toEqual([
      'https://health-monitor-new.pages.dev',
      'https://job-tracker-new.pages.dev',
    ]);
  });

  it('drops empty, malformed and non-http entries', () => {
    expect(parseAllowedOrigins(',, not-a-url, ftp://x.com ,https://ok.dev')).toEqual([
      'https://ok.dev',
    ]);
    expect(parseAllowedOrigins('')).toEqual([]);
  });
});

describe('isAllowedRedirect', () => {
  it.each([
    'https://health-monitor-new.pages.dev/auth/callback',
    'https://job-tracker-new.pages.dev/auth/callback',
    'https://job-tracker-new.pages.dev',
    'http://localhost:5173/cb',
    'https://localhost:8443/cb',
    'http://127.0.0.1:3000/',
  ])('allows %s', (redirect) => {
    expect(isAllowedRedirect(redirect, ALLOWED)).toBe(true);
  });

  it.each([
    'https://job-tracker-new.pages.dev.evil.com/x',
    'https://evil.com/?r=https://job-tracker-new.pages.dev',
    '//evil.com',
    'javascript:alert(1)',
    'http://job-tracker-new.pages.dev/x',
    'https://job-tracker-new.pages.dev/x#frag',
    'https://job-tracker-new.pages.dev@evil.com/x',
    'https://job-tracker-new.pages.dev:8443/x',
    'https://localhost.evil.com/x',
    'http://localhost@evil.com/',
    'data:text/html,hi',
    'ftp://localhost/',
    '/relative/path',
    '',
  ])('rejects %s', (redirect) => {
    expect(isAllowedRedirect(redirect, ALLOWED)).toBe(false);
  });
});

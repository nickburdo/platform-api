import { describe, expect, it } from 'vitest';
import { loginSchema } from './auth.schema';

describe('loginSchema', () => {
  it('accepts a valid payload', () => {
    expect(loginSchema.safeParse({ email: 'admin@example.com', password: 'x' }).success).toBe(
      true,
    );
  });

  it('rejects a malformed email', () => {
    expect(loginSchema.safeParse({ email: 'not-an-email', password: 'x' }).success).toBe(false);
  });

  it('rejects an empty password', () => {
    expect(loginSchema.safeParse({ email: 'admin@example.com', password: '' }).success).toBe(
      false,
    );
  });

  it('rejects missing fields', () => {
    expect(loginSchema.safeParse({}).success).toBe(false);
  });

  it('rejects unknown keys (strict)', () => {
    expect(
      loginSchema.safeParse({ email: 'admin@example.com', password: 'x', role: 'ADMIN' }).success,
    ).toBe(false);
  });
});

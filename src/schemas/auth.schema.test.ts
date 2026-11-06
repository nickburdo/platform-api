import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema } from './auth.schema';

describe('registerSchema', () => {
  const password = 'password1';

  it('accepts a valid username and an 8-char password', () => {
    expect(registerSchema.safeParse({ username: 'Nick_01-x', password }).success).toBe(true);
  });

  it('accepts boundary lengths 3 and 32', () => {
    expect(registerSchema.safeParse({ username: 'abc', password }).success).toBe(true);
    expect(registerSchema.safeParse({ username: 'a'.repeat(32), password }).success).toBe(true);
  });

  it.each(['ab', 'a'.repeat(33), 'nick!', 'ni ck', 'nikö'])('rejects username %s', (username) => {
    expect(registerSchema.safeParse({ username, password }).success).toBe(false);
  });

  it('rejects passwords outside 8-128 chars', () => {
    expect(registerSchema.safeParse({ username: 'nick', password: '1234567' }).success).toBe(false);
    expect(
      registerSchema.safeParse({ username: 'nick', password: 'x'.repeat(129) }).success,
    ).toBe(false);
    expect(
      registerSchema.safeParse({ username: 'nick', password: 'x'.repeat(128) }).success,
    ).toBe(true);
  });

  it('rejects unknown keys (strict)', () => {
    expect(registerSchema.safeParse({ username: 'nick', password, role: 'ADMIN' }).success).toBe(
      false,
    );
  });

  it('gives human messages for missing keys', () => {
    const result = registerSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('username is required');
      expect(messages).toContain('password is required');
    }
  });
});

describe('loginSchema', () => {
  it('accepts any non-empty username and password', () => {
    expect(loginSchema.safeParse({ username: 'x!', password: 'x' }).success).toBe(true);
  });

  it('rejects empty fields and missing fields', () => {
    expect(loginSchema.safeParse({ username: '', password: 'x' }).success).toBe(false);
    expect(loginSchema.safeParse({ username: 'nick', password: '' }).success).toBe(false);
    expect(loginSchema.safeParse({}).success).toBe(false);
  });

  it('rejects unknown keys (strict)', () => {
    expect(loginSchema.safeParse({ username: 'nick', password: 'x', role: 'ADMIN' }).success).toBe(
      false,
    );
  });
});

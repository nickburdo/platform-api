import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { loginSchema } from './auth.schema';
import { createBloodPressureSchema } from './blood-pressure.schema';
import { idParamSchema } from './common.schema';
import { createGlucoseSchema } from './glucose.schema';
import { createJobApplicationSchema } from './job-applications.schema';
import { createSymptomSchema } from './symptom.schema';
import { createWeightSchema } from './weight.schema';

// Section 4 (v3-plan.md) replaced Zod v4's default technical phrasing
// ("Too small: expected number to be >0", "Invalid input: expected int,
// received number") with human-readable, field-specific messages — applied
// by hand, field by field, with nothing else enforcing it (a real gap
// surfaced during that section's own code review). This is a generic
// backstop: parsing an empty body against every "create" schema exercises
// every one of its required fields at once, so a future field added without
// a custom message fails this test automatically, with no need to know its
// name in advance. `.email()`/`.url()`/`.datetime()`/`.enum()` defaults are
// deliberately NOT flagged — Section 4 decided those are already natural
// English and left them as Zod defaults on purpose.
const RAW_ZOD_JARGON = [/^Too small/, /^Too big/, /^Invalid input: expected/];

function assertNoRawJargon(schema: z.ZodType, label: string) {
  const result = schema.safeParse({});
  if (result.success) {
    return; // no required fields to violate — nothing to check
  }
  const { fieldErrors } = z.flattenError(result.error as z.core.$ZodError<Record<string, unknown>>);
  for (const [field, messages] of Object.entries(fieldErrors)) {
    for (const message of messages ?? []) {
      const isJargon = RAW_ZOD_JARGON.some((pattern) => pattern.test(message));
      expect(
        isJargon,
        `${label}.${field}: "${message}" looks like a raw Zod default, not a custom message`,
      ).toBe(false);
    }
  }
}

describe('no raw Zod validation jargon leaks through on an empty body', () => {
  it('createJobApplicationSchema', () => {
    assertNoRawJargon(createJobApplicationSchema, 'createJobApplicationSchema');
  });

  it('createGlucoseSchema', () => {
    assertNoRawJargon(createGlucoseSchema, 'createGlucoseSchema');
  });

  it('createBloodPressureSchema', () => {
    assertNoRawJargon(createBloodPressureSchema, 'createBloodPressureSchema');
  });

  it('createWeightSchema', () => {
    assertNoRawJargon(createWeightSchema, 'createWeightSchema');
  });

  it('createSymptomSchema', () => {
    assertNoRawJargon(createSymptomSchema, 'createSymptomSchema');
  });

  it('loginSchema', () => {
    assertNoRawJargon(loginSchema, 'loginSchema');
  });

  it('idParamSchema', () => {
    assertNoRawJargon(idParamSchema, 'idParamSchema');
  });
});

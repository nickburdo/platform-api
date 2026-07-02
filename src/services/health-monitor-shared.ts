// Shared by all four Health Monitor services (glucose, blood-pressure,
// weight, symptom) — deduplicates the "stamp server-managed fields on
// create/update" logic that was previously copy-pasted across all four.

// `isDemo` comes from the caller's identity scope (V2, ADR-012): guests
// create demo records, the admin creates real ones. Never client-supplied.
export function withCreateStamps<T extends object>(id: string, input: T, isDemo: boolean) {
  const now = new Date().toISOString();
  return {
    id,
    ...input,
    isDemo,
    ignored: false as const,
    reason: '',
    createdAt: now,
    updatedAt: now,
  };
}

export function withUpdateStamp<T extends object>(input: T) {
  return { ...input, updatedAt: new Date().toISOString() };
}

// Defensive runtime guard for Decision #26 ("reason required when
// ignored: true"). The Zod update schemas already enforce this at the HTTP
// boundary, but nothing yet guarantees every caller of these services goes
// through Zod first (Section 7/Routes isn't built yet) — this makes the
// invariant hold regardless of how the service is invoked.
export function assertReasonRequiredWhenIgnored(input: {
  ignored?: boolean;
  reason?: string;
}): void {
  if (input.ignored && !(input.reason && input.reason.trim().length > 0)) {
    throw new Error('reason is required when ignored is true');
  }
}

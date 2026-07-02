// Salted PBKDF2 password hashing via WebCrypto (v2-plan.md Decisions #6/#12).
// Native in both workerd (runtime login verification) and Node >= 18 (the
// scripts/create-admin.ts bootstrap) — the exact same code runs in both.
//
// Stored format is self-describing so parameters can be raised later without
// re-hashing existing rows: pbkdf2-sha256:<iterations>:<salt-b64>:<hash-b64>

const ALGORITHM = 'pbkdf2-sha256';
const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function derive(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    keyMaterial,
    HASH_BYTES * 8,
  );
  return new Uint8Array(bits);
}

// XOR-accumulator comparison: runs over the full length regardless of where
// the first mismatch is, so timing does not leak the matching prefix.
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, ITERATIONS);
  return `${ALGORITHM}:${ITERATIONS}:${toBase64(salt)}:${toBase64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, iterationsRaw, saltB64, hashB64, ...rest] = stored.split(':');
  if (algorithm !== ALGORITHM || saltB64 === undefined || hashB64 === undefined || rest.length > 0) {
    return false;
  }
  const iterations = Number(iterationsRaw);
  if (!Number.isInteger(iterations) || iterations < 1) {
    return false;
  }
  let salt: Uint8Array<ArrayBuffer>;
  let expected: Uint8Array<ArrayBuffer>;
  try {
    salt = fromBase64(saltB64);
    expected = fromBase64(hashB64);
  } catch {
    return false;
  }
  const actual = await derive(password, salt, iterations);
  return constantTimeEqual(actual, expected);
}

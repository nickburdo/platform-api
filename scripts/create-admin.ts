// One-time admin bootstrap / credential rotation (v2-plan.md Decision #8).
//
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx scripts/create-admin.ts
//
// - validates inputs, normalizes the email to lowercase
// - hashes the password with the same PBKDF2 module the runtime uses
// - upserts the single admin row in the cloud auth-db via wrangler
//   (re-running updates the existing row; a second admin is never created)
// - the plaintext password is never printed or written to disk; only the
//   hash touches a transient SQL file, which is deleted afterwards

import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hashPassword } from '../src/utils/password';

const MIN_PASSWORD_LENGTH = 12;
const EMAIL_PATTERN = /^[^\s@']+@[^\s@']+\.[^\s@']+$/;

function fail(message: string): never {
  console.error(`create-admin: ${message}`);
  process.exit(1);
}

// Standard SQL string-literal escaping (doubles embedded single quotes).
// EMAIL_PATTERN already rejects quotes in practice, but every value
// interpolated into the SQL string is escaped regardless — safety should be
// structural, not incidental to how strictly upstream validation happens to
// be written today.
function sqlStringLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function runWrangler(args: string): string {
  return execSync(`npx wrangler ${args}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;

if (!email || !EMAIL_PATTERN.test(email)) {
  fail('set ADMIN_EMAIL to a valid email address (quotes and whitespace are not allowed)');
}
if (!password || password.length < MIN_PASSWORD_LENGTH) {
  fail(`set ADMIN_PASSWORD to at least ${MIN_PASSWORD_LENGTH} characters`);
}

const passwordHash = await hashPassword(password);
const now = new Date().toISOString();

// The table only ever holds one row (ADR-012) — look it up to decide
// between INSERT (first run) and UPDATE (credential rotation).
const existingRaw = runWrangler(
  'd1 execute auth-db --remote --json --command "SELECT id FROM users LIMIT 1"',
);
const existingId: string | undefined = (
  JSON.parse(existingRaw) as { results: { id: string }[] }[]
)[0]?.results[0]?.id;

const sql = existingId
  ? `UPDATE users SET email = ${sqlStringLiteral(email)}, password_hash = ${sqlStringLiteral(passwordHash)}, updated_at = ${sqlStringLiteral(now)} WHERE id = ${sqlStringLiteral(existingId)};`
  : `INSERT INTO users (id, email, password_hash, role, created_at, updated_at) VALUES (${sqlStringLiteral(crypto.randomUUID())}, ${sqlStringLiteral(email)}, ${sqlStringLiteral(passwordHash)}, 'ADMIN', ${sqlStringLiteral(now)}, ${sqlStringLiteral(now)});`;

const tempDir = mkdtempSync(join(tmpdir(), 'create-admin-'));
const tempFile = join(tempDir, 'admin.sql');
try {
  writeFileSync(tempFile, sql, 'utf8');
  runWrangler(`d1 execute auth-db --remote --file="${tempFile}"`);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

console.log(
  existingId
    ? `Admin credentials rotated for ${email}.`
    : `Admin account created for ${email}.`,
);

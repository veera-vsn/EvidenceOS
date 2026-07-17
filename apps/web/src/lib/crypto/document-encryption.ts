/**
 * Decrypt-only counterpart to the backend's `app/core/encryption.py`.
 *
 * `extraction_results.extracted_value` is encrypted at the application
 * layer before the FastAPI worker writes it (see that module's docstring
 * for the full rationale: defence-in-depth on top of Supabase's disk-level
 * encryption at rest, using a single shared AES-256-GCM key rather than a
 * KMS integration, which is a deliberate trade-off for a pre-revenue
 * product). The Review and Pipeline pages read this column directly from
 * Supabase in Server Components, so they need to decrypt it themselves --
 * there is no backend round trip in that read path to do it for them.
 *
 * This module only decrypts. The frontend never writes to
 * `extraction_results` or `document_text` -- only the pipeline worker does.
 *
 * Server-only: uses Node's built-in `crypto`, which does not exist in the
 * browser. Importing this from a Client Component fails the build rather
 * than silently leaking the key -- a deliberate, load-bearing property of
 * keeping this out of `lib/env.ts`'s shared `env` object (see that file).
 */

import { createDecipheriv } from "node:crypto";
import { requireEnv } from "@/lib/env";

const PREFIX = "enc:v1:";
const NONCE_LEN = 12; // 96-bit nonce -- matches app/core/encryption.py.
const TAG_LEN = 16; // AES-GCM authentication tag, appended after ciphertext.

function getKey(): Buffer {
  const key = Buffer.from(requireEnv("DOCUMENT_ENCRYPTION_KEY"), "base64");
  if (key.length !== 32) {
    throw new Error(
      "DOCUMENT_ENCRYPTION_KEY must decode to exactly 32 bytes (256 bits).",
    );
  }
  return key;
}

/**
 * Decrypt a value written by `encrypt_text()` on the backend.
 *
 * Values without the version prefix are historical rows written before
 * encryption existed -- returned unchanged rather than thrown on, so old
 * documents stay readable until their pipeline re-runs and re-encrypts
 * them (same precedent as the backend's decrypt_text()).
 */
export function decryptText(value: string | null): string | null {
  if (value === null) return null;
  if (!value.startsWith(PREFIX)) return value;

  const raw = Buffer.from(value.slice(PREFIX.length), "base64");
  const nonce = raw.subarray(0, NONCE_LEN);
  const rest = raw.subarray(NONCE_LEN);
  const tag = rest.subarray(rest.length - TAG_LEN);
  const ciphertext = rest.subarray(0, rest.length - TAG_LEN);

  const decipher = createDecipheriv("aes-256-gcm", getKey(), nonce);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf-8");
}

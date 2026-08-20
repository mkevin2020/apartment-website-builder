import crypto from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
// Application-level encryption for the few columns that deserve more than
// disk encryption.
//
// Supabase already encrypts the database volume at rest, which covers "someone
// steals the disk". It does NOT cover "someone gets read access to the table" —
// a leaked service key, an over-broad policy, or a support engineer browsing
// rows. National ID numbers are the field in this app where that distinction
// matters, so they get encrypted with a key the database itself never holds.
//
// AES-256-GCM: authenticated, so a tampered ciphertext fails to decrypt rather
// than silently returning wrong plaintext.
//
// Stored format:  v1:<iv-base64>:<authTag-base64>:<ciphertext-base64>
// The v1 prefix lets the key be rotated later without guessing at old rows.
// ─────────────────────────────────────────────────────────────────────────────

const PREFIX = "v1";

function encryptionKey(): Buffer {
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "FIELD_ENCRYPTION_KEY is not set. Generate one with: openssl rand -base64 32",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      "FIELD_ENCRYPTION_KEY must be exactly 32 bytes, base64-encoded. Generate one with: openssl rand -base64 32",
    );
  }
  return key;
}

/** True when a stored value is already ciphertext produced by this module. */
export function isEncrypted(value: unknown): boolean {
  return typeof value === "string" && value.startsWith(`${PREFIX}:`);
}

export function encryptField(plaintext: string): string {
  // A fresh random IV per value — reusing an IV under GCM is catastrophic.
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    PREFIX,
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decryptField(stored: string): string {
  // Rows written before encryption was introduced are still plaintext; return
  // them unchanged so reads keep working during the backfill.
  if (!isEncrypted(stored)) return stored;

  const [, ivB64, tagB64, dataB64] = stored.split(":");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** Encrypt if configured; leave the value alone if no key is set yet. */
export function encryptFieldIfConfigured(plaintext: string): string {
  if (!process.env.FIELD_ENCRYPTION_KEY) return plaintext;
  return encryptField(plaintext);
}

/** Decrypt if it looks encrypted and a key is available. */
export function decryptFieldSafe(stored: string | null | undefined): string | null {
  if (stored == null) return null;
  if (!isEncrypted(stored)) return stored;
  try {
    return decryptField(stored);
  } catch {
    // Wrong or missing key — never leak ciphertext into the UI.
    return null;
  }
}

/**
 * Mask a value for display where the full number is not actually needed
 * (staff lists, audit views): "1199780012345678" -> "••••••••••••5678".
 */
export function maskIdNumber(value: string | null | undefined): string {
  if (!value) return "—";
  const tail = value.slice(-4);
  return `${"•".repeat(Math.max(value.length - 4, 4))}${tail}`;
}

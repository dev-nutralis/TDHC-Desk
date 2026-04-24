import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Supports two key formats:
// - 64-char hex string (32 bytes, same format as crm luka)
// - Any other string (padded/truncated to 32 bytes)
function getKey(): Buffer {
  const raw = process.env.SIP_ENCRYPTION_KEY ?? "";
  if (!raw) throw new Error("SIP_ENCRYPTION_KEY is not set");
  if (raw.length === 64 && /^[0-9a-f]+$/i.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  return Buffer.alloc(32, raw.padEnd(32, "0").slice(0, 32));
}

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;

export function encryptSipPassword(plain: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSipPassword(blob: string): string {
  const key = getKey();
  const [ivHex, encHex] = blob.split(":");
  if (!ivHex || !encHex) throw new Error("Invalid encrypted SIP password format");
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

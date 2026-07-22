import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

type EncryptedCredential = { encryptedKey: string; iv: string; authTag: string };

function encryptionKey() {
  const encoded = process.env.AI_CREDENTIAL_ENCRYPTION_KEY;
  if (!encoded) throw new Error("AI credential encryption is not configured.");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("AI credential encryption key must be 32 bytes.");
  return key;
}

export function encryptCredential(value: string): EncryptedCredential {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return { encryptedKey: encrypted.toString("base64"), iv: iv.toString("base64"), authTag: cipher.getAuthTag().toString("base64") };
}

export function decryptCredential(value: { encrypted_key: string; iv: string; auth_tag: string }) {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(value.iv, "base64"));
  decipher.setAuthTag(Buffer.from(value.auth_tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(value.encrypted_key, "base64")), decipher.final()]).toString("utf8");
}

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const dataDir = path.join(process.cwd(), "data");
const keyPath = path.join(dataDir, ".master-key");

function masterKey() {
  fs.mkdirSync(dataDir, { recursive: true });
  const configured = process.env.MODEL_ENCRYPTION_KEY;
  if (configured) return crypto.createHash("sha256").update(configured).digest();
  if (!fs.existsSync(keyPath)) fs.writeFileSync(keyPath, crypto.randomBytes(32).toString("hex"), { mode: 0o600 });
  return Buffer.from(fs.readFileSync(keyPath, "utf8").trim(), "hex");
}

export function encryptSecret(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("hex"), cipher.getAuthTag().toString("hex"), encrypted.toString("hex")].join(":");
}

export function decryptSecret(value: string) {
  const [ivHex, tagHex, contentHex] = value.split(":");
  const decipher = crypto.createDecipheriv("aes-256-gcm", masterKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(contentHex, "hex")), decipher.final()]).toString("utf8");
}

export function maskSecret(value: string) {
  if (!value) return "未设置";
  return "••••••••" + value.slice(-4);
}

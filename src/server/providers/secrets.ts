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
  try {
    const key = Buffer.from(fs.readFileSync(keyPath, "utf8").trim(), "hex");
    if (key.length !== 32) throw new Error("主密钥长度不正确");
    return key;
  } catch {
    throw new Error("本地加密主密钥不可用。请恢复 data/.master-key，或设置新的 MODEL_ENCRYPTION_KEY 后重新保存凭据。");
  }
}

export function encryptSecret(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("hex"), cipher.getAuthTag().toString("hex"), encrypted.toString("hex")].join(":");
}

export function decryptSecret(value: string) {
  try {
    const [ivHex, tagHex, contentHex] = value.split(":");
    if (!ivHex || !tagHex || !contentHex) throw new Error("ciphertext format");
    const decipher = crypto.createDecipheriv("aes-256-gcm", masterKey(), Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return Buffer.concat([decipher.update(Buffer.from(contentHex, "hex")), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("凭据无法解密。请确认 data/.master-key 或 MODEL_ENCRYPTION_KEY 没有变化。");
  }
}

export function maskSecret(value: string) {
  if (!value) return "未设置";
  return "••••••••" + value.slice(-4);
}

export function maskHeader(value: string) {
  return value ? "••••••••" + value.slice(-4) : "";
}

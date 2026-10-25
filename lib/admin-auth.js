import crypto from "crypto";

const SESSION_SECONDS = 2 * 60 * 60;

export function createAdminToken() {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret || secret.length < 16) throw new Error("Set a strong ADMIN_PASSWORD (16+ chars)");
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const nonce = crypto.randomBytes(16).toString("hex");
  const payload = `${expires}.${nonce}`;
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

export function verifyAdminCookie(req) {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret || secret.length < 16) return false;
  const raw = req.cookies?.get("admin_token")?.value || "";
  const parts = raw.split(".");
  if (parts.length !== 3) return false;
  const [expiresText, nonce, signature] = parts;
  if (!/^\d{10,12}$/.test(expiresText) || !/^[a-f0-9]{32}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const expires = Number(expiresText);
  if (!Number.isSafeInteger(expires) || expires <= Date.now() / 1000) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${expiresText}.${nonce}`).digest();
  const provided = Buffer.from(signature, "hex");
  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
}

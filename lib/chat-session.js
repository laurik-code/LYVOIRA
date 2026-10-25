import crypto from "crypto";

const COOKIE_NAME = "lyvoira_chat_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30; // 30 dní

function getSecret() {
  const secret = process.env.CHAT_SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("CHAT_SESSION_SECRET must have at least 32 characters.");
  }

  return secret;
}

export function createChatSession() {
  const userId = `user_${crypto.randomUUID()}`;
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;

  const payload = `${userId}.${expires}`;
  const signature = crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest("hex");

  return {
    userId,
    token: `${payload}.${signature}`,
    cookieName: COOKIE_NAME,
    maxAge: SESSION_SECONDS,
  };
}

export function verifyChatSession(req) {
  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [userId, expiresText, signature] = parts;

  if (!/^user_[a-f0-9-]{36}$/.test(userId)) return null;
  if (!/^\d+$/.test(expiresText)) return null;
  if (!/^[a-f0-9]{64}$/.test(signature)) return null;

  const expires = Number(expiresText);

  if (!Number.isSafeInteger(expires) || expires <= Date.now() / 1000) {
    return null;
  }

  const expected = crypto
    .createHmac("sha256", getSecret())
    .update(`${userId}.${expiresText}`)
    .digest();

  const provided = Buffer.from(signature, "hex");

  if (
    provided.length !== expected.length ||
    !crypto.timingSafeEqual(provided, expected)
  ) {
    return null;
  }

  return userId;
}
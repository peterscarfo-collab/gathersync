import crypto from "crypto";

const VERSION = "v1";
const MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

function getSecret() {
  const s = process.env.OAUTH_STATE_SECRET || process.env.SESSION_SECRET || process.env.JWT_SECRET;
  if (!s) throw new Error("Missing OAUTH_STATE_SECRET (or SESSION_SECRET/JWT_SECRET)");
  return s;
}

function b64url(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function sign(payload: string) {
  const secret = getSecret();
  return b64url(crypto.createHmac("sha256", secret).update(payload).digest());
}

export function createOAuthState() {
  const nonce = crypto.randomBytes(16).toString("hex");
  const ts = Date.now().toString();
  const payload = `${VERSION}.${ts}.${nonce}`;
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

export function verifyOAuthState(state: string | undefined | null) {
  if (!state) return { ok: false as const, reason: "missing_state" };

  const parts = state.split(".");
  if (parts.length !== 4) return { ok: false as const, reason: "bad_format" };

  const [v, ts, nonce, sig] = parts;
  if (v !== VERSION) return { ok: false as const, reason: "bad_version" };
  if (!ts || !nonce || !sig) return { ok: false as const, reason: "bad_parts" };

  const payload = `${v}.${ts}.${nonce}`;
  const expected = sign(payload);
  if (expected !== sig) return { ok: false as const, reason: "bad_sig" };

  const age = Date.now() - Number(ts);
  if (!Number.isFinite(age) || age < 0 || age > MAX_AGE_MS) {
    return { ok: false as const, reason: "expired" };
  }

  return { ok: true as const };
}

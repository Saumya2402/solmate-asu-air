import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_VERSION = 1;
const HANDOFF_FIELDS = ["asurite", "localPath", "remoteDirectory", "filename", "transferMode", "jobId"];

export function issueHandoffToken(values, secret, { ttlMs = 15 * 60_000 } = {}) {
  const payload = {
    version: TOKEN_VERSION,
    expiresAt: Date.now() + ttlMs,
    values: snapshot(values),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded, secret)}`;
}

export function verifyHandoffAcknowledgement(values, token, secret) {
  if (typeof token !== "string") throw new Error("Handoff review token is required.");
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra) throw new Error("Handoff review token is invalid.");
  const expected = Buffer.from(sign(encoded, secret));
  const supplied = Buffer.from(signature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) throw new Error("Handoff review token is invalid.");
  let payload;
  try { payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")); } catch { throw new Error("Handoff review token is invalid."); }
  if (payload.version !== TOKEN_VERSION || !Number.isFinite(payload.expiresAt) || payload.expiresAt < Date.now()) {
    throw new Error("Handoff review token has expired; review the commands again.");
  }
  if (JSON.stringify(payload.values) !== JSON.stringify(snapshot(values))) {
    throw new Error("Handoff values changed after review; review the commands again.");
  }
}

function snapshot(values = {}) {
  return Object.fromEntries(HANDOFF_FIELDS.map((field) => [field, String(values[field] || "")]));
}

function sign(encoded, secret) {
  return createHmac("sha256", secret).update(encoded).digest("base64url");
}

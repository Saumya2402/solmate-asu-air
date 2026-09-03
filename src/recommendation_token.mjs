import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_VERSION = 1;

export function issueRecommendationToken(recommendations, secret, { ttlMs = 30 * 60_000 } = {}) {
  if (!Array.isArray(recommendations) || recommendations.length === 0) return null;
  const payload = {
    version: TOKEN_VERSION,
    expiresAt: Date.now() + ttlMs,
    recommendations: Object.fromEntries(recommendations.map(({ field, value }) => [field, value])),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded, secret)}`;
}

export function verifyRecommendationConfirmations({ token, fields = [], values = {} }, secret) {
  if (!Array.isArray(fields) || fields.some((field) => typeof field !== "string")) {
    throw new Error("confirmedRecommendationFields must be an array of field names.");
  }
  if (fields.length === 0 && token == null) return;
  const payload = decodeRecommendationToken(token, secret);
  const confirmed = new Set(fields);
  for (const [field, recommendedValue] of Object.entries(payload.recommendations)) {
    if (sameValue(values[field], recommendedValue) && !confirmed.has(field)) {
      throw new Error(`AIR recommendation ${field} must be confirmed or changed.`);
    }
  }
  for (const field of fields) {
    if (!Object.hasOwn(payload.recommendations, field)) throw new Error(`No AIR recommendation exists for confirmed field ${field}.`);
    if (!sameValue(values[field], payload.recommendations[field])) throw new Error(`Confirmed AIR recommendation ${field} was edited; review it as a user-provided value.`);
  }
}

export function readRecommendationValues(token, secret) {
  return { ...decodeRecommendationToken(token, secret).recommendations };
}

function decodeRecommendationToken(token, secret) {
  if (typeof token !== "string") throw new Error("AIR recommendation confirmation token is required.");
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra) throw new Error("AIR recommendation confirmation token is invalid.");
  const expected = Buffer.from(sign(encoded, secret));
  const supplied = Buffer.from(signature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) throw new Error("AIR recommendation confirmation token is invalid.");
  let payload;
  try { payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")); } catch { throw new Error("AIR recommendation confirmation token is invalid."); }
  if (payload.version !== TOKEN_VERSION || !Number.isFinite(payload.expiresAt) || payload.expiresAt < Date.now()) {
    throw new Error("AIR recommendation confirmation token has expired; analyze the workload again.");
  }
  if (!payload.recommendations || typeof payload.recommendations !== "object" || Array.isArray(payload.recommendations)) throw new Error("AIR recommendation confirmation token is invalid.");
  if (Object.keys(payload.recommendations).some((field) => !/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(field))) throw new Error("AIR recommendation confirmation token is invalid.");
  return payload;
}

function sign(encoded, secret) {
  return createHmac("sha256", secret).update(encoded).digest("base64url");
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

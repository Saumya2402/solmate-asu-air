import { createServer as createHttpServer } from "node:http";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { AirClient } from "./air_client.mjs";
import { AgentHarness } from "./agent_harness.mjs";
import { MockGateway } from "./mock_gateway.mjs";
import { buildReadySpec, validatePlausibilityCandidate } from "./intake.mjs";
import { buildSolHandoff } from "./terminal_handoff.mjs";
import { asuRules as knowledge, schedulerUiKnowledge } from "./knowledge.mjs";
import { sanitizeOutcomeHistory } from "./outcome_feedback.mjs";
import { issueRecommendationToken, readRecommendationValues, verifyRecommendationConfirmations } from "./recommendation_token.mjs";
import { issueHandoffToken, verifyHandoffAcknowledgement } from "./handoff_token.mjs";
import { buildFailureEvidenceGuide } from "./failure_evidence.mjs";
import { buildDocumentedDiagnosisDemo } from "./diagnosis_demo.mjs";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(currentDir, "../public");
const motionBundlePath = path.resolve(currentDir, "../node_modules/motion/dist/motion.js");
const lucideBundlePath = path.resolve(currentDir, "../node_modules/lucide/dist/umd/lucide.min.js");
export function createAppServer({ mode = process.env.AIR_MODE || (process.env.AIR_API_KEY || process.env.OPENAI_API_KEY ? "live" : "mock"), gateway, allowedOrigins = parseAllowedOrigins(process.env.AIR_ALLOWED_ORIGINS) } = {}) {
  if (!new Set(["mock", "live"]).has(mode)) throw new Error("AIR_MODE must be mock or live.");
  const selectedGateway = gateway || (mode === "live" ? new AirClient({
    timeoutMs: Number(process.env.AIR_TIMEOUT_MS || 45_000),
  }) : new MockGateway());
  const harness = new AgentHarness({ gateway: selectedGateway, schedulerProfiles: knowledge.profiles });
  const recommendationSecret = randomBytes(32);
  const handoffSecret = randomBytes(32);

  const server = createHttpServer(async (request, response) => {
    setSecurityHeaders(response);
    try {
      const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
      const corsAllowed = applyCorsHeaders(request, response, allowedOrigins);
      if (request.method === "OPTIONS") {
        if (!url.pathname.startsWith("/api/")) return sendJson(response, 405, { error: "Method not allowed." });
        if (!corsAllowed) return sendJson(response, 403, { error: "Origin is not allowed." });
        response.writeHead(204);
        return response.end();
      }
      if (request.method === "GET" && url.pathname === "/api/health") {
        const schedulerOptions = knowledge.profiles.map(({ id, cluster, partition, qos, requiresAccount = false, notes = null, source }) => ({ id, cluster, partition, qos, requiresAccount, notes, source }));
        return sendJson(response, 200, { ok: true, mode, models: harness.models, rulesVersion: knowledge.version, schedulerOptions, schedulerUi: schedulerUiKnowledge() });
      }
      if (request.method === "GET" && url.pathname === "/api/demo-status") {
        return sendJson(response, 200, { mode, live: mode === "live", persistedInputs: false, localOutcomeFeedback: true, clusterExecution: false });
      }
      if (request.method === "GET" && url.pathname === "/api/demo-diagnosis") {
        const { expectedCategory, ...demo } = buildDocumentedDiagnosisDemo();
        return sendJson(response, 200, demo);
      }
      if (request.method === "POST" && url.pathname.startsWith("/api/")) requireJson(request);
      if (request.method === "POST" && url.pathname === "/api/intake") {
        const body = await readJsonBody(request, 15_000);
        for (const field of ["cpus", "gpus", "memoryGb"]) {
          if (body.values?.[field] !== undefined) {
            const result = validatePlausibilityCandidate(field, body.values[field]);
            if (!result.valid) return sendJson(response, 422, { error: result.error, field });
          }
        }
        const controller = new AbortController();
        request.once("aborted", () => controller.abort());
        response.once("close", () => { if (!response.writableEnded) controller.abort(); });
        const priorRecommendations = body.priorRecommendationToken == null
          ? {}
          : readRecommendationValues(body.priorRecommendationToken, recommendationSecret);
        const result = await harness.intake(body.description, { priorFacts: body.priorFacts, priorRecommendations, priorOutcomes: sanitizeOutcomeHistory(body.priorOutcomes), signal: controller.signal });
        return sendJson(response, 200, { ...result, recommendationToken: issueRecommendationToken(result.analysis.recommendations, recommendationSecret) });
      }
      if (request.method === "POST" && url.pathname === "/api/generate") {
        const body = await readJsonBody(request, 25_000);
        if (!body.spec) return sendJson(response, 422, await harness.generate(body.description));
        verifyRecommendationConfirmations({ token: body.recommendationToken, fields: body.confirmedRecommendationFields || [], values: body.spec }, recommendationSecret);
        const readiness = buildReadySpec({ values: body.spec, confirmedRecommendationFields: body.confirmedRecommendationFields || [] });
        if (!readiness.ready) return sendJson(response, 422, { status: "needs_input", ...readiness });
        return sendJson(response, 200, await harness.generateSpec({ description: body.description, spec: readiness.spec }));
      }
      if (request.method === "POST" && url.pathname === "/api/handoff") {
        const body = await readJsonBody(request, 5_000);
        if (body.acknowledged === true) verifyHandoffAcknowledgement(body, body.acknowledgementToken, handoffSecret);
        const result = buildSolHandoff(body);
        const acknowledgementToken = result.valid && body.acknowledged !== true ? issueHandoffToken(body, handoffSecret) : null;
        return sendJson(response, result.valid ? 200 : 422, { ...result, acknowledgementToken });
      }
      if (request.method === "POST" && url.pathname === "/api/failure-evidence") {
        const body = await readJsonBody(request, 2_000);
        return sendJson(response, 200, buildFailureEvidenceGuide(body));
      }
      if (request.method === "POST" && url.pathname === "/api/diagnose") {
        const body = await readJsonBody(request, 45_000);
        return sendJson(response, 200, await harness.diagnose({ ...body, metadata: pickMetadata(body.metadata), rules: knowledge.diagnosisRules }));
      }
      if (request.method !== "GET") return sendJson(response, 405, { error: "Method not allowed." });
      return serveStatic(url.pathname, response);
    } catch (error) {
      const status = errorStatus(error);
      return sendJson(response, status, { error: sanitizeError(error), code: errorCode(error, status) });
    }
  });
  return { server, harness, mode };
}

function requireJson(request) {
  if (!String(request.headers["content-type"] || "").toLowerCase().startsWith("application/json")) throw new Error("Content-Type must be application/json.");
}

async function readJsonBody(request, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error("Request body is too large.");
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new Error("Request must contain a valid JSON body."); }
}

async function serveStatic(urlPath, response) {
  const relativePath = urlPath === "/" ? "index.html" : decodeURIComponent(urlPath.slice(1));
  const vendorMotion = relativePath === "vendor/motion.js";
  const vendorLucide = relativePath === "vendor/lucide.js";
  const filePath = vendorMotion ? motionBundlePath : vendorLucide ? lucideBundlePath : path.resolve(publicDir, relativePath);
  if (!vendorMotion && !vendorLucide && !filePath.startsWith(`${publicDir}${path.sep}`) && filePath !== path.join(publicDir, "index.html")) return sendJson(response, 404, { error: "Not found." });
  try {
    const content = await readFile(filePath);
    const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" }[path.extname(filePath)] || "application/octet-stream";
    response.writeHead(200, { "Content-Type": mime, "Cache-Control": "no-store" });
    response.end(content);
  } catch (error) {
    if (error.code === "ENOENT") return sendJson(response, 404, { error: "Not found." });
    throw error;
  }
}

function setSecurityHeaders(response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Content-Security-Policy", "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'");
}

function applyCorsHeaders(request, response, allowedOrigins) {
  const origin = request.headers.origin;
  if (!origin || !allowedOrigins.has(origin)) return false;
  response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Vary", "Origin");
  return true;
}

function parseAllowedOrigins(value) {
  const origins = String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
  return new Set(origins.map((item) => {
    const url = new URL(item);
    const localHttp = url.protocol === "http:" && new Set(["localhost", "127.0.0.1"]).has(url.hostname);
    if (url.protocol !== "https:" && !localHttp) throw new Error("AIR_ALLOWED_ORIGINS must contain HTTPS origins or local development origins.");
    if (url.origin !== item.replace(/\/$/, "")) throw new Error("AIR_ALLOWED_ORIGINS entries must be origins without paths.");
    return url.origin;
  }));
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(payload));
}

function sanitizeError(error) {
  if (error?.name === "AirApiError") return error.message;
  return String(error?.message || "Unexpected server error.").slice(0, 500);
}

function errorStatus(error) {
  if (error?.name === "AirApiError") return /timed out/i.test(error.message) ? 504 : 502;
  const message = String(error?.message || "");
  if (/Model response|Planner returned|Fact extractor returned|advisor returned|critic returned|Diagnostician returned/i.test(message)) return 502;
  if (/description|required|must|missing|unsafe|too large|Content-Type|cluster|confirmation token|Handoff review token|Handoff values changed|Unsupported job specification/i.test(message)) return 400;
  return 500;
}

function errorCode(error, status) {
  if (status === 504) return "AIR_TIMEOUT";
  if (status === 502) return "AIR_UPSTREAM_RESPONSE";
  if (status === 400) return "INVALID_REQUEST";
  return "INTERNAL_ERROR";
}

function pickMetadata(metadata) {
  const allowed = ["State", "Reason", "ExitCode", "Elapsed", "MaxRSS", "ReqMem", "AllocTRES"];
  return Object.fromEntries(allowed.filter((field) => metadata?.[field] !== undefined).map((field) => [field, String(metadata[field]).slice(0, 500)]));
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  const port = Number(process.env.PORT || 4173);
  const host = process.env.HOST || "127.0.0.1";
  const { server, mode } = createAppServer();
  server.listen(port, host, () => {
    console.log(`SolMate running at http://${host}:${port} (${mode} mode)`);
  });
}

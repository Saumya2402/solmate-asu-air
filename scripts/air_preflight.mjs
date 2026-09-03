import { AirClient } from "../src/air_client.mjs";
import { extractJsonObject } from "../src/job_spec.mjs";

const model = process.env.AIR_PLANNER_MODEL || "qwen3-coder-30b-a3b-instruct";
const client = new AirClient({ timeoutMs: Number(process.env.AIR_TIMEOUT_MS || 45_000), retries: 0 });
const response = await client.chat({ model, temperature: 0, messages: [
  { role: "system", content: "Return exactly one JSON object and no markdown." },
  { role: "user", content: "Return {\"air\":true,\"schema\":\"ok\"}." }
] });
const parsed = extractJsonObject(response.content);
if (parsed.air !== true || parsed.schema !== "ok") throw new Error("AIR response failed structured JSON conformance.");
console.log(JSON.stringify({ ok: true, requestedModel: model, returnedModel: response.model, latencyMs: response.latencyMs, usage: response.usage, schemaValid: true }));

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { AirClient } from "../src/air_client.mjs";
import { extractJsonObject } from "../src/job_spec.mjs";

const files = [
  "src/job_spec.mjs", "src/knowledge.mjs", "src/diagnosis.mjs", "src/agent_harness.mjs",
  "src/intake.mjs", "src/newcomer_guidance.mjs", "src/recommendation_token.mjs", "src/handoff_token.mjs", "src/terminal_handoff.mjs", "src/server.mjs",
  "public/app.js", "public/index.html", "tests/test_security_regressions.mjs", "knowledge/asu_rc_rules.json",
];
const sources = await Promise.all(files.map(async (file) => ({ file, content: await readFile(file, "utf8") })));
const model = process.env.AIR_SOURCE_REVIEW_MODEL || "qwen3-coder-30b-a3b-instruct";
const client = new AirClient({ timeoutMs: Number(process.env.AIR_TIMEOUT_MS || 120_000), retries: 0 });
const response = await client.chat({
  model, temperature: 0, maxTokens: 2200,
  messages: [
    { role: "system", content: `You are an independent security and correctness critic running on ASU AIR. Review only the supplied code. Return JSON with verdict (approve or revise), findings (objects with severity, file, issue, evidence, recommendation), passedChecks (string array), and testGaps (string array). Check: Slurm directive injection; allowlisted schemas; exact partition/QoS validation; account entitlement handling; per-node CPU/GPU/memory checks; stale browser draft precedence; recommendation confirmation bound to exact values; critic rejection enforcement; complete diagnosis-payload redaction; exact evidence and corroboration; safe repair scope; handoff acknowledgement and unresolved placeholders; cancellation races; and truthful error classification. Do not claim to execute code. Do not repeat any credential-like text.` },
    { role: "user", content: JSON.stringify({ priorAudit: "Two critical and eleven high/medium findings required remediation.", sources }) },
  ],
});
const review = extractJsonObject(response.content);
if (!["approve", "revise"].includes(review.verdict) || !Array.isArray(review.findings) || !Array.isArray(review.passedChecks) || !Array.isArray(review.testGaps)) throw new Error("AIR remediation critic returned an invalid schema.");
const artifact = { generatedAt: new Date().toISOString(), provider: "ASU AIR gateway", requestedModel: model, returnedModel: response.model || model, latencyMs: response.latencyMs ?? null, usage: response.usage || null, schemaValid: true, review };
await mkdir("reviews", { recursive: true });
const outputPath = process.env.AIR_REVIEW_OUTPUT || "reviews/air_remediation_critic_20260903.json";
await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(JSON.stringify(artifact, null, 2));

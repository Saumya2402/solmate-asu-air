import { readFile, mkdir, writeFile } from "node:fs/promises";
import { AirClient } from "../src/air_client.mjs";
import { extractJsonObject } from "../src/job_spec.mjs";

const files = [
  "src/agent_harness.mjs",
  "src/intake.mjs",
  "src/server.mjs",
  "public/app.js",
  "tests/test_agent_harness.mjs",
  "tests/test_intake.mjs",
  "tests/test_server.mjs",
];
const sources = await Promise.all(files.map(async (file) => ({ file, content: await readFile(file, "utf8") })));
const model = process.env.AIR_SOURCE_REVIEW_MODEL || process.env.AIR_CRITIC_MODEL || "qwen3-coder-30b-a3b-instruct";
const client = new AirClient({ timeoutMs: Number(process.env.AIR_TIMEOUT_MS || 90_000) });
const response = await client.chat({
  model,
  temperature: 0,
  maxTokens: 1600,
  messages: [
    {
      role: "system",
      content: `You are an independent senior code reviewer running on ASU AIR. Inspect the supplied source for data loss, stale-state bugs, trust-boundary failures, concurrency races, invalid model-output handling, and missing regression tests. Focus on this invariant: a later partial or failed AIR response must not erase previously verified workload facts or user-entered form values; newer evidence-backed corrections must win. Also check a/an CPU=1, MPI n=16 as tasks not CPUs, standalone Linux paths, "general Sol cluster" as cluster Sol but not partition general, and prevention of joined job/path values. Return JSON only with verdict (approve or revise), findings (array of objects with severity, file, issue, recommendation), and testGaps (string array). Do not claim to have executed tests.`,
    },
    { role: "user", content: JSON.stringify({ reportedFailure: "Fields disappeared after re-analysis or an AIR JSON error; cluster, CPU, GPU, path, and MPI state were inconsistent.", sources }) },
  ],
});
const review = extractJsonObject(response.content);
const artifact = {
  generatedAt: new Date().toISOString(),
  provider: "ASU AIR gateway",
  requestedModel: model,
  returnedModel: response.model || model,
  latencyMs: response.latencyMs ?? null,
  schemaValid: Array.isArray(review.findings) && Array.isArray(review.testGaps) && ["approve", "revise"].includes(review.verdict),
  review,
};
await mkdir("reviews", { recursive: true });
await writeFile("reviews/air_stateful_intake_critic_20260903.json", `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(JSON.stringify(artifact, null, 2));

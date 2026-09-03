import { mkdir, readFile, writeFile } from "node:fs/promises";
import { AirClient } from "../src/air_client.mjs";
import { AgentHarness } from "../src/agent_harness.mjs";
import { asuRules } from "../src/knowledge.mjs";
import { validateJobSpec } from "../src/job_spec.mjs";

const candidates = (process.env.AIR_BENCHMARK_MODELS || "qwen3-coder-30b-a3b-instruct,qwen3-coder-next,north-mini-code").split(",").map((item) => item.trim()).filter(Boolean).slice(0, 3);
const workloads = JSON.parse(await readFile(new URL("../fixtures/workload_cases.json", import.meta.url), "utf8"));
const failures = JSON.parse(await readFile(new URL("../fixtures/failure_cases.json", import.meta.url), "utf8"));
const client = new AirClient({ timeoutMs: 45_000, retries: 0 });
const startedAt = Date.now();
const deadline = startedAt + 60 * 60_000;
const results = [];

for (const model of candidates) {
  const harness = new AgentHarness({
    gateway: client, schedulerProfiles: asuRules.profiles,
    extractorModel: model, factAuditorModel: model, completionModel: model,
    schedulerModel: model, plannerModel: model, criticModel: model, diagnosticianModel: model,
    typoModel: model, explainerModel: model,
  });
  const candidate = { model, workloads: [], failures: [], stoppedEarly: false };
  results.push(candidate);
  for (const fixture of workloads) {
    if (Date.now() >= deadline) { candidate.stoppedEarly = true; break; }
    const callStarted = Date.now();
    try {
      const result = await harness.intake(fixture.description);
      candidate.workloads.push({
        id: fixture.id,
        passed: result.analysis.workloadType === fixture.expectedType && result.analysis.extracted.cluster === fixture.expectedCluster,
        latencyMs: Date.now() - callStarted,
        returnedModels: Object.fromEntries(result.agents.map((agent) => [agent.role, agent.model])),
        schemaValid: true,
        deterministicSpecValid: fixture.spec ? validateJobSpec(fixture.spec, { requireComplete: true }).valid : null,
      });
    } catch (error) {
      candidate.workloads.push({ id: fixture.id, passed: false, latencyMs: Date.now() - callStarted, error: safeError(error) });
      if (/timed out|HTTP 4\d\d|empty assistant/i.test(error.message || "")) { candidate.stoppedEarly = true; break; }
    }
  }
  if (candidate.stoppedEarly) continue;
  for (const fixture of failures) {
    if (Date.now() >= deadline) { candidate.stoppedEarly = true; break; }
    const callStarted = Date.now();
    try {
      const result = await harness.diagnose({ cluster: fixture.cluster, log: fixture.log, metadata: fixture.metadata, rules: asuRules.diagnosisRules });
      candidate.failures.push({ id: fixture.id, passed: result.diagnosis.category === (fixture.expectedCategory || "UNKNOWN"), confidence: result.diagnosis.confidence, latencyMs: Date.now() - callStarted, returnedModel: result.agent.model, schemaValid: true });
    } catch (error) {
      candidate.failures.push({ id: fixture.id, passed: false, latencyMs: Date.now() - callStarted, error: safeError(error) });
      if (/timed out|HTTP 4\d\d|empty assistant/i.test(error.message || "")) { candidate.stoppedEarly = true; break; }
    }
  }
}

const artifact = { generatedAt: new Date().toISOString(), endpoint: "https://openai.rc.asu.edu/v1/chat/completions", containsSensitiveInputs: false, candidates: results, elapsedMs: Date.now() - startedAt };
await mkdir("results", { recursive: true });
const stamp = artifact.generatedAt.replace(/[-:]/g, "").slice(0, 13).replace("T", "_");
const output = `results/results_air_model_benchmark_${stamp}.json`;
await writeFile(output, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output, ...artifact }, null, 2));

function safeError(error) {
  return String(error?.message || "failed").slice(0, 200);
}

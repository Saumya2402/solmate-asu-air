import { mkdir, writeFile } from "node:fs/promises";
import { AirClient } from "../src/air_client.mjs";
import { FACT_EXTRACTOR_SYSTEM } from "../src/agent_harness.mjs";
import { normalizeAirFacts } from "../src/intake.mjs";
import { extractJsonObject } from "../src/job_spec.mjs";

const candidates = (process.env.AIR_ROLE_BENCHMARK_MODELS || "glm-5-3-flash,qwen3-30b-a3b-instruct-2507,qwen3-coder-30b-a3b-instruct")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean)
  .slice(0, 3);
const fixtures = [
  {
    id: "pytorch_minutes",
    description: "Train image.py on Sol as job imagev3 from /scratch/demo/images with 8 CPUs, one GPU, 32 GB memory, 1000 epochs, and 5000 minutes total runtime.",
    expected: { cluster: "sol", jobName: "imagev3", workingDirectory: "/scratch/demo/images", cpus: 8, gpus: 1, memoryGb: 32, epochs: 1000, walltime: "83:20:00" },
  },
  {
    id: "openfoam_mpi",
    description: "Run pimpleFoam on Sol as job of13 from /scratch/demo/openfoam with MPI n=16, one CPU per rank, no GPUs, 32 GB memory, and two hours.",
    expected: { cluster: "sol", jobName: "of13", workingDirectory: "/scratch/demo/openfoam", cpus: 1, gpus: 0, memoryGb: 32, tasks: 16, walltime: "02:00:00" },
  },
  {
    id: "phoenix_cpu",
    description: "Run workflow.sh on Phoenix as job genomics from /scratch/demo/genomics with 8 CPUs, no GPU, 16 GB memory, and 90 minutes.",
    expected: { cluster: "phoenix", jobName: "genomics", workingDirectory: "/scratch/demo/genomics", cpus: 8, gpus: 0, memoryGb: 16, walltime: "01:30:00" },
  },
];
const client = new AirClient({ timeoutMs: Number(process.env.AIR_ROLE_BENCHMARK_TIMEOUT_MS || 30_000), retries: 0 });
const byModel = new Map(candidates.map((model) => [model, []]));
const batches = [];
const startedAt = Date.now();

for (const fixture of fixtures) {
  const batchStarted = Date.now();
  const outcomes = await Promise.allSettled(candidates.map((model) => runExtractorCase(model, fixture)));
  outcomes.forEach((outcome, index) => {
    const model = candidates[index];
    const result = outcome.status === "fulfilled"
      ? outcome.value
      : { fixture: fixture.id, passed: false, schemaValid: false, validFields: 0, expectedFields: Object.keys(fixture.expected).length, fieldRecall: 0, latencyMs: Date.now() - batchStarted, error: safeError(outcome.reason) };
    byModel.get(model).push(result);
  });
  batches.push({ fixture: fixture.id, elapsedMs: Date.now() - batchStarted, concurrentModels: candidates.length });
}

const summaries = candidates.map((model) => summarize(model, byModel.get(model)));
const artifact = {
  generatedAt: new Date().toISOString(),
  endpoint: "https://openai.rc.asu.edu/v1/chat/completions",
  role: "fact_extractor",
  execution: "candidate models run concurrently per sanitized fixture",
  containsPrompts: false,
  containsRawResponses: false,
  candidates: summaries,
  batches,
  elapsedMs: Date.now() - startedAt,
};
await mkdir("results", { recursive: true });
const compactTimestamp = artifact.generatedAt.replace(/\D/g, "");
const stamp = `${compactTimestamp.slice(0, 8)}_${compactTimestamp.slice(8, 14)}`;
const output = `results/results_air_role_benchmark_${stamp}.json`;
await writeFile(output, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output, role: artifact.role, candidates: summaries, batches, elapsedMs: artifact.elapsedMs }, null, 2));

async function runExtractorCase(model, fixture) {
  const started = Date.now();
  try {
    const response = await client.chat({
      model,
      temperature: 0,
      maxTokens: 600,
      messages: [{ role: "system", content: FACT_EXTRACTOR_SYSTEM }, { role: "user", content: fixture.description }],
    });
    const parsed = extractJsonObject(response.content);
    const normalized = normalizeAirFacts(fixture.description, parsed);
    const entries = Object.entries(fixture.expected);
    const incorrectFields = entries
      .filter(([field, expected]) => JSON.stringify(normalized.extracted[field]) !== JSON.stringify(expected))
      .map(([field]) => field);
    const validFields = entries.length - incorrectFields.length;
    return {
      fixture: fixture.id,
      passed: validFields === entries.length,
      schemaValid: true,
      validFields,
      expectedFields: entries.length,
      fieldRecall: validFields / entries.length,
      incorrectFields,
      latencyMs: response.latencyMs ?? Date.now() - started,
      returnedModel: response.model,
    };
  } catch (error) {
    return { fixture: fixture.id, passed: false, schemaValid: false, validFields: 0, expectedFields: Object.keys(fixture.expected).length, fieldRecall: 0, latencyMs: Date.now() - started, error: safeError(error) };
  }
}

function summarize(model, cases) {
  const latencies = cases.map((item) => item.latencyMs).sort((a, b) => a - b);
  const totalExpected = cases.reduce((sum, item) => sum + item.expectedFields, 0);
  const totalValid = cases.reduce((sum, item) => sum + item.validFields, 0);
  return {
    model,
    cases: cases.length,
    passedCases: cases.filter((item) => item.passed).length,
    schemaPassRate: cases.filter((item) => item.schemaValid).length / cases.length,
    fieldRecall: totalExpected ? totalValid / totalExpected : 0,
    p50LatencyMs: percentile(latencies, 0.5),
    p95LatencyMs: percentile(latencies, 0.95),
    results: cases,
  };
}

function percentile(values, fraction) {
  if (!values.length) return null;
  return values[Math.min(values.length - 1, Math.ceil(values.length * fraction) - 1)];
}

function safeError(error) {
  return String(error?.message || "failed").replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]").slice(0, 160);
}

import { mkdir, writeFile } from "node:fs/promises";
import { AirClient } from "../src/air_client.mjs";
import {
  COMPLETION_ADVISOR_SYSTEM,
  CRITIC_SYSTEM,
  DIAGNOSIS_SYSTEM,
  INTAKE_SYSTEM,
  RESOURCE_CRITIC_SYSTEM,
  SCHEDULER_ADVISOR_SYSTEM,
  SCRIPT_EXPLAINER_SYSTEM,
  TYPO_REVIEWER_SYSTEM,
} from "../src/agent_harness.mjs";
import { deterministicFindings, validateDiagnosis } from "../src/diagnosis.mjs";
import { normalizeIntakeAnalysis, validateCorrections, validateIntakeAnalysis } from "../src/intake.mjs";
import { extractJsonObject, renderSlurmScript } from "../src/job_spec.mjs";
import { asuRules } from "../src/knowledge.mjs";
import { validateScriptExplanations } from "../src/newcomer_guidance.mjs";

const FALLBACK = "qwen3-coder-30b-a3b-instruct";
const timeoutMs = boundedInteger(process.env.AIR_ROLE_SUITE_TIMEOUT_MS, 18_000, 5_000, 60_000);
const concurrency = boundedInteger(process.env.AIR_ROLE_SUITE_CONCURRENCY, 4, 1, 8);
const client = new AirClient({ timeoutMs, retries: 0 });
const schedulerProfiles = asuRules.profiles;
const diagnosisRules = asuRules.diagnosisRules;

const spec = {
  cluster: "sol",
  workloadType: "ml_training",
  jobName: "imagev3",
  workingDirectory: "/scratch/demo/images",
  cpus: 8,
  gpus: 1,
  memoryGb: 32,
  walltime: "02:00:00",
  partition: "public",
  qos: "public",
  outputPath: "%x_%j.out",
  errorPath: "%x_%j.err",
  modules: ["python", "cuda"],
  executable: "python",
  args: ["image.py", "--epochs", "10"],
  epochs: 10,
};
const exactScript = renderSlurmScript(spec);
const mismatchedScript = exactScript.replace("#SBATCH --cpus-per-task=8", "#SBATCH --cpus-per-task=64");

const roles = [
  {
    name: "workflow_classifier",
    candidates: ["qwen3-30b-a3b-instruct-2507", "qwen35-27b", FALLBACK],
    system: INTAKE_SYSTEM,
    maxTokens: 1100,
    cases: [{
      id: "pytorch_training",
      input: "Train a PyTorch image classifier on Sol from /scratch/demo/images for 1000 epochs.",
      evaluate(value) {
        const analysis = validateIntakeAnalysis(normalizeIntakeAnalysis(value));
        const checks = {
          workloadType: analysis.workloadType === "ml_training",
          software: String(analysis.software || "").toLowerCase().includes("pytorch"),
          usefulQuestion: typeof analysis.nextQuestion === "string" && analysis.nextQuestion.length > 5,
        };
        return scored(checks);
      },
    }],
  },
  {
    name: "typo_reviewer",
    candidates: ["gemma4-31b-it", "qwen3-30b-a3b-instruct-2507", FALLBACK],
    system: TYPO_REVIEWER_SYSTEM,
    maxTokens: 450,
    cases: [{
      id: "software_and_language_typos",
      input: "Run an OpenFom simualtion on Sol as job of13.",
      evaluate(value, testCase) {
        const corrections = validateCorrections(testCase.input, value.corrections);
        const pairs = new Map(corrections.map((item) => [item.original, item.suggested]));
        return scored({
          openfoam: pairs.get("OpenFom") === "OpenFOAM",
          simulation: pairs.get("simualtion") === "simulation",
          preservesIdentifier: !corrections.some((item) => item.original === "of13" && item.requiresConfirmation === false),
        });
      },
    }],
  },
  {
    name: "scheduler_advisor",
    candidates: ["qwen3-30b-a3b-instruct-2507", "glm-5-3-flash", FALLBACK],
    system: SCHEDULER_ADVISOR_SYSTEM,
    maxTokens: 240,
    cases: [{
      id: "sol_general_profile",
      input: JSON.stringify({ description: "Run a two-hour general workload on Sol.", supportedSchedulerProfiles: schedulerProfiles }),
      evaluate(value) {
        const profile = schedulerProfiles.find((item) => item.cluster === "sol" && item.partition === value.partition && item.qos === value.qos);
        return scored({
          exactSupportedPair: Boolean(profile),
          expectedGeneralPair: value.partition === "public" && value.qos === "public",
          reason: typeof value.reason === "string" && value.reason.length >= 10,
          noEntitlementClaim: !/you (?:have|are entitled)|guaranteed access/i.test(value.reason || ""),
        });
      },
    }],
  },
  {
    name: "completion_advisor",
    candidates: ["qwen3-30b-a3b-instruct-2507", "qwen3-coder-next", FALLBACK],
    system: COMPLETION_ADVISOR_SYSTEM,
    maxTokens: 600,
    cases: [{
      id: "openfoam_safe_defaults",
      input: JSON.stringify({
        description: "Run pimpleFoam on Sol with MPI n=16 from /scratch/demo/openfoam.",
        supportedSchedulerProfiles: schedulerProfiles,
      }),
      evaluate(value) {
        const suggestions = value?.suggestions;
        const logPath = (field) => typeof suggestions?.[field] === "string" && /%[jx]/.test(suggestions[field]);
        const profile = schedulerProfiles.find((item) => item.cluster === "sol" && item.partition === suggestions?.partition && item.qos === suggestions?.qos);
        return scored({
          schema: suggestions && typeof suggestions === "object" && value.reasons && typeof value.reasons === "object",
          safeJobName: /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(suggestions?.jobName || ""),
          identifiableLogs: logPath("outputPath") && logPath("errorPath"),
          cpuOpenFoam: suggestions?.gpus === 0,
          mpiArgument: Array.isArray(suggestions?.args) && suggestions.args.includes("-parallel"),
          schedulerPair: Boolean(profile),
        });
      },
    }],
  },
  {
    name: "scientific_planner",
    candidates: ["qwen3-235b-a22b-instruct-2507", "glm-5-3", FALLBACK],
    system: INTAKE_SYSTEM,
    maxTokens: 1100,
    cases: [{
      id: "openfoam_information_gain",
      input: "Run an OpenFOAM simulation on Sol with one GPU and 32 GB memory.",
      evaluate(value) {
        const analysis = validateIntakeAnalysis(normalizeIntakeAnalysis(value));
        const conflictText = analysis.detectedConflicts.map((item) => item.message).join(" ");
        return scored({
          workloadType: analysis.workloadType === "simulation",
          software: String(analysis.software || "").toLowerCase() === "openfoam",
          asksForScale: /solver|mesh|cell|gpu|implementation|build/i.test(analysis.nextQuestion || ""),
          flagsGpuUncertainty: /gpu|accelerat/i.test(conflictText) || /gpu|accelerat/i.test(analysis.recommendationBasis || ""),
          doesNotInventScheduler: !analysis.recommendations.some((item) => ["partition", "qos"].includes(item.field)),
        });
      },
    }],
  },
  {
    name: "resource_critic",
    candidates: ["glm-5-3", "qwen3-235b-a22b-instruct-2507", FALLBACK],
    system: RESOURCE_CRITIC_SYSTEM,
    maxTokens: 1000,
    cases: [{
      id: "reject_unsupported_openfoam_gpu",
      input: JSON.stringify({
        workload: "Run standard pimpleFoam on 500,000 cells with MPI n=16.",
        software: "OpenFOAM",
        supportedSchedulerProfiles: schedulerProfiles,
        recommendations: [
          recommendation("cpus", 1),
          recommendation("gpus", 1),
          recommendation("memoryGb", 32),
          recommendation("walltime", "02:00:00"),
        ],
      }),
      evaluate(value) {
        const expected = new Set(["cpus", "gpus", "memoryGb", "walltime"]);
        const reviews = Array.isArray(value.reviews) ? value.reviews : [];
        const fields = new Set(reviews.map((item) => item.field));
        const gpu = reviews.find((item) => item.field === "gpus");
        return scored({
          schema: ["approve", "revise"].includes(value.verdict) && Array.isArray(value.findings),
          exactCoverage: reviews.length === expected.size && fields.size === expected.size && [...expected].every((field) => fields.has(field)),
          rejectsGpu: gpu?.decision === "reject",
          profilingProfile: value.profilingProfile === "openfoam_medium",
        });
      },
    }],
  },
  {
    name: "slurm_critic",
    candidates: ["devstral2-123b", "qwen3-coder-next", FALLBACK],
    system: CRITIC_SYSTEM,
    maxTokens: 600,
    cases: [{
      id: "cpu_directive_mismatch",
      input: JSON.stringify({ workload: "Train an image classifier.", spec, validation: { valid: true, errors: [], warnings: [] }, script: mismatchedScript, policyContext: null }),
      evaluate(value) {
        const findings = Array.isArray(value.findings) ? value.findings : [];
        const recommendations = Array.isArray(value.recommendations) ? value.recommendations : [];
        const items = [...findings, ...recommendations];
        const validItems = items.every((item) => item && typeof item.message === "string" && ["spec", "validation"].includes(item.basis) && item.source == null);
        return scored({
          schema: ["approve", "review"].includes(value.verdict) && validItems,
          reviewVerdict: value.verdict === "review",
          catchesMismatch: items.some((item) => /cpu|64|8|mismatch|differ/i.test(item.message)),
        });
      },
    }],
  },
  {
    name: "diagnostician",
    candidates: ["qwen3-235b-a22b-instruct-2507", "glm-5-3", FALLBACK],
    system: DIAGNOSIS_SYSTEM,
    maxTokens: 750,
    cases: [diagnosisCase("oom", "slurmstepd: error: Detected oom_kill event", { State: "OUT_OF_MEMORY" }, "OUT_OF_MEMORY", "slurm-oom"), diagnosisCase("timeout", "JOB CANCELLED DUE TO TIME LIMIT", { State: "TIMEOUT" }, "TIMEOUT", "slurm-timeout")],
  },
  {
    name: "script_explainer",
    candidates: ["qwen3-coder-next", "devstral2-123b", FALLBACK],
    system: SCRIPT_EXPLAINER_SYSTEM,
    maxTokens: 1500,
    cases: [{
      id: "complete_generated_script",
      input: JSON.stringify({ script: exactScript }),
      evaluate(value) {
        const explanations = validateScriptExplanations(value, exactScript);
        return scored({ completeCoverage: explanations.length > 8 });
      },
    }],
  },
];

const roleFilter = new Set(String(process.env.AIR_ROLE_SUITE_ROLES || "").split(",").map((value) => value.trim()).filter(Boolean));
const selectedRoles = roleFilter.size ? roles.filter((role) => roleFilter.has(role.name)) : roles;
if (selectedRoles.length === 0) throw new Error("AIR_ROLE_SUITE_ROLES did not match a benchmark role.");
const tasks = selectedRoles.flatMap((role) => role.cases.flatMap((testCase) => role.candidates.map((model) => ({ role, testCase, model }))));
const startedAt = Date.now();
const results = await runPool(tasks, concurrency, runCase);
const roleSummaries = selectedRoles.map((role) => summarizeRole(role, results.filter((item) => item.role === role.name)));
const generatedAt = new Date().toISOString();
const artifact = {
  generatedAt,
  endpoint: "https://openai.rc.asu.edu/v1/chat/completions",
  kind: "rapid role-specific screening",
  containsPrompts: false,
  containsRawResponses: false,
  timeoutMs,
  concurrency,
  calls: tasks.length,
  elapsedMs: Date.now() - startedAt,
  roles: roleSummaries,
};
await mkdir("results", { recursive: true });
const compact = generatedAt.replace(/\D/g, "");
const output = `results/results_air_role_suite_${compact.slice(0, 8)}_${compact.slice(8, 14)}.json`;
await writeFile(output, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  output,
  elapsedMs: artifact.elapsedMs,
  timeoutMs,
  concurrency,
  roles: roleSummaries.map(({ role, winner, candidates }) => ({ role, winner, candidates: candidates.map(compactCandidate) })),
}, null, 2));

async function runCase({ role, testCase, model }) {
  const started = Date.now();
  try {
    const response = await client.chat({
      model,
      temperature: 0,
      maxTokens: role.maxTokens,
      messages: [{ role: "system", content: role.system }, { role: "user", content: testCase.input }],
    });
    const parsed = extractJsonObject(response.content);
    const score = testCase.evaluate(parsed, testCase);
    return {
      role: role.name,
      case: testCase.id,
      requestedModel: model,
      returnedModel: response.model,
      passed: score.passed,
      schemaValid: score.schemaValid,
      quality: score.quality,
      failedChecks: score.failedChecks,
      latencyMs: response.latencyMs ?? Date.now() - started,
    };
  } catch (error) {
    return {
      role: role.name,
      case: testCase.id,
      requestedModel: model,
      passed: false,
      schemaValid: false,
      quality: 0,
      failedChecks: [safeError(error)],
      latencyMs: Date.now() - started,
    };
  }
}

function diagnosisCase(id, log, metadata, category, ruleId) {
  const rules = diagnosisRules.filter((rule) => rule.cluster === "any" || rule.cluster === "sol");
  const findings = deterministicFindings(log, metadata);
  return {
    id,
    input: JSON.stringify({ cluster: "sol", script: "", log, metadata, deterministicFindings: findings, rules }),
    evaluate(value) {
      validateDiagnosis(value, { log, metadata, allowedRuleIds: rules.map((rule) => rule.id), rules, deterministicFindings: findings });
      return scored({ category: value.category === category, ruleId: value.ruleId === ruleId, confidence: value.confidence === "confirmed" });
    },
  };
}

function recommendation(field, value) {
  return { field, value, rationale: "Seeded benchmark recommendation.", uncertainty: "medium", assumptions: ["No production measurements supplied."], tuningAdvice: "Measure the first run." };
}

function scored(checks) {
  const entries = Object.entries(checks);
  const failedChecks = entries.filter(([, passed]) => !passed).map(([name]) => name);
  return { passed: failedChecks.length === 0, schemaValid: checks.schema !== false, quality: entries.filter(([, passed]) => passed).length / entries.length, failedChecks };
}

async function runPool(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function consume() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, consume));
  return results;
}

function summarizeRole(role, results) {
  const candidates = role.candidates.map((model) => {
    const cases = results.filter((item) => item.requestedModel === model);
    const latencies = cases.map((item) => item.latencyMs).sort((a, b) => a - b);
    return {
      model,
      cases: cases.length,
      passedCases: cases.filter((item) => item.passed).length,
      passRate: cases.filter((item) => item.passed).length / cases.length,
      schemaPassRate: cases.filter((item) => item.schemaValid).length / cases.length,
      meanQuality: average(cases.map((item) => item.quality)),
      p50LatencyMs: percentile(latencies, 0.5),
      p95LatencyMs: percentile(latencies, 0.95),
      results: cases,
    };
  });
  const ranked = [...candidates].sort((left, right) => right.passRate - left.passRate || right.schemaPassRate - left.schemaPassRate || right.meanQuality - left.meanQuality || left.p95LatencyMs - right.p95LatencyMs);
  return { role: role.name, winner: ranked[0]?.passRate > 0 ? ranked[0].model : null, candidates };
}

function compactCandidate(candidate) {
  return {
    model: candidate.model,
    passed: `${candidate.passedCases}/${candidate.cases}`,
    schemaPassRate: candidate.schemaPassRate,
    meanQuality: candidate.meanQuality,
    p95LatencyMs: candidate.p95LatencyMs,
  };
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function percentile(values, fraction) {
  if (!values.length) return null;
  return values[Math.min(values.length - 1, Math.ceil(values.length * fraction) - 1)];
}

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

function safeError(error) {
  return String(error?.message || "failed").replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]").slice(0, 160);
}

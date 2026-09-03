import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { AgentHarness } from "../src/agent_harness.mjs";
import { issueRecommendationToken, readRecommendationValues, verifyRecommendationConfirmations } from "../src/recommendation_token.mjs";
import { renderSlurmScript, validateJobSpec } from "../src/job_spec.mjs";
import { buildSolHandoff } from "../src/terminal_handoff.mjs";
import { completeSpec } from "./fixtures.mjs";

test("job schema rejects account directive injection and unknown properties", () => {
  const injected = validateJobSpec({ ...completeSpec, account: "research\n#SBATCH --wrap=malicious" }, { requireComplete: true });
  assert.equal(injected.valid, false);
  assert.ok(injected.errors.some((item) => item.startsWith("account")));
  assert.throws(() => renderSlurmScript({ ...completeSpec, account: "research\n#SBATCH --wrap=malicious" }), /invalid job specification/);
  assert.equal(validateJobSpec({ ...completeSpec, surprise: true }, { requireComplete: true }).valid, false);
});

test("job schema rejects unsupported scheduler pairs and impossible per-node requests", () => {
  const pair = validateJobSpec({ ...completeSpec, partition: "general", qos: "general" }, { requireComplete: true });
  assert.equal(pair.valid, false);
  assert.ok(pair.errors.some((item) => /not in the dated sol scheduler profile/.test(item)));

  const cores = validateJobSpec({ ...completeSpec, workloadType: "distributed", nodes: 1, tasks: 16, cpus: 16, gpus: 0 }, { requireComplete: true });
  assert.equal(cores.valid, false);
  assert.ok(cores.errors.some((item) => /cores per node/.test(item)));
});

test("class scheduler profile requires a validated account", () => {
  const missing = validateJobSpec({ ...completeSpec, partition: "public", qos: "class" }, { requireComplete: true });
  assert.equal(missing.valid, false);
  assert.ok(missing.errors.some((item) => /requires an account/.test(item)));
  const supplied = validateJobSpec({ ...completeSpec, partition: "public", qos: "class", account: "class_asu101" }, { requireComplete: true });
  assert.equal(supplied.valid, true);
});

test("parallel OpenFOAM requires an explicit parallel command", () => {
  const base = { ...completeSpec, workloadType: "simulation", executable: "pimpleFoam", nodes: 1, tasks: 8, cpus: 1, gpus: 0, modules: [] };
  assert.equal(validateJobSpec({ ...base, args: [] }, { requireComplete: true }).valid, false);
  assert.equal(validateJobSpec({ ...base, args: ["-parallel"] }, { requireComplete: true }).valid, true);
});

test("recommendation confirmation token binds fields to exact values", () => {
  const secret = randomBytes(32);
  const token = issueRecommendationToken([{ field: "jobName", value: "air-job" }, { field: "modules", value: [] }], secret);
  assert.doesNotThrow(() => verifyRecommendationConfirmations({ token, fields: ["jobName", "modules"], values: { jobName: "air-job", modules: [] } }, secret));
  assert.throws(() => verifyRecommendationConfirmations({ token, fields: [], values: { jobName: "air-job", modules: [] } }, secret), /must be confirmed or changed/);
  assert.doesNotThrow(() => verifyRecommendationConfirmations({ token, fields: [], values: { jobName: "researcher-job", modules: ["openfoam"] } }, secret));
  assert.throws(() => verifyRecommendationConfirmations({ token, fields: ["jobName"], values: { jobName: "edited" } }, secret), /was edited/);
  assert.throws(() => verifyRecommendationConfirmations({ token, fields: ["cpus"], values: { cpus: 8 } }, secret), /No AIR recommendation/);
  assert.deepEqual(readRecommendationValues(token, secret), { jobName: "air-job", modules: [] });
  assert.throws(() => readRecommendationValues("forged.token", secret), /invalid/);
});

test("diagnosis sends only redacted evidence and metadata to AIR", async () => {
  let outbound;
  const gateway = { async chat({ messages }) {
    const system = messages[0].content;
    if (system.includes("valid JSON object preserving")) throw new Error("repair should not be needed");
    outbound = JSON.parse(messages.at(-1).content);
    const finding = outbound.deterministicFindings[0];
    return { model: "test", content: JSON.stringify({
      category: finding.category,
      confidence: finding.confidence,
      ruleId: finding.ruleId,
      evidence: finding.evidence,
      explanation: finding.explanation,
      alternatives: [],
      missingEvidence: [],
      recommendations: ["Review the evidence."],
      patch: null,
    }) };
  } };
  const harness = new AgentHarness({ gateway });
  await harness.diagnose({
    cluster: "sol",
    log: "slurmstepd: OOM-kill for alex@asu.edu account=secretlab host=sol123 path=/scratch/alex/private job 123456",
    metadata: { State: "OUT_OF_MEMORY", Reason: "account=secretlab host=sol123" },
    rules: [{ id: "slurm-oom", cluster: "any", category: "OUT_OF_MEMORY", source: "https://docs.rc.asu.edu/job-statistics/" }],
  });
  const serialized = JSON.stringify(outbound);
  assert.doesNotMatch(serialized, /alex|secretlab|sol123|123456|private/);
  assert.match(serialized, /redacted/);
});

test("handoff supports an existing remote file and marks job-id commands unresolved", () => {
  const result = buildSolHandoff({ asurite: "ssaum", transferMode: "present", remoteDirectory: "/scratch/ssaum/project", filename: "job.slurm" });
  assert.equal(result.valid, true);
  assert.equal(result.steps.some((step) => step.id === "upload"), false);
  assert.equal(result.steps.find((step) => step.id === "summary").unresolved, true);
  assert.equal(result.steps.find((step) => step.id === "submit"), undefined);
  assert.equal(buildSolHandoff({ asurite: "ssaum", transferMode: "present", remoteDirectory: "/scratch/ssaum/project", filename: "job.slurm", acknowledged: true }).steps.find((step) => step.id === "submit").requiresAcknowledgement, true);
});

test("generation critic cannot cite policy outside the supplied profile", async () => {
  const gateway = { async chat() { return { model: "test", content: JSON.stringify({ verdict: "review", findings: [{ message: "Invented policy.", basis: "policy", source: "https://example.invalid/policy" }], recommendations: [] }) }; } };
  const harness = new AgentHarness({ gateway });
  await assert.rejects(harness.generateSpec({ description: "Run a complete training workload on Sol.", spec: completeSpec }), /ungrounded review object/);
});

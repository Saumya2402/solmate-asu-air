import test from "node:test";
import assert from "node:assert/strict";
import { diagnosisDisposition, diagnosisFromDeterministicFindings, deterministicFindings, redactSensitive, validateDiagnosis } from "../src/diagnosis.mjs";
import { readFile } from "node:fs/promises";

test("OOM requires metadata corroboration for confirmed confidence", () => {
  const log = "start\nslurmstepd: error: Detected oom_kill event";
  assert.equal(deterministicFindings(log)[0].confidence, "probable");
  assert.equal(deterministicFindings(log, { State: "OUT_OF_MEMORY" })[0].confidence, "confirmed");
});

test("terminal scheduler states are sufficient metadata evidence", () => {
  assert.equal(deterministicFindings("Application stopped", { State: "OUT_OF_MEMORY" })[0].confidence, "confirmed");
  assert.equal(deterministicFindings("Application stopped", { State: "TIMEOUT" })[0].category, "TIMEOUT");
  assert.equal(deterministicFindings("Application stopped", { State: "NODE_FAIL" })[0].category, "INFRASTRUCTURE_OR_ADMIN");
});

test("invalid feature remains an ambiguous family", () => {
  const finding = deterministicFindings("sbatch: error: Batch job submission failed: Invalid feature specification")[0];
  assert.equal(finding.category, "INVALID_PARTITION_OR_QOS_OR_CONSTRAINT");
  assert.equal(finding.confidence, "probable");
});

test("Slurm execve missing executable output is a confirmed environment failure", () => {
  const findings = deterministicFindings("error: execve(): bash: No such file or directory\nsrun: task 0 exited with exit code 2");
  assert.equal(findings[0].category, "COMMAND_NOT_FOUND_OR_MODULE");
  assert.equal(findings[0].confidence, "confirmed");
  const diagnosis = diagnosisFromDeterministicFindings(findings);
  assert.match(diagnosis.recommendations[0], /absolute path|PATH/i);
  assert.ok(diagnosis.recommendations.some((item) => /module avail.*mamba/i.test(item)));
});

test("diagnosis rejects fabricated evidence and a text/line mismatch", () => {
  const base = { category: "TIMEOUT", confidence: "probable", ruleId: "slurm-timeout", explanation: "Timed out.", recommendations: [] };
  assert.throws(() => validateDiagnosis({ ...base, evidence: [{ lineNumber: 2, text: "timeout" }] }, { log: "timeout\njob stopped", allowedRuleIds: ["slurm-timeout"] }), /does not match/);
  assert.throws(() => validateDiagnosis({ ...base, evidence: [{ lineNumber: 1, text: "fabricated" }] }, { log: "timeout", allowedRuleIds: ["slurm-timeout"] }), /does not match/);
});

test("diagnosis rejects an applicable but untriggered rule", () => {
  const diagnosis = { category: "INVALID_PARTITION_OR_QOS_OR_CONSTRAINT", confidence: "probable", ruleId: "slurm-invalid-feature", evidence: [{ lineNumber: 1, text: "This does not look like a batch script" }], explanation: "Wrong category.", alternatives: [], missingEvidence: [], recommendations: [] };
  assert.throws(() => validateDiagnosis(diagnosis, { log: "This does not look like a batch script", allowedRuleIds: ["slurm-invalid-feature"], rules: [{ id: "slurm-invalid-feature", category: diagnosis.category }], deterministicFindings: deterministicFindings("This does not look like a batch script") }), /trigger was not found/);
});

test("unknown fallback remains useful when AIR output is rejected", () => {
  const diagnosis = diagnosisFromDeterministicFindings([], { log: "Application exited unexpectedly", metadata: { State: "FAILED" } });
  assert.equal(diagnosis.category, "UNKNOWN");
  assert.equal(diagnosis.confidence, "inconclusive");
  assert.equal(diagnosis.evidence[0].text, "Application exited unexpectedly");
  assert.ok(diagnosis.missingEvidence.length > 0);
  assert.equal(diagnosisDisposition(diagnosis).id, "support");
});

test("exit code alone cannot become a confirmed diagnosis", () => {
  const diagnosis = { category: "FILE_OR_EXECUTION_PERMISSION", confidence: "confirmed", ruleId: null, evidence: [{ source: "metadata", field: "ExitCode", text: "126:0" }], explanation: "Cannot execute.", alternatives: [], missingEvidence: [], recommendations: [] };
  assert.throws(() => validateDiagnosis(diagnosis, { log: "Application exited", metadata: { ExitCode: "126:0" } }), /without a verified rule/);
});

test("redaction removes sensitive email, job ID, and user path", () => {
  const result = redactSensitive("me@asu.edu jobid=12345678 /scratch/ssaum/project");
  assert.equal(result.redactionCount, 3);
  assert.doesNotMatch(result.text, /ssaum|12345678|me@asu/);
});

test("redaction removes common tokens, secrets, and private-key blocks", () => {
  const text = "token=super-secret-value eyJabcdefghijk.abcdefghijklmnop.qrstuvwxyz12345\n-----BEGIN PRIVATE KEY-----\nsecretmaterial\n-----END PRIVATE KEY-----";
  const result = redactSensitive(text);
  assert.doesNotMatch(result.text, /super-secret|eyJabcdefghijk|secretmaterial/);
  assert.ok(result.redactionCount >= 3);
});

test("redaction preserves account error language while removing identifiers", () => {
  const result = redactSensitive("Invalid account or account/partition combination specified; account=grp_private");
  assert.match(result.text, /Invalid account or account\/partition combination specified/);
  assert.doesNotMatch(result.text, /grp_private/);
});

test("all seeded failure and control fixtures match deterministic categories", async () => {
  const cases = JSON.parse(await readFile(new URL("../fixtures/failure_cases.json", import.meta.url), "utf8"));
  for (const item of cases) assert.equal(deterministicFindings(item.log, item.metadata)[0]?.category || null, item.expectedCategory, item.id);
});

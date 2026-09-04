import test from "node:test";
import assert from "node:assert/strict";
import { beginnerWarnings, buildReadinessChecks, buildToolGuidance, deterministicScriptExplanations, resourceMetrics, validateScriptExplanations } from "../src/newcomer_guidance.mjs";
import { validateCorrections } from "../src/intake.mjs";
import { renderSlurmScript } from "../src/job_spec.mjs";
import { completeSpec } from "./fixtures.mjs";

test("resource calculator distinguishes tasks from CPUs per task", () => {
  const metrics = resourceMetrics({ ...completeSpec, workloadType: "distributed", nodes: 1, tasks: 16, cpus: 2, gpus: 0 });
  assert.deepEqual(metrics, { nodes: 1, tasks: 16, cpusPerTask: 2, totalCpuCores: 32, memoryPerTaskGb: 2, coreHours: 64, gpuHours: 0 });
});

test("readiness checks are generated only from validated specification values", () => {
  const checks = buildReadinessChecks(completeSpec);
  assert.ok(checks.some((item) => item.command === "test -d -- /scratch/demo/project && echo ready"));
  assert.ok(checks.some((item) => item.command === "command -v -- python"));
  assert.ok(checks.some((item) => item.command === "test -f -- train.py && echo ready"));
});

test("beginner checks explain common resource and environment risks", () => {
  const warnings = beginnerWarnings({ ...completeSpec, tasks: 16, cpus: 2, modules: [] });
  assert.ok(warnings.some((item) => /32 total CPU cores/.test(item)));
  assert.ok(warnings.some((item) => /No modules/.test(item)));
});

test("contextual ASU tools teach monitoring and safe Python environments", () => {
  const tools = buildToolGuidance({ ...completeSpec, modules: [] });
  for (const id of ["myjobs", "seff", "myaccounts", "myquota", "module-spider", "python-environment"]) assert.ok(tools.some((tool) => tool.id === id));
  const python = tools.find((tool) => tool.id === "python-environment");
  assert.match(python.label, /pip only inside/i);
  assert.match(python.command, /mamba\/latest/);
  for (const tool of tools) assert.equal(new URL(tool.source.url).hostname, "docs.rc.asu.edu");
});

test("script explanations must cover and quote every meaningful line exactly", () => {
  const script = renderSlurmScript(completeSpec);
  const explanations = deterministicScriptExplanations(script);
  assert.ok(explanations.some((item) => /CPUs per task/.test(item.newcomerTip)));
  assert.deepEqual(validateScriptExplanations({ explanations }, script), explanations);
  assert.throws(() => validateScriptExplanations({ explanations: [{ ...explanations[0], line: "invented" }] }, script), /every meaningful script line/);
});

test("typo corrections require exact source evidence and confirmation for identifiers", () => {
  const description = "Run an OpenFom simualtion from /scratch/demo/csae.";
  const corrections = validateCorrections(description, [
    { original: "OpenFom", suggested: "OpenFOAM", category: "software", confidence: "high", requiresConfirmation: false },
    { original: "simualtion", suggested: "simulation", category: "language", confidence: "high", requiresConfirmation: false },
    { original: "/scratch/demo/csae", suggested: "/scratch/demo/case", category: "identifier", confidence: "medium", requiresConfirmation: false },
    { original: "not present", suggested: "replacement", category: "language", confidence: "high", requiresConfirmation: false },
  ]);
  assert.deepEqual(corrections.map((item) => item.original), ["OpenFom", "simualtion"]);
});

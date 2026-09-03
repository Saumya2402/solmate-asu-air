import test from "node:test";
import assert from "node:assert/strict";
import { applyRepairPatch, isExactRenderedScript, renderSlurmScript } from "../src/job_spec.mjs";
import { completeSpec } from "./fixtures.mjs";

test("automatic repair requires exact app-rendered source", () => {
  const script = renderSlurmScript(completeSpec);
  assert.equal(isExactRenderedScript(completeSpec, script), true);
  assert.equal(isExactRenderedScript(completeSpec, `${script}\necho changed`), false);
});

test("repair permits resource fields and preserves command identity", () => {
  const result = applyRepairPatch(completeSpec, { memoryGb: 64 });
  assert.equal(result.spec.memoryGb, 64);
  assert.equal(result.spec.executable, completeSpec.executable);
  assert.deepEqual(result.spec.args, completeSpec.args);
  assert.match(result.script, /#SBATCH --mem=64G/);
});

test("repair rejects command and job-name changes", () => {
  assert.throws(() => applyRepairPatch(completeSpec, { executable: "other" }), /forbidden fields/);
  assert.throws(() => applyRepairPatch(completeSpec, { jobName: "other" }), /forbidden fields/);
});

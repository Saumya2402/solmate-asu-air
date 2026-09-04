import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeOutcomeHistory } from "../src/outcome_feedback.mjs";

test("outcome history keeps only bounded allowlisted scheduling context", () => {
  const history = sanitizeOutcomeHistory([
    { outcome: "succeeded", workloadType: "ml_training", software: "PyTorch", cpus: 8, gpus: 1, memoryGb: 64, nodes: 1, tasks: 1, walltime: "02:00:00", partition: "public", qos: "public", description: "private research", workingDirectory: "/scratch/person/project", note: "secret" },
    { outcome: "invented", workloadType: "general", cpus: 1 },
    { outcome: "runtime_failed", workloadType: "general", software: "bad name with spaces", cpus: 10_000_000 },
  ]);
  assert.equal(history.length, 2);
  assert.deepEqual(history[0], { outcome: "succeeded", workloadType: "ml_training", software: "PyTorch", cpus: 8, gpus: 1, memoryGb: 64, nodes: 1, tasks: 1, walltime: "02:00:00", partition: "public", qos: "public" });
  assert.deepEqual(history[1], { outcome: "runtime_failed", workloadType: "general" });
});

test("outcome history is capped at twelve recent records", () => {
  const history = sanitizeOutcomeHistory(Array.from({ length: 20 }, (_, index) => ({ outcome: "succeeded", workloadType: "general", cpus: index + 1 })));
  assert.equal(history.length, 12);
  assert.equal(history[0].cpus, 9);
});

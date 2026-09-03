import test from "node:test";
import assert from "node:assert/strict";
import { buildSolHandoff } from "../src/terminal_handoff.mjs";

const values = { asurite: "ssaum", localPath: "C:\\work\\image-training.slurm", remoteDirectory: "/scratch/ssaum/project", filename: "image-training.slurm" };

test("Sol handoff separates dry-run and submission", () => {
  const result = buildSolHandoff(values);
  assert.equal(result.valid, true);
  assert.equal(result.steps.find((step) => step.id === "dry-run").command, "sbatch --test-only image-training.slurm");
  assert.equal(result.steps.find((step) => step.id === "submit"), undefined);
  const acknowledged = buildSolHandoff({ ...values, acknowledged: true });
  assert.equal(acknowledged.steps.find((step) => step.id === "submit").command, "sbatch image-training.slurm");
  assert.equal(acknowledged.steps.find((step) => step.id === "submit").requiresAcknowledgement, true);
  assert.equal(result.steps.find((step) => step.id === "cancel").unresolved, true);
  const tracked = buildSolHandoff({ ...values, jobId: "12345" });
  assert.equal(tracked.steps.find((step) => step.id === "inspect").command, "scontrol show job 12345");
  assert.equal(tracked.steps.find((step) => step.id === "cancel").command, "scancel 12345");
});

test("Sol handoff rejects command injection and traversal", () => {
  assert.equal(buildSolHandoff({ ...values, filename: "job.slurm;rm" }).valid, false);
  assert.equal(buildSolHandoff({ ...values, remoteDirectory: "/scratch/ssaum/../other" }).valid, false);
  assert.equal(buildSolHandoff({ ...values, localPath: "job.slurm && whoami" }).valid, false);
  assert.equal(buildSolHandoff({ ...values, localPath: "job\".slurm" }).valid, false);
});

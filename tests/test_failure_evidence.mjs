import test from "node:test";
import assert from "node:assert/strict";
import { buildFailureEvidenceGuide } from "../src/failure_evidence.mjs";

test("finished-job evidence commands are one-line and job-specific", () => {
  const guide = buildFailureEvidenceGuide({ phase: "finished", jobId: "12345678" });
  assert.deepEqual(guide.commands.map((item) => item.id), ["queue", "efficiency", "accounting"]);
  assert.match(guide.commands.find((item) => item.id === "accounting").command, /--jobs=12345678 .*--parsable2$/);
  assert.ok(guide.commands.every((item) => !item.command.includes("\n")));
});

test("running-job guidance does not recommend incomplete accounting statistics", () => {
  const guide = buildFailureEvidenceGuide({ phase: "running", jobId: "123" });
  assert.deepEqual(guide.commands.map((item) => item.id), ["queue"]);
  assert.match(guide.notice, /not reliable while.*running/i);
});

test("submission checks work without a job ID and never submit", () => {
  const guide = buildFailureEvidenceGuide({ phase: "submission" });
  assert.ok(guide.commands.some((item) => item.command.startsWith("sbatch --test-only")));
  assert.ok(guide.commands.every((item) => !/^sbatch (?!.*--test-only)/.test(item.command)));
});

test("job IDs cannot inject shell content", () => {
  for (const jobId of ["123; whoami", "$HOME", "123_4", "-1", ""]) {
    assert.throws(() => buildFailureEvidenceGuide({ phase: "finished", jobId }), /only digits/);
  }
});

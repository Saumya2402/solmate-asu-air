import test from "node:test";
import assert from "node:assert/strict";
import { buildDocumentedDiagnosisDemo } from "../src/diagnosis_demo.mjs";
import { deterministicFindings } from "../src/diagnosis.mjs";

test("documented Sol demo is a valid command-not-found diagnosis case", () => {
  const demo = buildDocumentedDiagnosisDemo();
  assert.equal(demo.synthetic, true);
  assert.match(demo.script, /^#!\/bin\/bash/);
  assert.match(demo.script, /#SBATCH --partition=public/);
  assert.match(demo.script, /python train\.py --epochs 10/);
  assert.match(demo.log, /python: command not found/);
  assert.equal(demo.metadata.ExitCode, "127:0");
  assert.equal(deterministicFindings(demo.log, demo.metadata)[0].category, demo.expectedCategory);
  assert.deepEqual(demo.sources.map((source) => new URL(source.url).hostname), ["docs.rc.asu.edu", "docs.rc.asu.edu", "docs.rc.asu.edu"]);
});

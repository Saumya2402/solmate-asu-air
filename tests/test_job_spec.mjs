import test from "node:test";
import assert from "node:assert/strict";
import { extractJsonObject, renderSlurmScript, validateJobSpec } from "../src/job_spec.mjs";

const validSpec = {
  jobName: "image-training",
  cpus: 8,
  gpus: 1,
  memoryGb: 32,
  walltime: "02:00:00",
  partition: "",
  modules: ["python", "cuda"],
  executable: "python",
  args: ["train.py", "--epochs", "10"],
  rationale: "This is a conservative starting allocation for a small training workload.",
};

test("extractJsonObject accepts fenced model output", () => {
  assert.deepEqual(extractJsonObject(`Here is the result:\n\`\`\`json\n${JSON.stringify(validSpec)}\n\`\`\``), validSpec);
});

test("extractJsonObject accepts the first balanced object when a model adds another", () => {
  assert.deepEqual(extractJsonObject('Result: {"status":"ok","text":"brace } in text"}\n{"extra":true}'), { status: "ok", text: "brace } in text" });
});

test("extractJsonObject rejects a truncated object clearly", () => {
  assert.throws(() => extractJsonObject('{"status":"incomplete"'), /complete JSON object/);
});

test("validateJobSpec accepts a safe specification", () => {
  assert.deepEqual(validateJobSpec(validSpec), { valid: true, errors: [], warnings: [] });
});

test("validateJobSpec rejects unsafe and malformed fields", () => {
  const result = validateJobSpec({
    ...validSpec,
    jobName: "bad name; rm",
    cpus: 0,
    executable: "python\nmalicious-command",
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.startsWith("jobName")));
  assert.ok(result.errors.some((error) => error.startsWith("cpus")));
  assert.ok(result.errors.some((error) => error.startsWith("executable")));
});

test("renderSlurmScript produces controlled directives and command", () => {
  const script = renderSlurmScript(validSpec);
  assert.match(script, /#SBATCH --cpus-per-task=8/);
  assert.match(script, /#SBATCH --gres=gpu:1/);
  assert.match(script, /module load cuda/);
  assert.match(script, /srun python train\.py --epochs 10/);
});

test("renderSlurmScript refuses invalid specifications", () => {
  assert.throws(() => renderSlurmScript({ ...validSpec, walltime: "two hours" }), /Cannot render invalid/);
});

test("simulation MPI jobs keep tasks separate from CPUs per task", () => {
  const spec = { ...validSpec, workloadType: "simulation", nodes: 1, tasks: 16, cpus: 1 };
  assert.equal(validateJobSpec(spec, { requireComplete: true }).valid, false);
  const complete = { ...spec, cluster: "sol", workingDirectory: "/scratch/demo", outputPath: "slurm.%j.out", errorPath: "slurm.%j.err", partition: "public", qos: "public" };
  assert.equal(validateJobSpec(complete, { requireComplete: true }).valid, true);
  assert.match(renderSlurmScript(complete), /#SBATCH --ntasks=16/);
  assert.match(renderSlurmScript(complete), /#SBATCH --cpus-per-task=1/);
});

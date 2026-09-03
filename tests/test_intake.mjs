import test from "node:test";
import assert from "node:assert/strict";
import { buildReadySpec, durationToWalltime, missingFields, normalizeAirFacts, normalizeExplicitFacts, normalizeIntakeAnalysis, validatePlausibilityCandidate } from "../src/intake.mjs";
import { completeSpec } from "./fixtures.mjs";

test("missing fields preserve explicit zero GPUs", () => {
  assert.ok(!missingFields({ ...completeSpec, gpus: 0 }).includes("gpus"));
});

test("ML training requires epochs unless externally configured", () => {
  assert.ok(missingFields({ ...completeSpec, epochs: undefined }).includes("epochs"));
  assert.ok(!missingFields({ ...completeSpec, epochs: undefined, epochsConfiguredExternally: true }).includes("epochs"));
});

test("recommendations require confirmation provenance", () => {
  const result = buildReadySpec({ values: completeSpec, confirmedRecommendationFields: ["cpus", "memoryGb"] });
  assert.equal(result.ready, true);
  assert.equal(result.spec.provenance.cpus, "air_recommended_user_confirmed");
  assert.equal(result.spec.provenance.gpus, "user_provided");
});

test("absurd CPU request is rejected", () => {
  const result = validatePlausibilityCandidate("cpus", 10_000_000);
  assert.equal(result.valid, false);
  assert.match(result.error, /4096/);
});

test("explicit resource facts are normalized without guessing", () => {
  const result = normalizeExplicitFacts("Run on Sol with 4 CPUs, no GPU, 16 GB memory, and one hour.", {}, "general");
  assert.deepEqual({ cluster: result.cluster, cpus: result.cpus, gpus: result.gpus, memoryGb: result.memoryGb, walltime: result.walltime }, { cluster: "sol", cpus: 4, gpus: 0, memoryGb: 16, walltime: "01:00:00" });
  assert.equal(result.partition, undefined);
});

test("natural durations are converted to Slurm walltime", () => {
  assert.equal(durationToWalltime("5000 minutes"), "83:20:00");
  assert.equal(durationToWalltime("1 day, 2 hours and 30 minutes"), "26:30:00");
  assert.equal(durationToWalltime("2.5 hours"), "02:30:00");
  assert.equal(durationToWalltime("5000"), null);
  const transcript = "Use 2 hours initially. Additional detail from the researcher: total training time is around 5000 minutes.";
  assert.equal(normalizeExplicitFacts(transcript, {}, "ml_training").walltime, "83:20:00");
});

test("ready specifications normalize a duration entered directly", () => {
  const result = buildReadySpec({ values: { ...completeSpec, walltime: "90 minutes" } });
  assert.equal(result.ready, true);
  assert.equal(result.spec.walltime, "01:30:00");
});

test("planner workload labels and null-like recommendations are normalized", () => {
  const result = normalizeIntakeAnalysis({ workloadType: "python_analysis", extracted: {}, missingFields: [], recommendations: [{ field: "args", value: "null", rationale: "No script was supplied in the request.", uncertainty: "high" }] });
  assert.equal(result.workloadType, "general");
  assert.deepEqual(result.recommendations, []);
});

test("OpenFOAM language extracts a safe job name and explicit resources", () => {
  const result = normalizeExplicitFacts("Run an OpenFoam case with 32gb memory, 1cpu, 1gpu for 2 hours on Sol. name the job openfoam_v13_naca0012", {}, "simulation");
  assert.equal(result.software, "OpenFOAM");
  assert.equal(result.jobName, "openfoam_v13_naca0012");
  assert.equal(result.cpus, 1);
  assert.equal(result.gpus, 1);
  assert.equal(result.memoryGb, 32);
  assert.equal(result.walltime, "02:00:00");
  assert.equal(result.partition, undefined);
});

test("quoted and conversational job names are recognized", () => {
  assert.equal(normalizeExplicitFacts('Run a case and name the job "OF13".', {}, "simulation").jobName, "OF13");
  assert.equal(normalizeExplicitFacts("Run another case and call it OF14.", {}, "simulation").jobName, "OF14");
  assert.equal(normalizeExplicitFacts("Run pimpleFoam as job of13.", {}, "simulation").jobName, "of13");
  assert.equal(normalizeExplicitFacts("Run an image training.py job called imagev3, on Sol.", {}, "ml_training").jobName, "imagev3");
  assert.equal(normalizeExplicitFacts("This job should be named batch_07.", {}, "general").jobName, "batch_07");
  assert.equal(normalizeExplicitFacts("Use final-run as the job name.", {}, "general").jobName, "final-run");
});

test("reported follow-up transcript extracts job, path, CPU per task, and MPI tasks", () => {
  const transcript = `I want to run an OpenFoam simulation on Sol with a cpu, a gpu, 32gb memory, and 2 hour run time.

Additional detail from the researcher: pimpleFoam with around 500,000 mesh cells.

Additional detail from the researcher: we can do parallel, and that should be MPI n=16.

Additional detail from the researcher: path is /scratch/asurite/sparky and the job name should be of13.`;
  const result = normalizeExplicitFacts(transcript, {}, "simulation");
  assert.deepEqual(
    { jobName: result.jobName, workingDirectory: result.workingDirectory, cpus: result.cpus, gpus: result.gpus, tasks: result.tasks, memoryGb: result.memoryGb, walltime: result.walltime },
    { jobName: "of13", workingDirectory: "/scratch/asurite/sparky", cpus: 1, gpus: 1, tasks: 16, memoryGb: 32, walltime: "02:00:00" },
  );
});

test("OpenFOAM parallel CPU language and file location map to Slurm semantics", () => {
  const description = "I want to run an OpenFoam simulation on Sol with 32gb memory and 16 cpus for a parallel run. I need to use the file in /scratch/asurite/sparky. The mesh is 500,000 cells.";
  const result = normalizeExplicitFacts(description, {}, "simulation");
  assert.equal(result.workingDirectory, "/scratch/asurite/sparky");
  assert.equal(result.memoryGb, 32);
  assert.equal(result.tasks, 16);
  assert.equal(result.cpus, 1);
});

test("later conversational values override earlier explicit values", () => {
  const result = normalizeExplicitFacts("Use one CPU and name the job first. Additional detail: actually use 4 CPUs and the job name should be final.", {}, "general");
  assert.equal(result.cpus, 4);
  assert.equal(result.jobName, "final");
});

test("AIR facts enter the specification only with verbatim user evidence", () => {
  const description = 'Use a CPU. Path is /scratch/asurite/sparky and the job name should be of13. MPI n=16.';
  const result = normalizeAirFacts(description, { facts: [
    { field: "cpus", value: 1, quote: "a CPU" },
    { field: "workingDirectory", value: "/scratch/asurite/sparky", quote: "Path is /scratch/asurite/sparky" },
    { field: "jobName", value: "of13", quote: "the job name should be of13" },
    { field: "tasks", value: 16, quote: "MPI n=16" },
    { field: "nodes", value: 16, quote: "MPI n=16" },
    { field: "qos", value: "invented", quote: "MPI n=16" },
  ] });
  assert.deepEqual(result.extracted, { cpus: 1, workingDirectory: "/scratch/asurite/sparky", jobName: "of13", tasks: 16 });
  assert.ok(result.evidence.every((item) => description.includes(item.quote)));
});

test("AIR facts accept an explicitly supplied standalone Linux working path", () => {
  const description = "Additional detail from the researcher: /scratch/asurite/sparky";
  const result = normalizeAirFacts(description, { facts: [
    { field: "workingDirectory", value: "/scratch/asurite/sparky", quote: "/scratch/asurite/sparky" },
  ] });
  assert.equal(result.extracted.workingDirectory, "/scratch/asurite/sparky");
});

test("AIR facts reject a job name fabricated by joining separate user values", () => {
  const description = "Path is /scratch/asurite/sparky and the job name should be of13.";
  const result = normalizeAirFacts(description, { facts: [
    { field: "jobName", value: "of13sparky", quote: "Path is /scratch/asurite/sparky and the job name should be of13" },
  ] });
  assert.equal(result.extracted.jobName, undefined);
});

test("AIR facts reject numeric values that contradict their quoted evidence", () => {
  const result = normalizeAirFacts("Use 1 CPU and MPI n=16.", { facts: [
    { field: "cpus", value: 64, quote: "1 CPU" },
    { field: "tasks", value: 8, quote: "MPI n=16" },
  ] });
  assert.deepEqual(result.extracted, {});
});

test("AIR facts require canonical walltime to match the quoted duration", () => {
  const result = normalizeAirFacts("The runtime should be 2 hours.", { facts: [
    { field: "walltime", value: "99:00:00", quote: "runtime should be 2 hours" },
    { field: "walltime", value: "02:00:00", quote: "runtime should be 2 hours" },
  ] });
  assert.equal(result.extracted.walltime, "02:00:00");
});

test("AIR walltime evidence is canonicalized even when the model returns raw minutes", () => {
  const result = normalizeAirFacts("total training time is around 5000 minutes", { facts: [
    { field: "walltime", value: "5000", quote: "total training time is around 5000 minutes" },
  ] });
  assert.equal(result.extracted.walltime, "83:20:00");
});

test("AIR may derive one CPU per task from equal total CPUs and MPI ranks", () => {
  const quote = "16 CPUs since I want a parallel MPI run with n=16";
  const result = normalizeAirFacts(quote, { facts: [
    { field: "cpus", value: 1, quote },
    { field: "tasks", value: 16, quote: "MPI run with n=16" },
  ] });
  assert.equal(result.extracted.cpus, 1);
  assert.equal(result.extracted.tasks, 16);
});

test("Sol class QoS limits are deterministic", () => {
  const result = buildReadySpec({ values: { ...completeSpec, qos: "class", account: "class_asu101", cpus: 33 }, confirmedRecommendationFields: [] });
  assert.equal(result.ready, false);
  assert.ok(result.validation.errors.some((item) => /sol-public-class limit of 32/.test(item)));
});

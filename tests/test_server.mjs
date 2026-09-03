import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createAppServer } from "../src/server.mjs";
import { MockGateway } from "../src/mock_gateway.mjs";
import { completeSpec } from "./fixtures.mjs";

test("HTTP API exposes health, intake, generation, handoff, and diagnosis", async (context) => {
  const { server } = createAppServer({ mode: "mock", gateway: new MockGateway() });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body) => fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const health = await (await fetch(`${base}/api/health`)).json();
  assert.equal(health.mode, "mock");
  assert.equal(health.rulesVersion, "2026-09-02");
  assert.ok(health.schedulerOptions.some((item) => item.cluster === "sol" && item.partition === "public" && item.qos === "public"));
  const intakeResponse = await post("/api/intake", { description: "Train a PyTorch model on Sol." });
  assert.equal(intakeResponse.status, 200);
  const intakePayload = await intakeResponse.json();
  assert.equal(intakePayload.analysis.workloadType, "ml_training");
  const suggestedFields = new Set(intakePayload.analysis.recommendations.map((item) => item.field));
  for (const field of ["jobName", "outputPath", "errorPath", "partition", "qos"]) assert.ok(suggestedFields.has(field));
  const carriedResponse = await post("/api/intake", {
    description: "Run a job on Sol with 1 CPU. Additional detail from the researcher: use 2 hours.",
    priorFacts: [{ field: "cpus", value: 1, quote: "1 CPU" }],
    priorRecommendationToken: intakePayload.recommendationToken,
  });
  assert.equal(carriedResponse.status, 200);
  assert.equal((await carriedResponse.json()).analysis.extracted.cpus, 1);
  const invalidResponse = await post("/api/intake", { description: "Run a large job on Sol.", values: { cpus: 10_000_000 } });
  assert.equal(invalidResponse.status, 422);
  assert.equal((await invalidResponse.json()).field, "cpus");
  const generateResponse = await post("/api/generate", { description: "Train a PyTorch model on Sol.", spec: completeSpec });
  assert.equal(generateResponse.status, 200);
  assert.match((await generateResponse.json()).script, /#SBATCH --partition=public/);
  const handoffResponse = await post("/api/handoff", { asurite: "ssaum", localPath: "C:\\work\\image-training.slurm", remoteDirectory: "/scratch/ssaum/project", filename: "image-training.slurm" });
  assert.equal(handoffResponse.status, 200);
  const handoffPayload = await handoffResponse.json();
  assert.equal(handoffPayload.steps.some((step) => step.id === "submit"), false);
  assert.equal(typeof handoffPayload.acknowledgementToken, "string");
  const acknowledgedResponse = await post("/api/handoff", { asurite: "ssaum", localPath: "C:\\work\\image-training.slurm", remoteDirectory: "/scratch/ssaum/project", filename: "image-training.slurm", acknowledged: true, acknowledgementToken: handoffPayload.acknowledgementToken });
  assert.equal(acknowledgedResponse.status, 200);
  assert.equal((await acknowledgedResponse.json()).steps.some((step) => step.id === "submit"), true);
  const changedResponse = await post("/api/handoff", { asurite: "ssaum", localPath: "C:\\work\\image-training.slurm", remoteDirectory: "/scratch/ssaum/other", filename: "image-training.slurm", acknowledged: true, acknowledgementToken: handoffPayload.acknowledgementToken });
  assert.equal(changedResponse.status, 400);
  const diagnosisResponse = await post("/api/diagnose", { cluster: "sol", log: "slurmstepd: error: Detected oom_kill event", metadata: { State: "OUT_OF_MEMORY" } });
  assert.equal(diagnosisResponse.status, 200);
  assert.equal((await diagnosisResponse.json()).diagnosis.confidence, "confirmed");
});

test("HTTP API rejects missing JSON content type", async (context) => {
  const { server } = createAppServer({ mode: "mock", gateway: new MockGateway() });
  server.listen(0, "127.0.0.1"); await once(server, "listening"); context.after(() => server.close());
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/intake`, { method: "POST", body: "{}" });
  assert.equal(response.status, 400);
});

test("HTTP API rejects forged recommendation confirmation", async (context) => {
  const { server } = createAppServer({ mode: "mock", gateway: new MockGateway() });
  server.listen(0, "127.0.0.1"); await once(server, "listening"); context.after(() => server.close());
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/generate`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description: "Train a PyTorch model on Sol.", spec: completeSpec, confirmedRecommendationFields: ["jobName"], recommendationToken: "forged.token" }),
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "INVALID_REQUEST");
  const intakeResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/intake`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description: "Train a PyTorch model on Sol.", priorRecommendationToken: "forged.token" }),
  });
  assert.equal(intakeResponse.status, 400);
});

test("HTTP API classifies malformed AIR output as an upstream failure", async (context) => {
  const gateway = { async chat() { return { model: "broken", content: "not json" }; } };
  const { server } = createAppServer({ mode: "mock", gateway });
  server.listen(0, "127.0.0.1"); await once(server, "listening"); context.after(() => server.close());
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/intake`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: "Run a Python workload on Sol." }),
  });
  assert.equal(response.status, 502);
  assert.equal((await response.json()).code, "AIR_UPSTREAM_RESPONSE");
});

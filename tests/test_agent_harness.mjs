import test from "node:test";
import assert from "node:assert/strict";
import { AgentHarness } from "../src/agent_harness.mjs";
import { AirClient } from "../src/air_client.mjs";
import { MockGateway } from "../src/mock_gateway.mjs";
import { completeSpec } from "./fixtures.mjs";
import { renderSlurmScript } from "../src/job_spec.mjs";

test("agent harness returns missing fields before generation", async () => {
  const harness = new AgentHarness({ gateway: new MockGateway() });
  const result = await harness.generate("Train a PyTorch model with one GPU for two hours.");
  assert.equal(result.status, "needs_input");
  assert.equal(result.script, null);
  assert.ok(result.recommendations.length > 0);
});

test("deterministic intake overrides a model's false completeness claim", async () => {
  const gateway = { async chat({ messages }) {
    const system = messages[0].content;
    if (system.includes("fact extractor")) return { model: "test", content: JSON.stringify({ facts: [{ field: "cluster", value: "sol", quote: "Sol" }] }) };
    return { model: "test", content: JSON.stringify({ workloadType: "general", workflowSummary: "Run a Python analysis on Sol.", extracted: {}, extractedEvidence: [], missingFields: [], recommendations: [], domainQuestions: [], detectedConflicts: [] }) };
  } };
  const result = await new AgentHarness({ gateway }).intake("Run a Python analysis on Sol.");
  assert.ok(result.analysis.missingFields.includes("cpus"));
  assert.ok(result.analysis.missingFields.includes("executable"));
});

test("deterministic intake converts a minute-based follow-up to Slurm walltime", async () => {
  const gateway = { async chat({ messages }) {
    const system = messages[0].content;
    if (system.includes("fact extractor")) return { model: "test", content: JSON.stringify({ facts: [{ field: "cluster", value: "sol", quote: "Sol" }, { field: "walltime", value: "5000", quote: "5000 minutes" }] }) };
    if (system.includes("typo reviewer")) return { model: "test", content: JSON.stringify({ corrections: [] }) };
    if (system.includes("completion advisor")) return { model: "test", content: JSON.stringify({ suggestions: {}, reasons: {} }) };
    if (system.includes("scheduler-profile selector")) return { model: "test", content: JSON.stringify({ partition: "public", qos: "public", reason: "Use the documented general-purpose profile." }) };
    if (system.includes("job-recommendation critic")) return { model: "test", content: JSON.stringify({ verdict: "approve", reviews: [{ field: "partition", decision: "approve", reason: "Exact profile." }, { field: "qos", decision: "approve", reason: "Exact profile." }], findings: [], profilingProfile: "none" }) };
    return { model: "test", content: JSON.stringify({ workloadType: "ml_training", software: "PyTorch", workflowSummary: "Train a model on Sol.", recommendationBasis: "The duration is explicit.", corrections: [], nextQuestion: null, extracted: {}, extractedEvidence: [], missingFields: [], recommendations: [], domainQuestions: [], detectedConflicts: [] }) };
  } };
  const result = await new AgentHarness({ gateway, schedulerProfiles: [{ cluster: "sol", partition: "public", qos: "public", limits: { walltimeHours: 168 } }] }).intake("Train a model on Sol. Additional detail from the researcher: total training time is around 5000 minutes.");
  assert.equal(result.analysis.extracted.walltime, "83:20:00");
  assert.equal(result.analysis.missingFields.includes("walltime"), false);
});

test("AIR intake recognizes OpenFOAM, its job name, and GPU execution risk", async () => {
  const harness = new AgentHarness({ gateway: new MockGateway() });
  const result = await harness.intake("I want to run an OpenFoam simulation with 32gb memory, 1cpu, 1gpu for 2 hours, on the general sol cluster. name the job openfoam_v13_naca0012");
  assert.equal(result.analysis.workloadType, "simulation");
  assert.equal(result.analysis.software, "OpenFOAM");
  assert.equal(result.analysis.extracted.jobName, "openfoam_v13_naca0012");
  assert.deepEqual(
    { cpus: result.analysis.extracted.cpus, gpus: result.analysis.extracted.gpus, memoryGb: result.analysis.extracted.memoryGb, walltime: result.analysis.extracted.walltime },
    { cpus: 1, gpus: 1, memoryGb: 32, walltime: "02:00:00" },
  );
  assert.ok(result.analysis.detectedConflicts.some((item) => /GPU/i.test(item.message)));
  assert.ok(result.analysis.domainQuestions.some((item) => /solver/i.test(item)));
  assert.ok(result.analysis.missingFields.includes("partition"));
});

test("AIR intake asks a prioritized question and explains recommendation basis", async () => {
  const result = await new AgentHarness({ gateway: new MockGateway() }).intake('Run an OpenFOAM case on Sol and name the job "OF13".');
  assert.equal(result.analysis.extracted.jobName, "OF13");
  assert.match(result.analysis.nextQuestion, /solver/i);
  assert.match(result.analysis.recommendationBasis, /solver|mesh/i);
  assert.equal(result.analysis.recommendations.length, 0);

  const informed = await new AgentHarness({ gateway: new MockGateway() }).intake('Run an OpenFOAM simpleFoam case with 2 million cells on Sol and name the job "OF13".');
  assert.ok(informed.analysis.recommendations.length > 0);
  assert.ok(informed.analysis.recommendations.every((item) => item.assumptions.length && item.tuningAdvice));
  assert.match(informed.analysis.nextQuestion, /MPI|serial/i);
  assert.doesNotMatch(informed.analysis.nextQuestion, /which.*solver/i);
});

test("OpenFOAM follow-up advances to a GPU compatibility decision after solver and mesh answers", async () => {
  const result = await new AgentHarness({ gateway: new MockGateway() }).intake("Run pimpleFoam with 500,000 mesh cells on Sol using 1 CPU and 1 GPU for 2 hours with 32 GB memory.");
  assert.match(result.analysis.nextQuestion, /GPU-enabled/i);
  assert.ok(result.analysis.domainQuestions.every((item) => !/which.*solver|mesh.*cells/i.test(item)));
});

test("verified facts survive a later partial AIR extraction and newer facts are added", async () => {
  let extractorCalls = 0;
  const gateway = { async chat({ messages }) {
    const system = messages[0].content;
    if (system.includes("fact extractor")) {
      extractorCalls += 1;
      const facts = extractorCalls === 1
        ? [
            { field: "cluster", value: "sol", quote: "Sol" },
            { field: "cpus", value: 1, quote: "a CPU" },
            { field: "gpus", value: 1, quote: "a GPU" },
            { field: "tasks", value: 16, quote: "MPI n=16" },
            { field: "jobName", value: "of13", quote: "job name should be of13" },
          ]
        : [{ field: "workingDirectory", value: "/scratch/asurite/sparky", quote: "/scratch/asurite/sparky" }];
      return { model: "extractor-test", latencyMs: 1, content: JSON.stringify({ facts }) };
    }
    return { model: "planner-test", latencyMs: 1, content: JSON.stringify({
      workloadType: "simulation", software: "OpenFOAM", workflowSummary: "Run an OpenFOAM case.", recommendationBasis: "The case scale remains uncertain.", nextQuestion: null,
      extracted: {}, extractedEvidence: [], missingFields: [], recommendations: [], domainQuestions: [], detectedConflicts: [],
    }) };
  } };
  const harness = new AgentHarness({ gateway });
  const firstDescription = "Run OpenFOAM on Sol with a CPU, a GPU, MPI n=16, and the job name should be of13.";
  const first = await harness.intake(firstDescription);
  const priorFacts = first.analysis.extractedEvidence.map(({ field, quote }) => ({ field, quote, value: first.analysis.extracted[field] }));
  const second = await harness.intake(`${firstDescription}\n\nAdditional detail from the researcher: /scratch/asurite/sparky`, { priorFacts });
  assert.deepEqual(
    { cluster: second.analysis.extracted.cluster, cpus: second.analysis.extracted.cpus, gpus: second.analysis.extracted.gpus, tasks: second.analysis.extracted.tasks, jobName: second.analysis.extracted.jobName, workingDirectory: second.analysis.extracted.workingDirectory },
    { cluster: "sol", cpus: 1, gpus: 1, tasks: 16, jobName: "of13", workingDirectory: "/scratch/asurite/sparky" },
  );
});

test("newer verified AIR facts override prior values", async () => {
  const gateway = { async chat({ messages }) {
    const system = messages[0].content;
    if (system.includes("fact extractor")) return { model: "extractor-test", latencyMs: 1, content: JSON.stringify({ facts: [{ field: "cpus", value: 4, quote: "actually use 4 CPUs" }] }) };
    return { model: "planner-test", latencyMs: 1, content: JSON.stringify({ workloadType: "general", workflowSummary: "Run a job.", recommendationBasis: "Resources were supplied.", nextQuestion: null, extracted: {}, extractedEvidence: [], missingFields: [], recommendations: [], domainQuestions: [], detectedConflicts: [] }) };
  } };
  const description = "Use 1 CPU; actually use 4 CPUs.";
  const result = await new AgentHarness({ gateway }).intake(description, { priorFacts: [{ field: "cpus", value: 1, quote: "1 CPU" }] });
  assert.equal(result.analysis.extracted.cpus, 4);
});

test("general Sol cluster is Sol evidence and never partition evidence", async () => {
  const gateway = { async chat({ messages }) {
    const system = messages[0].content;
    if (system.includes("fact extractor")) return { model: "extractor-test", latencyMs: 1, content: JSON.stringify({ facts: [
      { field: "cluster", value: "sol", quote: "general Sol cluster" },
      { field: "partition", value: "general", quote: "general Sol cluster" },
    ] }) };
    return { model: "planner-test", latencyMs: 1, content: JSON.stringify({ workloadType: "general", workflowSummary: "Run a general job on Sol.", recommendationBasis: "The partition remains unknown.", nextQuestion: "Which partition is available?", extracted: {}, extractedEvidence: [], missingFields: [], recommendations: [], domainQuestions: [], detectedConflicts: [] }) };
  } };
  const result = await new AgentHarness({ gateway }).intake("Run this workload on the general Sol cluster.");
  assert.equal(result.analysis.extracted.cluster, "sol");
  assert.equal(result.analysis.extracted.partition, undefined);
  assert.ok(result.analysis.missingFields.includes("partition"));
});

test("AIR completion advisor proposes editable naming and a supported scheduler pair", async () => {
  const schedulerProfiles = [{ id: "sol-public-public", cluster: "sol", partition: "public", qos: "public", limits: { walltimeHours: 168 } }];
  const result = await new AgentHarness({ gateway: new MockGateway(), schedulerProfiles }).intake("Run an OpenFOAM pimpleFoam simulation on Sol for 2 hours with 16 GB memory.");
  const recommendations = Object.fromEntries(result.analysis.recommendations.map((item) => [item.field, item.value]));
  assert.equal(recommendations.jobName, "openfoam-job");
  assert.equal(recommendations.outputPath, "%x.%j.out");
  assert.equal(recommendations.errorPath, "%x.%j.err");
  assert.equal(recommendations.partition, "public");
  assert.equal(recommendations.qos, "public");
  assert.equal(result.analysis.extracted.jobName, undefined);
});

test("completion advisor cannot invent an unavailable module name", async () => {
  const schedulerProfiles = [{ id: "sol-public-public", cluster: "sol", partition: "public", qos: "public", limits: { walltimeHours: 168 } }];
  const gateway = { async chat({ messages }) {
    const system = messages[0].content;
    if (system.includes("fact extractor")) return { model: "test", content: JSON.stringify({ facts: [{ field: "cluster", value: "sol", quote: "Sol" }] }) };
    if (system.includes("typo reviewer")) return { model: "test", content: JSON.stringify({ corrections: [] }) };
    if (system.includes("completion advisor")) return { model: "test", content: JSON.stringify({ suggestions: { modules: ["pytorch"] }, reasons: { modules: "Load the framework module before running." } }) };
    if (system.includes("scheduler-profile selector")) return { model: "test", content: JSON.stringify({ partition: null, qos: null, reason: "No scheduler selection is needed for this test." }) };
    return { model: "test", content: JSON.stringify({ workloadType: "ml_training", software: "PyTorch", workflowSummary: "Train an image classifier.", recommendationBasis: "Explicit training details were supplied.", corrections: [], nextQuestion: null, extracted: {}, extractedEvidence: [], missingFields: [], recommendations: [], domainQuestions: [], detectedConflicts: [] }) };
  } };
  const harness = new AgentHarness({ gateway, schedulerProfiles });
  const { analysis } = await harness.intake("Train image.py on Sol as job imagev3 from /scratch/demo/images with 8 CPUs, one GPU, 32 GB memory, 10 epochs, and two hours.");
  assert.equal(analysis.recommendations.some((item) => item.field === "modules" && item.value.includes("pytorch")), false);
});

test("a valid scheduler recommendation survives a follow-up advisor omission and critic outage", async () => {
  const schedulerProfiles = [{ id: "sol-public-public", cluster: "sol", partition: "public", qos: "public", limits: { walltimeHours: 168 } }];
  const gateway = { async chat({ messages }) {
    const system = messages[0].content;
    if (system.includes("fact extractor")) return { model: "test", content: JSON.stringify({ facts: [{ field: "cluster", value: "sol", quote: "Sol" }] }) };
    if (system.includes("typo reviewer")) return { model: "test", content: JSON.stringify({ corrections: [] }) };
    if (system.includes("completion advisor")) return { model: "test", content: JSON.stringify({ suggestions: {}, reasons: {} }) };
    if (system.includes("scheduler-profile selector")) return { model: "test", content: JSON.stringify({ partition: null, qos: null, reason: "No new selection returned." }) };
    if (system.includes("job-recommendation critic")) return { model: "test", content: JSON.stringify({ invalid: true }) };
    return { model: "test", content: JSON.stringify({ workloadType: "general", software: null, workflowSummary: "Run a Python analysis on Sol.", recommendationBasis: "The follow-up adds workload detail.", corrections: [], nextQuestion: null, extracted: {}, extractedEvidence: [], missingFields: [], recommendations: [], domainQuestions: [], detectedConflicts: [] }) };
  } };
  const result = await new AgentHarness({ gateway, schedulerProfiles }).intake("Run a Python analysis on Sol.", {
    priorRecommendations: { partition: "public", qos: "public" },
  });
  const scheduler = Object.fromEntries(result.analysis.recommendations.map((item) => [item.field, item.value]));
  assert.deepEqual(scheduler, { partition: "public", qos: "public" });
  assert.equal(result.analysis.recommendationReview.verdict, "unavailable");
});

test("resource critic withholds a recommendation built on contradictory assumptions", async () => {
  const gateway = { async chat({ messages }) {
    const system = messages[0].content;
    if (system.includes("fact extractor")) return { model: "extractor-test", content: JSON.stringify({ facts: [{ field: "cluster", value: "sol", quote: "Sol" }, { field: "software", value: "OpenFOAM", quote: "simpleFoam" }] }) };
    if (system.includes("scientific-computing planner")) return { model: "planner-test", content: JSON.stringify({
      workloadType: "simulation", software: "OpenFOAM", workflowSummary: "Run simpleFoam with 2 million cells.", recommendationBasis: "Solver and mesh size guide the estimate.", nextQuestion: "How long should the profiling run be?",
      extracted: {}, extractedEvidence: [], missingFields: [], domainQuestions: [], detectedConflicts: [],
      recommendations: [{ field: "memoryGb", value: 64, rationale: "Transient simulations need memory headroom.", uncertainty: "medium", assumptions: ["The simulation is transient."], tuningAdvice: "Measure MaxRSS." }]
    }) };
    return { model: "critic-test", content: JSON.stringify({ verdict: "revise", reviews: [{ field: "memoryGb", decision: "reject", reason: "simpleFoam is steady-state, so the transient assumption is unsupported." }], findings: ["The memory recommendation was withheld."], profilingProfile: "none" }) };
  } };
  const result = await new AgentHarness({ gateway }).intake("Run simpleFoam with 2 million cells on Sol.");
  assert.deepEqual(result.analysis.recommendations, []);
  assert.equal(result.analysis.recommendationReview.verdict, "revise");
  assert.ok(result.agents.some((agent) => agent.role === "resource_critic"));
});

test("resource critic can replace a rejected guess with a bounded profiling recommendation", async () => {
  const gateway = { async chat({ messages }) {
    const system = messages[0].content;
    if (system.includes("fact extractor")) return { model: "extractor-test", content: JSON.stringify({ facts: [{ field: "cluster", value: "sol", quote: "Sol" }, { field: "software", value: "OpenFOAM", quote: "simpleFoam" }] }) };
    if (system.includes("scientific-computing planner")) return { model: "planner-test", content: JSON.stringify({
      workloadType: "simulation", software: "OpenFOAM", workflowSummary: "Run simpleFoam with 2 million cells.", recommendationBasis: "Mesh size guides profiling.", nextQuestion: null,
      extracted: {}, extractedEvidence: [], missingFields: [], domainQuestions: [], detectedConflicts: [],
      recommendations: [{ field: "memoryGb", value: 64, rationale: "Assume a transient simulation needs extra memory.", uncertainty: "high", assumptions: ["Transient solver"], tuningAdvice: "Measure MaxRSS after the first run." }]
    }) };
    return { model: "critic-test", content: JSON.stringify({ verdict: "revise", reviews: [{ field: "memoryGb", decision: "reject", reason: "The transient assumption contradicts simpleFoam." }], findings: ["Replaced an unsupported estimate with a profiling profile."], profilingProfile: "openfoam_medium" }) };
  } };
  const result = await new AgentHarness({ gateway }).intake("Run simpleFoam with 2 million cells on Sol.");
  assert.equal(result.analysis.recommendations[0].value, 16);
});

test("resource critic retries once when its review schema is incomplete", async () => {
  let criticCalls = 0;
  const gateway = { async chat({ messages }) {
    const system = messages[0].content;
    if (system.includes("fact extractor")) return { model: "test", content: JSON.stringify({ facts: [{ field: "cluster", value: "sol", quote: "Sol" }] }) };
    if (system.includes("typo reviewer")) return { model: "test", content: JSON.stringify({ corrections: [] }) };
    if (system.includes("completion advisor") || system.includes("scheduler-profile selector")) return { model: "test", content: JSON.stringify({ recommendations: [] }) };
    if (system.includes("job-recommendation critic")) {
      criticCalls += 1;
      if (criticCalls === 1) return { model: "test", content: JSON.stringify({ verdict: "approve", reviews: [], findings: [], profilingProfile: "none" }) };
      return { model: "test", content: JSON.stringify({ verdict: "approve", reviews: [{ field: "cpus", decision: "approve", reason: "A small profiling request is appropriate." }], findings: [], profilingProfile: "none" }) };
    }
    return { model: "test", content: JSON.stringify({ workloadType: "general", software: null, workflowSummary: "Run a Python job.", recommendationBasis: "Begin with a profiling request.", corrections: [], nextQuestion: null, extracted: {}, extractedEvidence: [], missingFields: [], recommendations: [{ field: "cpus", value: 2, rationale: "A small CPU request is suitable for an initial profile.", uncertainty: "medium", assumptions: ["Input is small."], tuningAdvice: "Review CPU efficiency." }], domainQuestions: [], detectedConflicts: [] }) };
  } };
  const result = await new AgentHarness({ gateway }).intake("Run a Python workload on Sol and profile its CPU use.");
  assert.equal(criticCalls, 2);
  assert.equal(result.analysis.recommendations[0].field, "cpus");
});

test("agent harness validates, renders, and critiques a complete specification", async () => {
  const harness = new AgentHarness({ gateway: new MockGateway() });
  const result = await harness.generateSpec({ description: "Train a PyTorch model on Sol.", spec: completeSpec });
  assert.equal(result.status, "reviewed");
  assert.equal(result.validation.valid, true);
  assert.match(result.script, /#SBATCH --gres=gpu:1/);
  assert.equal(result.agents[0].role, "critic");
  assert.ok(result.agents.some((agent) => agent.role === "explainer"));
  assert.ok(result.explanations.length > 5);
  assert.equal(result.guidance.metrics.totalCpuCores, 8);
  assert.ok(result.guidance.readinessChecks.some((item) => /command -v/.test(item.command)));
});

test("AIR typo corrections remain evidence-bound and visible", async () => {
  const result = await new AgentHarness({ gateway: new MockGateway() }).intake("Run an OpenFom simualtion on Sol with 1 CPU and 8 GB memory.");
  assert.deepEqual(result.analysis.corrections.map((item) => item.suggested), ["OpenFOAM", "simulation"]);
  assert.equal(result.analysis.software, "OpenFOAM");
  assert.equal(result.analysis.workloadType, "simulation");
});

test("deterministic intake recovers job called when AIR omits the name", async () => {
  const gateway = { async chat({ messages }) {
    const system = messages[0].content;
    if (system.includes("fact extractor")) return { model: "test", content: JSON.stringify({ facts: [] }) };
    if (system.includes("typo reviewer")) return { model: "test", content: JSON.stringify({ corrections: [] }) };
    if (system.includes("completion advisor")) return { model: "test", content: JSON.stringify({ recommendations: [] }) };
    if (system.includes("scheduler-profile selector")) return { model: "test", content: JSON.stringify({ partition: null, qos: null, reason: "No profile selected." }) };
    return { model: "test", content: JSON.stringify({ workloadType: "ml_training", software: "PyTorch", workflowSummary: "Train an image model.", recommendationBasis: "Inputs are incomplete.", corrections: [], nextQuestion: null, extracted: {}, extractedEvidence: [], missingFields: [], recommendations: [], domainQuestions: [], detectedConflicts: [] }) };
  } };
  const result = await new AgentHarness({ gateway }).intake("I want to run a PyTorch image training.py job called imagev3, it is in /scratch/asurite/sparkyimages.");
  assert.equal(result.analysis.extracted.jobName, "imagev3");
  assert.equal(result.analysis.extractedEvidence.find((item) => item.field === "jobName").quote, "job called imagev3");
});

test("agent harness rejects descriptions that are too short", async () => {
  const harness = new AgentHarness({ gateway: new MockGateway() });
  await assert.rejects(() => harness.intake("short"), /at least 10/);
});

test("planner performs a compact full retry after malformed output and failed repair", async () => {
  let plannerCalls = 0;
  const gateway = { async chat({ messages }) {
    const system = messages[0].content;
    if (system.includes("fact extractor")) return { model: "test", content: JSON.stringify({ facts: [{ field: "cluster", value: "sol", quote: "Sol" }] }) };
    if (system.includes("typo reviewer")) return { model: "test", content: JSON.stringify({ corrections: [] }) };
    if (system.includes("valid JSON object preserving")) return { model: "test", content: '{"workloadType":"general"' };
    plannerCalls += 1;
    if (plannerCalls === 1) return { model: "test", content: '{"workloadType":"general"' };
    return { model: "test", content: JSON.stringify({ workloadType: "general", workflowSummary: "Run a Python analysis on Sol.", recommendationBasis: "Input scale remains unknown.", nextQuestion: "What input size will be processed?", extracted: { cluster: "sol" }, extractedEvidence: [{ field: "cluster", quote: "Sol" }], missingFields: [], recommendations: [], domainQuestions: [], detectedConflicts: [] }) };
  } };
  const result = await new AgentHarness({ gateway }).intake("Run a Python analysis on Sol.");
  assert.equal(plannerCalls, 2);
  assert.equal(result.analysis.extracted.cluster, "sol");
});

test("AIR client uses documented endpoint, bearer authorization, and latency metadata", async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options };
    return { ok: true, async json() { return { model: "test-model", choices: [{ message: { content: "ok" } }] }; } };
  };
  const client = new AirClient({ apiKey: "test-only-key", fetchImpl, retries: 0 });
  const result = await client.chat({ model: "test-model", messages: [{ role: "user", content: "hello" }] });
  assert.equal(request.url, "https://openai.rc.asu.edu/v1/chat/completions");
  assert.equal(request.options.headers.Authorization, "Bearer test-only-key");
  assert.equal(result.content, "ok");
  assert.equal(typeof result.latencyMs, "number");
});

test("AIR client retries one transient response without exposing its body", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) return { ok: false, status: 429 };
    return { ok: true, async json() { return { choices: [{ message: { content: "ok" } }] }; } };
  };
  const client = new AirClient({ apiKey: "test-only-key", fetchImpl, retries: 1, retryDelayMs: 0 });
  assert.equal((await client.chat({ model: "test", messages: [{ role: "user", content: "hello" }] })).content, "ok");
  assert.equal(calls, 2);
});

test("AIR client reports timeout, authentication, malformed payload, and empty completion", async () => {
  const timeoutFetch = async (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => {
    const error = new Error("aborted"); error.name = "AbortError"; reject(error);
  }, { once: true }));
  await assert.rejects(new AirClient({ apiKey: "test", fetchImpl: timeoutFetch, timeoutMs: 5, retries: 0 }).chat({ model: "test", messages: [{ role: "user", content: "hello" }] }), /timed out/);

  const unauthorized = new AirClient({ apiKey: "test", retries: 0, fetchImpl: async () => ({ ok: false, status: 401 }) });
  await assert.rejects(unauthorized.chat({ model: "test", messages: [{ role: "user", content: "hello" }] }), /HTTP 401/);

  const malformed = new AirClient({ apiKey: "test", retries: 0, fetchImpl: async () => ({ ok: true, async json() { throw new SyntaxError("bad JSON"); } }) });
  await assert.rejects(malformed.chat({ model: "test", messages: [{ role: "user", content: "hello" }] }), /bad JSON/);

  const empty = new AirClient({ apiKey: "test", retries: 0, fetchImpl: async () => ({ ok: true, async json() { return { choices: [{ message: { content: "" } }] }; } }) });
  await assert.rejects(empty.chat({ model: "test", messages: [{ role: "user", content: "hello" }] }), /empty assistant response/);
});

test("AIR client honors caller cancellation without retrying", async () => {
  let calls = 0;
  const fetchImpl = async (_url, { signal }) => new Promise((_resolve, reject) => {
    calls += 1;
    signal.addEventListener("abort", () => { const error = new Error("aborted"); error.name = "AbortError"; reject(error); }, { once: true });
  });
  const controller = new AbortController();
  const request = new AirClient({ apiKey: "test", fetchImpl, timeoutMs: 1000, retries: 2 }).chat({ model: "test", messages: [{ role: "user", content: "hello" }], signal: controller.signal });
  controller.abort();
  await assert.rejects(request, /was canceled/);
  assert.equal(calls, 1);
});

test("diagnosis repairs only an exact app-generated script with an allowed patch", async () => {
  const gateway = { async chat() { return { model: "test", content: JSON.stringify({ category: "OUT_OF_MEMORY", confidence: "confirmed", ruleId: "slurm-oom", evidence: [{ lineNumber: 1, text: "oom_kill detected" }], explanation: "Memory was exhausted.", alternatives: [], missingEvidence: [], recommendations: ["Increase memory."], patch: { memoryGb: 64 } }) }; } };
  const harness = new AgentHarness({ gateway });
  const rules = [{ id: "slurm-oom", cluster: "any" }];
  const exact = renderSlurmScript(completeSpec);
  const repaired = await harness.diagnose({ cluster: "sol", script: exact, originalSpec: completeSpec, log: "oom_kill detected", metadata: { State: "OUT_OF_MEMORY" }, rules });
  assert.equal(repaired.repair.spec.memoryGb, 64);
  const arbitrary = await harness.diagnose({ cluster: "sol", script: `${exact}\necho changed`, originalSpec: completeSpec, log: "oom_kill detected", metadata: { State: "OUT_OF_MEMORY" }, rules });
  assert.equal(arbitrary.repair, null);
});

import { AirClient } from "../src/air_client.mjs";
import { AgentHarness } from "../src/agent_harness.mjs";
import { asuRules } from "../src/knowledge.mjs";
import { MockGateway } from "../src/mock_gateway.mjs";
import { buildSolHandoff } from "../src/terminal_handoff.mjs";

const mock = process.argv.includes("--mock");
const gateway = mock ? new MockGateway() : new AirClient({ timeoutMs: Number(process.env.AIR_TIMEOUT_MS || 45_000), retries: 0 });
const harness = new AgentHarness({ gateway, schedulerProfiles: asuRules.profiles });
const description = "Train a PyTorch image classifier on Sol with 8 CPUs, 1 GPU, 32 GB memory, two hours, and 10 epochs.";
const spec = {
  cluster: "sol", workloadType: "ml_training", jobName: "image-training",
  workingDirectory: "/scratch/demo/project", cpus: 8, gpus: 1, memoryGb: 32,
  walltime: "02:00:00", partition: "public", qos: "public",
  outputPath: "slurm.%j.out", errorPath: "slurm.%j.err", modules: ["python", "cuda"],
  executable: "python", args: ["train.py", "--epochs", "10"], epochs: 10,
  rationale: "A small single-GPU training run provides a measurable starting point."
};
console.log(`Running ${mock ? "mock" : "live AIR"} intake, critic, and diagnostician...`);
const intake = await harness.intake(description);
const generated = await harness.generateSpec({ description, spec });
const handoff = buildSolHandoff({ asurite: "rcsparky", transferMode: "present", remoteDirectory: "/scratch/rcsparky/project", filename: "image-training.slurm" });
const diagnosed = await harness.diagnose({ cluster: "sol", script: generated.script, log: "slurmstepd: error: Detected 1 oom_kill event in StepId=42.batch", metadata: { State: "OUT_OF_MEMORY", ReqMem: "32G", MaxRSS: "32G" }, rules: asuRules.diagnosisRules });
console.log(JSON.stringify({ intakeAgent: intake.agent, generated: { status: generated.status, agents: generated.agents, validation: generated.validation, review: generated.review }, handoff: { valid: handoff.valid, stepIds: handoff.steps.map((step) => step.id) }, diagnosis: diagnosed }, null, 2));

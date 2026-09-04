import { renderSlurmScript } from "./job_spec.mjs";

const DEMO_SPEC = Object.freeze({
  cluster: "sol",
  workloadType: "ml_training",
  jobName: "train-cnn-demo",
  workingDirectory: "/scratch/demo/cnn",
  cpus: 4,
  gpus: 1,
  memoryGb: 32,
  walltime: "04:00:00",
  partition: "public",
  qos: "public",
  outputPath: "%x_%j.out",
  errorPath: "%x_%j.err",
  modules: [],
  executable: "python",
  args: ["train.py", "--epochs", "10"],
  epochs: 10,
  rationale: "A bounded demonstration workload for the documented missing-command failure.",
});

const SOURCES = Object.freeze([
  { title: "Slurm SBATCH Job Scripts", url: "https://docs.rc.asu.edu/slurm-sbatch/" },
  { title: "Available Software", url: "https://docs.rc.asu.edu/available-software/" },
  { title: "Python Environment Example", url: "https://docs.rc.asu.edu/python-example/" },
]);

export function buildDocumentedDiagnosisDemo() {
  const script = renderSlurmScript(DEMO_SPEC);
  const commandLine = script.split("\n").findIndex((line) => line.startsWith("python ")) + 1;
  return {
    id: "sol-python-command-not-found",
    label: "Python command missing from batch environment",
    synthetic: true,
    description: "The scheduler accepts and starts the job, but the clean batch environment cannot find Python.",
    expectedCategory: "COMMAND_NOT_FOUND_OR_MODULE",
    cluster: "sol",
    script,
    log: `/var/spool/slurmd/job62530001/slurm_script: line ${commandLine}: python: command not found`,
    metadata: {
      State: "FAILED",
      ExitCode: "127:0",
      Elapsed: "00:00:02",
      ReqMem: "32G",
      MaxRSS: "6M",
      AllocTRES: "billing=4,cpu=4,gres/gpu=1,mem=32G,node=1",
    },
    sources: SOURCES.map((source) => ({ ...source })),
  };
}

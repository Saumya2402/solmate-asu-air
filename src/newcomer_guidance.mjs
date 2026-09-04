import { walltimeHours } from "./job_spec.mjs";
import { documentationSource } from "./knowledge.mjs";

export function resourceMetrics(spec) {
  const nodes = Number.isInteger(spec.nodes) ? spec.nodes : 1;
  const tasks = Number.isInteger(spec.tasks) ? spec.tasks : 1;
  const totalCpuCores = tasks * spec.cpus;
  const hours = walltimeHours(spec.walltime);
  return {
    nodes,
    tasks,
    cpusPerTask: spec.cpus,
    totalCpuCores,
    memoryPerTaskGb: round(spec.memoryGb / tasks),
    coreHours: round(totalCpuCores * hours),
    gpuHours: round(spec.gpus * nodes * hours),
  };
}

export function buildReadinessChecks(spec) {
  const checks = [
    { id: "directory", label: "Working directory exists", command: `test -d -- ${shellQuote(spec.workingDirectory)} && echo ready` },
    { id: "executable", label: "Executable is available", command: `command -v -- ${shellQuote(spec.executable)}` },
  ];
  for (const moduleName of spec.modules) {
    checks.push({ id: `module-${moduleName}`, label: `Module ${moduleName} is available`, command: `module spider ${shellQuote(moduleName)}` });
  }
  const scriptArgument = spec.args.find((argument) => /\.(?:py|R|sh|m|jl)$/i.test(argument));
  if (scriptArgument) checks.push({ id: "input-script", label: `${scriptArgument} exists`, command: `test -f -- ${shellQuote(scriptArgument)} && echo ready` });
  if (spec.tasks > 1 && /foam$/i.test(spec.executable)) {
    checks.push({ id: "decomposition-dictionary", label: "OpenFOAM decomposition is configured", command: "test -f -- system/decomposeParDict && echo ready" });
    checks.push({ id: "decomposed-case", label: "OpenFOAM processor directories exist", command: "test -d -- processor0 && echo ready" });
  }
  return checks;
}

export function beginnerWarnings(spec) {
  const warnings = [];
  const metrics = resourceMetrics(spec);
  if (spec.gpus > 0 && /foam$/i.test(spec.executable)) warnings.push("Confirm this OpenFOAM build can use GPUs; standard solvers commonly use CPU/MPI.");
  if (spec.tasks > 1 && spec.cpus > 1) warnings.push(`This requests ${spec.tasks} tasks multiplied by ${spec.cpus} CPUs per task, for ${metrics.totalCpuCores} total CPU cores.`);
  if (!/%[jx]/.test(spec.outputPath) || !/%[jx]/.test(spec.errorPath)) warnings.push("Add %j or %x to log filenames to keep output from different jobs separate.");
  if (walltimeHours(spec.walltime) >= 24) warnings.push("A shorter profiling run can produce queue and resource evidence before committing to this walltime.");
  if (spec.modules.length === 0) warnings.push("No modules are loaded; verify the executable is already available in the submitted environment.");
  if (spec.workloadType === "ml_training" && spec.gpus > 0) warnings.push("Confirm the training code moves the model and data to the accelerator and records GPU utilization.");
  return warnings;
}

export function firstRunPlan(spec) {
  const metrics = resourceMetrics(spec);
  return {
    label: "First-run profile",
    summary: `Start with this ${metrics.totalCpuCores}-core, ${spec.memoryGb}-GB request and refine it from measured evidence.`,
    measurements: ["Elapsed time", "MaxRSS versus requested memory", "CPU efficiency", ...(spec.gpus > 0 ? ["GPU utilization"] : [])],
  };
}

export function buildToolGuidance(spec) {
  const commandSource = documentationSource("helpful-slurm-commands");
  const statisticsSource = documentationSource("job-statistics");
  const softwareSource = documentationSource("available-software");
  const pythonSource = documentationSource("python-example");
  const tools = [
    { id: "myjobs", label: "Find and monitor your jobs", command: "myjobs", when: "After submission", source: commandSource },
    { id: "seff", label: "Check CPU and memory efficiency", command: "seff <jobID>", when: "After the job finishes", source: statisticsSource },
    { id: "myaccounts", label: "List accounts and allowed QoS", command: "myaccounts", when: "Before choosing an account-sensitive policy", source: commandSource },
  ];
  if (String(spec.workingDirectory || "").startsWith("/scratch/")) {
    tools.push({ id: "myquota", label: "Check scratch storage quota", command: "myquota", when: "Before a data-heavy run", source: commandSource });
  }
  if (spec.modules.length === 0) {
    const software = safeSoftwareToken(spec.executable);
    tools.push({ id: "module-spider", label: "Search installed software modules", command: `module spider ${software}`, when: "Before submitting", source: softwareSource });
  }
  if (isPythonWorkload(spec)) {
    tools.push({
      id: "python-environment",
      label: "Use pip only inside an activated mamba environment",
      command: "module load mamba/latest && source activate <env-name>",
      when: "Before installing Python packages",
      source: pythonSource,
    });
  }
  return tools.filter((tool) => tool.source).map((tool) => ({ ...tool, source: { title: tool.source.title, url: tool.source.url } }));
}

export function deterministicScriptExplanations(script) {
  return String(script).split("\n").flatMap((line, index) => {
    const meaning = explainLine(line);
    return meaning ? [{ lineNumber: index + 1, line, meaning, newcomerTip: tipForLine(line) }] : [];
  });
}

export function validateScriptExplanations(value, script) {
  if (!value || !Array.isArray(value.explanations)) throw new Error("Script explainer returned an invalid object.");
  const lines = String(script).split("\n");
  const seen = new Set();
  const explanations = value.explanations.filter((item) => {
    if (!item || !Number.isInteger(item.lineNumber) || seen.has(item.lineNumber)) return false;
    if (lines[item.lineNumber - 1] !== item.line || typeof item.meaning !== "string" || !item.meaning.trim()) return false;
    if (typeof item.newcomerTip !== "string") return false;
    seen.add(item.lineNumber);
    return true;
  });
  const expected = deterministicScriptExplanations(script).map((item) => item.lineNumber);
  if (explanations.length !== expected.length || expected.some((lineNumber) => !seen.has(lineNumber))) {
    throw new Error("Script explainer did not cover every meaningful script line.");
  }
  return explanations;
}

function explainLine(line) {
  const rules = [
    [/^#!\//, "Selects the shell used to run the job."],
    [/^#SBATCH --job-name=/, "Sets the name shown in Slurm job listings."],
    [/^#SBATCH --cpus-per-task=/, "Allocates CPU cores to each Slurm task."],
    [/^#SBATCH --ntasks=/, "Sets the number of tasks or MPI ranks."],
    [/^#SBATCH --nodes=/, "Sets the number of compute nodes."],
    [/^#SBATCH --mem=/, "Requests memory for the job allocation."],
    [/^#SBATCH --time=/, "Sets the maximum elapsed runtime before Slurm stops the job."],
    [/^#SBATCH --partition=/, "Selects the scheduler partition."],
    [/^#SBATCH --qos=/, "Selects the scheduler quality-of-service policy."],
    [/^#SBATCH --account=/, "Charges the request to the named allocation or project account."],
    [/^#SBATCH --(?:output|error)=/, "Chooses where Slurm writes standard output or error messages."],
    [/^#SBATCH --chdir=/, "Changes into this directory before the job starts."],
    [/^#SBATCH --gres=gpu:/, "Requests GPU resources."],
    [/^set -euo pipefail$/, "Stops the script on common shell errors and unset variables."],
    [/^module purge$/, "Clears inherited environment modules for reproducibility."],
    [/^module load /, "Loads software into the job environment."],
    [/^srun /, "Launches the application using the resources Slurm allocated."],
  ];
  return rules.find(([pattern]) => pattern.test(line))?.[1] || null;
}

function tipForLine(line) {
  if (/--cpus-per-task|--ntasks/.test(line)) return "Tasks multiplied by CPUs per task gives the total CPU-core request.";
  if (/--mem=/.test(line)) return "Compare this with MaxRSS after the run.";
  if (/--time=/.test(line)) return "A job that reaches this limit ends with TIMEOUT.";
  if (/^srun /.test(line)) return "Verify the executable and input files before submission.";
  return "Keep this value aligned with the confirmed job specification.";
}

function shellQuote(value) {
  const text = String(value);
  if (/^[A-Za-z0-9._/+:-]+$/.test(text)) return text;
  return `'${text.replaceAll("'", `'"'"'`)}'`;
}

function isPythonWorkload(spec) {
  return /python/i.test(spec.executable) || spec.args.some((argument) => /\.py(?:\s|$)/i.test(argument));
}

function safeSoftwareToken(value) {
  const token = String(value || "software").match(/[A-Za-z0-9._+-]+/)?.[0] || "software";
  return shellQuote(token);
}

function round(value) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

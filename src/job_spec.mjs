import { hardwareProfileFor, schedulerProfileFor } from "./knowledge.mjs";

const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const SAFE_MODULE = /^[A-Za-z0-9][A-Za-z0-9._/+:-]{0,79}$/;
const SAFE_EXECUTABLE = /^[A-Za-z0-9][A-Za-z0-9._/+:-]{0,159}$/;
const WALLTIME = /^(\d{1,3}):([0-5]\d):([0-5]\d)$/;
const SAFE_PATH = /^(?!-)(?!.*\.\.)(?!.*[\r\n\0;&|`$<>])[A-Za-z0-9_./+%{}-]{1,240}$/;

export const PRODUCT_LIMITS = Object.freeze({ cpus: 4096, gpus: 64, memoryGb: 32768, walltimeHours: 336 });
const JOB_SPEC_FIELDS = new Set([
  "cluster", "workloadType", "jobName", "workingDirectory", "cpus", "gpus", "memoryGb",
  "walltime", "partition", "qos", "account", "outputPath", "errorPath", "modules",
  "executable", "args", "epochs", "epochsConfiguredExternally", "nodes", "tasks",
  "rationale", "provenance",
]);

export function extractJsonObject(text) {
  if (typeof text !== "string") throw new Error("Model response must be text.");
  const cleaned = text.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  let foundObject = false;
  for (let start = cleaned.indexOf("{"); start >= 0; start = cleaned.indexOf("{", start + 1)) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < cleaned.length; index += 1) {
      const character = cleaned[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') inString = true;
      else if (character === "{") depth += 1;
      else if (character === "}") {
        depth -= 1;
        if (depth === 0) {
          foundObject = true;
          try { return JSON.parse(cleaned.slice(start, index + 1)); } catch { break; }
        }
      }
    }
  }
  if (!foundObject) throw new Error("Model response did not contain a complete JSON object.");
  throw new Error("Model response contained invalid JSON.");
}

export function validateJobSpec(spec, { requireComplete = false } = {}) {
  const errors = [];
  const warnings = [];
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
    return { valid: false, errors: ["Job specification must be an object."], warnings };
  }

  const unsupported = Object.keys(spec).filter((field) => !JOB_SPEC_FIELDS.has(field));
  if (unsupported.length) errors.push(`Unsupported job specification fields: ${unsupported.join(", ")}.`);

  if (!SAFE_NAME.test(spec.jobName || "")) errors.push("jobName must be 1-64 safe characters.");
  checkInteger(spec.cpus, "cpus", 1, PRODUCT_LIMITS.cpus, errors);
  checkInteger(spec.gpus, "gpus", 0, PRODUCT_LIMITS.gpus, errors);
  checkInteger(spec.memoryGb, "memoryGb", 1, PRODUCT_LIMITS.memoryGb, errors);

  const timeMatch = WALLTIME.exec(spec.walltime || "");
  if (!timeMatch) {
    errors.push("walltime must use HHH:MM:SS format.");
  } else if (walltimeHours(spec.walltime) > PRODUCT_LIMITS.walltimeHours) {
    errors.push(`walltime must not exceed the product guardrail of ${PRODUCT_LIMITS.walltimeHours} hours.`);
  }

  if (spec.partition != null && spec.partition !== "" && !SAFE_NAME.test(spec.partition)) {
    errors.push("partition contains unsupported characters.");
  }
  if (spec.account != null && spec.account !== "" && !SAFE_NAME.test(spec.account)) {
    errors.push("account contains unsupported characters.");
  }
  if (!Array.isArray(spec.modules) || spec.modules.some((value) => !SAFE_MODULE.test(value))) {
    errors.push("modules must be an array of safe module names.");
  }
  if (!SAFE_EXECUTABLE.test(spec.executable || "")) {
    errors.push("executable is missing or contains unsupported characters.");
  }
  if (!Array.isArray(spec.args) || spec.args.some((value) => typeof value !== "string" || /[\r\n\0]/.test(value))) {
    errors.push("args must be an array of single-line strings.");
  }
  if (typeof spec.rationale !== "string" || spec.rationale.trim().length < 10) {
    warnings.push("rationale should briefly explain the resource choices.");
  }
  if (Number.isInteger(spec.gpus) && spec.gpus > 0 && !(spec.modules || []).some((m) => /cuda|rocm|gaudi/i.test(m))) {
    warnings.push("GPU requested without an obvious accelerator module; verify the environment.");
  }
  if (requireComplete) {
    if (!new Set(["sol", "phoenix"]).has(spec.cluster)) errors.push("cluster must be sol or phoenix.");
    if (!new Set(["general", "simulation", "ml_training", "distributed"]).has(spec.workloadType)) {
      errors.push("workloadType must be general, simulation, ml_training, or distributed.");
    }
    for (const field of ["workingDirectory", "outputPath", "errorPath"]) {
      if (!SAFE_PATH.test(spec[field] || "")) errors.push(`${field} is missing or unsafe.`);
    }
    if (!SAFE_NAME.test(spec.qos || "")) errors.push("qos must be provided using safe characters.");
    if (spec.workloadType === "ml_training" && !hasEpochConfiguration(spec)) {
      errors.push("ML training requires epochs or epochsConfiguredExternally=true.");
    }
    if (spec.workloadType === "distributed" || (Number.isInteger(spec.tasks) && spec.tasks > 1)) {
      checkInteger(spec.nodes, "nodes", 1, 256, errors);
      checkInteger(spec.tasks, "tasks", 1, PRODUCT_LIMITS.cpus, errors);
      if (Number.isInteger(spec.tasks) && Number.isInteger(spec.cpus) && spec.tasks * spec.cpus > PRODUCT_LIMITS.cpus) {
        errors.push(`tasks multiplied by cpus per task must not exceed the product guardrail of ${PRODUCT_LIMITS.cpus}.`);
      }
    }
  }
  applyProfileLimits(spec, errors, warnings, { requireComplete });
  applyHardwareLimits(spec, errors, warnings, { requireComplete });
  if (spec.outputPath && spec.errorPath && spec.outputPath === spec.errorPath) {
    errors.push("outputPath and errorPath must be different files.");
  }
  if (Number.isInteger(spec.tasks) && spec.tasks > 1 && /foam$/i.test(spec.executable || "") && !(spec.args || []).includes("-parallel")) {
    errors.push("Parallel OpenFOAM requires the -parallel argument; also verify the case was decomposed before submission.");
  }
  return { valid: errors.length === 0, errors, warnings };
}

export function walltimeHours(value) {
  const match = WALLTIME.exec(value || "");
  return match ? Number(match[1]) + Number(match[2]) / 60 + Number(match[3]) / 3600 : NaN;
}

function hasEpochConfiguration(spec) {
  return (Number.isInteger(spec.epochs) && spec.epochs > 0 && spec.epochs <= 1_000_000)
    || spec.epochsConfiguredExternally === true;
}

function applyProfileLimits(spec, errors, warnings, { requireComplete }) {
  if (!requireComplete) return;
  const profile = schedulerProfileFor(spec);
  if (!profile) {
    errors.push(`partition/qos pair ${spec.partition || "<missing>"}/${spec.qos || "<missing>"} is not in the dated ${spec.cluster || "unknown"} scheduler profile.`);
    return;
  }
  const hours = walltimeHours(spec.walltime);
  const limits = profile.limits || {};
  if (limits.cpus && spec.cpus > limits.cpus) errors.push(`cpus exceeds the documented ${profile.id} limit of ${limits.cpus}.`);
  if (limits.gpus !== undefined && spec.gpus > limits.gpus) errors.push(`gpus exceeds the documented ${profile.id} limit of ${limits.gpus}.`);
  if (limits.memoryGb && spec.memoryGb > limits.memoryGb) errors.push(`memoryGb exceeds the documented ${profile.id} limit of ${limits.memoryGb} GB.`);
  if (limits.walltimeHours && hours > limits.walltimeHours) errors.push(`walltime exceeds the documented ${profile.id} limit of ${limits.walltimeHours} hours.`);
  if (profile.requiresAccount && !spec.account) errors.push(`${profile.id} requires an account value verified with myaccounts or myfairshare.`);
  if (profile.notes) warnings.push(profile.notes);
}

function applyHardwareLimits(spec, errors, warnings, { requireComplete }) {
  if (!requireComplete) return;
  const hardware = hardwareProfileFor(spec);
  if (!hardware) return;
  const nodes = Number.isInteger(spec.nodes) ? spec.nodes : 1;
  const tasks = Number.isInteger(spec.tasks) ? spec.tasks : 1;
  const tasksPerNode = Math.ceil(tasks / nodes);
  const coresPerNode = tasksPerNode * spec.cpus;
  if (coresPerNode > hardware.coresPerNode) {
    errors.push(`tasks and cpus require ${coresPerNode} cores per node, above the documented ${spec.cluster} node capacity of ${hardware.coresPerNode}.`);
  }
  if (spec.memoryGb > hardware.memoryGbPerNode) {
    errors.push(`memoryGb exceeds the documented ${spec.cluster} ${spec.partition} node capacity of ${hardware.memoryGbPerNode} GB.`);
  }
  if (spec.gpus > hardware.gpusPerNode) {
    errors.push(`gpus exceeds the documented generic ${spec.cluster} node capacity of ${hardware.gpusPerNode}; select a specific accelerator profile if needed.`);
  }
  if (nodes > tasks) warnings.push("nodes exceeds tasks; at least one requested node may receive no task.");
}

function checkInteger(value, name, min, max, errors) {
  if (!Number.isInteger(value) || value < min || value > max) {
    errors.push(`${name} must be an integer from ${min} to ${max}.`);
  }
}

function shellQuote(value) {
  const text = String(value);
  if (/^[A-Za-z0-9._/+:-]+$/.test(text)) return text;
  return `'${text.replaceAll("'", `'"'"'`)}'`;
}

export function renderSlurmScript(spec) {
  const validation = validateJobSpec(spec);
  if (!validation.valid) {
    throw new Error(`Cannot render invalid job specification: ${validation.errors.join(" ")}`);
  }
  const lines = [
    "#!/bin/bash",
    `#SBATCH --job-name=${spec.jobName}`,
    `#SBATCH --cpus-per-task=${spec.cpus}`,
    `#SBATCH --mem=${spec.memoryGb}G`,
    `#SBATCH --time=${spec.walltime}`,
  ];
  if (spec.partition) lines.push(`#SBATCH --partition=${spec.partition}`);
  if (spec.qos) lines.push(`#SBATCH --qos=${spec.qos}`);
  if (spec.account) lines.push(`#SBATCH --account=${spec.account}`);
  if (spec.outputPath) lines.push(`#SBATCH --output=${spec.outputPath}`);
  if (spec.errorPath) lines.push(`#SBATCH --error=${spec.errorPath}`);
  if (spec.workingDirectory) lines.push(`#SBATCH --chdir=${spec.workingDirectory}`);
  if (spec.nodes) lines.push(`#SBATCH --nodes=${spec.nodes}`);
  if (spec.tasks) lines.push(`#SBATCH --ntasks=${spec.tasks}`);
  if (spec.gpus > 0) lines.push(`#SBATCH --gres=gpu:${spec.gpus}`);
  lines.push("", "set -euo pipefail");
  if (spec.modules.length > 0) {
    lines.push("module purge", ...spec.modules.map((moduleName) => `module load ${shellQuote(moduleName)}`));
  }
  const command = [spec.executable, ...spec.args].map(shellQuote).join(" ");
  lines.push("", `srun ${command}`, "");
  return lines.join("\n");
}

const REPAIR_FIELDS = new Set(["cpus", "gpus", "memoryGb", "walltime", "partition", "modules"]);

export function isExactRenderedScript(spec, script) {
  return typeof script === "string" && script.replaceAll("\r\n", "\n") === renderSlurmScript(spec);
}

export function applyRepairPatch(originalSpec, patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new Error("Repair patch must be an object.");
  const forbidden = Object.keys(patch).filter((key) => !REPAIR_FIELDS.has(key));
  if (forbidden.length) throw new Error(`Repair patch contains forbidden fields: ${forbidden.join(", ")}.`);
  const repaired = { ...originalSpec, ...patch };
  const validation = validateJobSpec(repaired, { requireComplete: true });
  if (!validation.valid) throw new Error(`Repair patch is invalid: ${validation.errors.join(" ")}`);
  return { spec: repaired, validation, script: renderSlurmScript(repaired) };
}

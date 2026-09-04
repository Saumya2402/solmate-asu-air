const OUTCOMES = new Set(["succeeded", "submission_failed", "runtime_failed", "resources_off"]);
const WORKLOAD_TYPES = new Set(["general", "simulation", "ml_training", "distributed"]);
const SAFE_NAME = /^[A-Za-z0-9._+-]{1,64}$/;

export function sanitizeOutcomeHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(-12).flatMap((record) => {
    if (!record || typeof record !== "object" || !OUTCOMES.has(record.outcome) || !WORKLOAD_TYPES.has(record.workloadType)) return [];
    const sanitized = { outcome: record.outcome, workloadType: record.workloadType };
    if (typeof record.software === "string" && SAFE_NAME.test(record.software)) sanitized.software = record.software;
    for (const [field, min, max] of [["cpus", 1, 4096], ["gpus", 0, 64], ["memoryGb", 1, 32768], ["nodes", 1, 256], ["tasks", 1, 4096]]) {
      if (Number.isInteger(record[field]) && record[field] >= min && record[field] <= max) sanitized[field] = record[field];
    }
    if (typeof record.walltime === "string" && /^\d{2,3}:[0-5]\d:[0-5]\d$/.test(record.walltime)) sanitized.walltime = record.walltime;
    if (typeof record.partition === "string" && SAFE_NAME.test(record.partition)) sanitized.partition = record.partition;
    if (typeof record.qos === "string" && SAFE_NAME.test(record.qos)) sanitized.qos = record.qos;
    return [sanitized];
  });
}

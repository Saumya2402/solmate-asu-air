const MAX_LOG_LENGTH = 20_000;
const CONFIDENCE = new Set(["confirmed", "probable", "inconclusive"]);

export function normalizeLog(log) {
  const normalized = String(log || "").replaceAll("\r\n", "\n");
  if (!normalized.trim()) throw new Error("Job log is required.");
  if (normalized.length > MAX_LOG_LENGTH) throw new Error(`Job log must be ${MAX_LOG_LENGTH} characters or fewer.`);
  return normalized;
}

export function redactSensitive(text) {
  let value = String(text || "");
  let count = 0;
  const replace = (pattern, token) => { value = value.replace(pattern, () => { count += 1; return token; }); };
  replace(/-----BEGIN [^-\r\n]*PRIVATE KEY-----[\s\S]*?-----END [^-\r\n]*PRIVATE KEY-----/gi, "<redacted-private-key>");
  replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}(?:\.[A-Za-z0-9_-]{10,})?\b/g, "<redacted-token>");
  replace(/\b(?:password|passwd|secret|token|api[_-]?key|access[_-]?key)\s*[=:]\s*[^\s;,]+/gi, "<redacted-secret>");
  replace(/\bBearer\s+[A-Za-z0-9._~-]+|\bsk-[A-Za-z0-9_-]{8,}/gi, "<redacted-credential>");
  replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "<redacted-email>");
  replace(/\b(?:job(?:id)?|stepid)[=: ]+\d+(?:\.[A-Za-z]+)?\b|\b\d{6,}\b/gi, "<redacted-job-id>");
  replace(/\/(?:home|scratch|phxscratch)\/[^\s'";,]*/g, "/<redacted-sensitive-path>");
  replace(/\b(?:account|acct|project|allocation)(?:\s+name)?[=:]\s*[A-Za-z0-9._-]+|\b(?:account|acct)\s+(?:grp|class)_[A-Za-z0-9._-]+/gi, "<redacted-account>");
  replace(/\b(?:host|hostname|node)[=: ]+[A-Za-z0-9._-]+/gi, "<redacted-host>");
  return { text: value, redactionCount: count };
}

export function redactRecord(record = {}) {
  let redactionCount = 0;
  const value = Object.fromEntries(Object.entries(record).map(([field, item]) => {
    const redacted = redactSensitive(item);
    redactionCount += redacted.redactionCount;
    return [field, redacted.text];
  }));
  return { value, redactionCount };
}

export function deterministicFindings(log, metadata = {}) {
  const lines = normalizeLog(log).split("\n");
  const findings = [];
  const state = String(metadata.State || "").trim().toUpperCase();
  const hasAccountingState = (value) => lines.some((line) => new RegExp(`(?:^|\\|\\s*|State[=:]\\s*)${value}(?:\\s*\\||$)`, "i").test(line));
  const add = (category, ruleId, regex, explanation, confidence = "probable") => {
    const index = lines.findIndex((line) => regex.test(line));
    if (index >= 0) findings.push({ category, ruleId, confidence, evidence: [{ lineNumber: index + 1, text: lines[index].trim() }], explanation });
  };
  const addMetadata = (category, ruleId, field, explanation, confidence = "confirmed") => {
    if (metadata[field] === undefined || findings.some((item) => item.ruleId === ruleId)) return;
    findings.push({ category, ruleId, confidence, evidence: [{ source: "metadata", field, text: String(metadata[field]) }], explanation });
  };
  add("SCRIPT_FORMAT_OR_SHEBANG", "slurm-script-format", /this does not look like a batch script|first\s+line\s+must\s+start\s+with\s+#!/i, "Slurm rejected the file before submission because it did not recognize a valid batch-script first line.", "confirmed");
  add("ACCOUNT_OR_QOS_ACCESS", "slurm-account-qos", /invalid account or account\/partition combination|invalid qos specification|violates accounting\/qos policy/i, "Slurm rejected the submitted account, hardware queue, or run-policy combination.", "confirmed");
  add("OUT_OF_MEMORY", "slurm-oom", /out of memory|oom-kill|oom_kill|\bOUT_OF_MEMORY\b/i, "The supplied output contains an explicit scheduler or application memory-exhaustion signal.", state === "OUT_OF_MEMORY" || hasAccountingState("OUT_OF_MEMORY") ? "confirmed" : "probable");
  add("TIMEOUT", "slurm-timeout", /job.*(?:time limit|timed out)|cancelled due to time limit|slurm.*timeout|(?:^|\|\s*|State[=:]\s*)TIMEOUT(?:\s*\||$)/i, "The supplied output indicates that a Slurm time limit was reached.", state === "TIMEOUT" || hasAccountingState("TIMEOUT") ? "confirmed" : "probable");
  add("INVALID_PARTITION_OR_QOS_OR_CONSTRAINT", "slurm-invalid-feature", /invalid feature specification/i, "ASU documents this as an ambiguous partition, QoS, or constraint problem.");
  add("COMMAND_NOT_FOUND_OR_MODULE", "slurm-command-not-found", /command not found|module.*not found|execve\(\):\s*[^:\r\n]+:\s*no such file or directory/i, "The requested executable or module was not available in the job environment.", "confirmed");
  add("APPLICATION_DEPENDENCY", "slurm-application-dependency", /modulenotfounderror|no module named|importerror:/i, "The application reported a missing software dependency in the batch-job environment.", "confirmed");
  add("FILE_OR_EXECUTION_PERMISSION", "slurm-permission", /permission denied|cannot execute/i, "The job could not access or execute a required file.", "confirmed");
  add("STORAGE_OR_QUOTA", "slurm-storage", /disk quota exceeded|no space left on device/i, "The job reported a storage-capacity or quota condition.");
  add("APPLICATION_OR_SIGNAL", "slurm-application-signal", /segmentation fault|sigsegv|killed by signal|terminated by signal/i, "The application ended after reporting a process signal; the application trace and signal are needed to narrow the cause.");
  add("PENDING_NOT_FAILED", "slurm-pending", /nodelist\(reason\).*\b(?:priority|resources|qosmax\w*|reqnodenotavail)\b|reason[=: ]+\(?(?:priority|resources|qosmax\w*|reqnodenotavail)/i, "This resembles a pending scheduler reason rather than a completed job failure.", "confirmed");
  add("RUNNING_NOT_FAILED", "slurm-running", /(?:^|\|\s*|State[=:]\s*)RUNNING(?:\s*\||$)/i, "The pasted scheduler output says the job is still running.", "confirmed");
  add("COMPLETED_SUCCESS", "slurm-completed", /\|\s*COMPLETED\s*\|\s*(?:0|0:0)\s*\||State[=:]\s*COMPLETED.*ExitCode[=:]\s*(?:0|0:0)\b/i, "The pasted scheduler output reports successful completion.", "confirmed");
  add("INFRASTRUCTURE_OR_ADMIN", "slurm-infrastructure", /drain|maintenance|node.*down/i, "This indicates an administrator or infrastructure condition; do not rewrite the script.", "confirmed");
  add("INFRASTRUCTURE_OR_ADMIN", "slurm-infrastructure", /(?:^|\|\s*|State[=:]\s*)NODE_FAIL(?:\s*\||$)/i, "The pasted scheduler output reports a node failure.", "confirmed");
  if (state === "OUT_OF_MEMORY") addMetadata("OUT_OF_MEMORY", "slurm-oom", "State", "The supplied scheduler state explicitly reports memory exhaustion.");
  if (state === "TIMEOUT") addMetadata("TIMEOUT", "slurm-timeout", "State", "The supplied scheduler state explicitly reports a Slurm timeout.");
  if (state === "PENDING") addMetadata("PENDING_NOT_FAILED", "slurm-pending", "State", "The supplied scheduler state says the job is queued, not failed.");
  if (state === "RUNNING") addMetadata("RUNNING_NOT_FAILED", "slurm-running", "State", "The supplied scheduler state says the job is still running.");
  if (state === "COMPLETED" && metadata.ExitCode !== undefined && /^(?:0|0:0)$/.test(String(metadata.ExitCode))) addMetadata("COMPLETED_SUCCESS", "slurm-completed", "State", "The supplied scheduler state and exit code indicate successful completion.");
  if (state === "NODE_FAIL") addMetadata("INFRASTRUCTURE_OR_ADMIN", "slurm-infrastructure", "State", "The supplied scheduler state reports a node failure.");
  return findings;
}

export function diagnosisFromDeterministicFindings(findings = [], { log = "", metadata = {} } = {}) {
  if (!findings.length) {
    const lines = String(log || "").replaceAll("\r\n", "\n").split("\n");
    const lineNumber = Math.max(1, lines.findIndex((line) => line.trim()) + 1);
    const evidence = lines[lineNumber - 1]?.trim()
      ? [{ lineNumber, text: lines[lineNumber - 1].trim() }]
      : Object.keys(metadata).length
        ? [{ source: "metadata", field: Object.keys(metadata)[0], text: String(metadata[Object.keys(metadata)[0]]) }]
        : [];
    return {
      category: "UNKNOWN",
      confidence: "inconclusive",
      ruleId: null,
      evidence,
      explanation: "The supplied evidence does not identify one documented root cause yet.",
      alternatives: [],
      missingEvidence: ["Paste the scheduler state and reason, the completed-job accounting record, and the first error line from the job output."],
      recommendations: ["Collect the suggested Sol evidence before changing resource requests or application files."],
      patch: null,
    };
  }
  if (findings.length > 1) {
    return {
      category: "UNKNOWN",
      confidence: "inconclusive",
      ruleId: null,
      evidence: findings[0].evidence,
      explanation: "Multiple verified failure signals were found, so one root cause cannot be selected safely.",
      alternatives: findings.map((finding) => finding.category),
      missingEvidence: ["Review the complete job log and sacct record to establish which signal occurred first."],
      recommendations: ["Resolve the earliest verified failure before changing unrelated resource requests."],
      patch: null,
    };
  }

  const finding = findings[0];
  const recommendations = deterministicRecommendations(finding.category);
  return {
    category: finding.category,
    confidence: finding.confidence,
    ruleId: finding.ruleId,
    evidence: finding.evidence,
    explanation: finding.explanation,
    alternatives: [],
    missingEvidence: [],
    recommendations,
    patch: null,
  };
}

function deterministicRecommendations(category) {
  const recommendations = {
    SCRIPT_FORMAT_OR_SHEBANG: ["Make the first byte of the file the # in #!/bin/bash; remove any leading blank line or backslash, then run sbatch --test-only again."],
    ACCOUNT_OR_QOS_ACCESS: ["Run myaccounts and compare the available account and QoS values with the script's account, hardware queue, and run policy."],
    OUT_OF_MEMORY: ["After the job finishes, compare MaxRSS with requested memory using seff and sacct before increasing memory."],
    TIMEOUT: ["Use seff and sacct to compare elapsed time with the requested limit, then adjust runtime only if the workload legitimately needs it."],
    INVALID_PARTITION_OR_QOS_OR_CONSTRAINT: ["Check the partition, QoS, account, and any constraint together; this message does not identify which one is invalid."],
    COMMAND_NOT_FOUND_OR_MODULE: ["Use an absolute path for the failing executable or initialize PATH and required modules inside the batch script before srun.", "Run module avail with the software name; for Python environments, follow the ASU mamba guide and activate the intended environment inside the batch script.", "Submit a short test job again and verify the application command starts before changing resource requests."],
    APPLICATION_DEPENDENCY: ["Verify the required module or activate the intended mamba environment inside the batch script before the application command."],
    FILE_OR_EXECUTION_PERMISSION: ["Verify that the referenced file exists, is readable, and is executable when required; also verify its interpreter path."],
    STORAGE_OR_QUOTA: ["Run myquota and verify which filesystem contains the output before moving or deleting data."],
    APPLICATION_OR_SIGNAL: ["Inspect the earliest application traceback or signal line before changing Slurm resources."],
    PENDING_NOT_FAILED: ["Use myjobs and thisjob <jobID> to inspect the current scheduler reason and estimated start time."],
    RUNNING_NOT_FAILED: ["Use myjobs for current status; seff and sacct resource statistics are not reliable until the job finishes."],
    COMPLETED_SUCCESS: ["No scheduler failure is shown. Review the application output only if the scientific result is incomplete or incorrect."],
    INFRASTRUCTURE_OR_ADMIN: ["Preserve the job ID and evidence, check ASU system status, and contact Research Computing if the condition persists."],
  };
  return recommendations[category] || ["Review the cited evidence and applicable ASU guidance before changing the script."];
}

export function diagnosisDisposition(diagnosis) {
  if (diagnosis.category === "COMPLETED_SUCCESS") return { id: "resolved", label: "No scheduler failure", detail: "The supplied state indicates successful completion." };
  if (["PENDING_NOT_FAILED", "RUNNING_NOT_FAILED"].includes(diagnosis.category)) return { id: "monitor", label: "Monitor the job", detail: "The job is not in a terminal failure state." };
  if (diagnosis.category === "INFRASTRUCTURE_OR_ADMIN") return { id: "support", label: "Research Computing support", detail: "Preserve the evidence and escalate if the cluster condition persists." };
  if (diagnosis.confidence === "inconclusive" || diagnosis.category === "UNKNOWN") return { id: "support", label: "Collect evidence, then escalate", detail: "Gather the requested evidence first; contact Research Computing if AIR still cannot isolate the issue." };
  return { id: "user_action", label: "Researcher action", detail: "Review the cited evidence and try the bounded next actions before resubmitting." };
}

export function validateDiagnosis(diagnosis, { log, metadata = {}, allowedRuleIds = [], rules = [], deterministicFindings: findings = [] }) {
  const lines = normalizeLog(log).split("\n");
  if (!diagnosis || typeof diagnosis !== "object" || !CONFIDENCE.has(diagnosis.confidence)) throw new Error("Diagnostician returned an invalid diagnosis object.");
  if (typeof diagnosis.category !== "string" || typeof diagnosis.explanation !== "string") throw new Error("Diagnosis category and explanation are required.");
  if (!Array.isArray(diagnosis.evidence) || diagnosis.evidence.length === 0) throw new Error("Diagnosis must cite at least one supplied evidence item.");
  for (const item of diagnosis.evidence) {
    if (item.source === "metadata") {
      if (!(item.field in metadata) || String(metadata[item.field]).trim() !== String(item.text).trim()) throw new Error("Diagnosis cited metadata that was not supplied exactly.");
    } else if (!Number.isInteger(item.lineNumber) || item.lineNumber < 1 || item.lineNumber > lines.length || lines[item.lineNumber - 1].trim() !== String(item.text || "").trim()) {
      throw new Error("Diagnosis cited a log line that does not match the supplied input.");
    }
  }
  if (diagnosis.ruleId && !allowedRuleIds.includes(diagnosis.ruleId)) throw new Error("Diagnosis cited an inapplicable rule.");
  const rule = rules.find((item) => item.id === diagnosis.ruleId);
  const matchedFinding = findings.find((item) => item.ruleId === diagnosis.ruleId);
  if (diagnosis.ruleId && !matchedFinding) throw new Error("Diagnosis cited a rule whose trigger was not found in the supplied evidence.");
  if (typeof rule?.category === "string" && rule.category !== diagnosis.category) throw new Error("Diagnosis category does not match the cited rule.");
  if (!diagnosis.ruleId && diagnosis.confidence === "confirmed") throw new Error("Diagnosis claimed confirmed confidence without a verified rule.");
  if (diagnosis.category === "UNKNOWN" && diagnosis.confidence !== "inconclusive") throw new Error("Unknown diagnoses must remain inconclusive.");
  if (diagnosis.confidence === "confirmed" && matchedFinding?.confidence !== "confirmed") throw new Error("Diagnosis confidence exceeded the verified finding.");
  if (diagnosis.confidence === "confirmed" && rule?.requiresCorroboration && !findings.some((item) => item.ruleId === diagnosis.ruleId && item.confidence === "confirmed")) {
    throw new Error("Diagnosis claimed confirmed confidence without required corroboration.");
  }
  for (const field of ["alternatives", "missingEvidence", "recommendations"]) {
    if (!Array.isArray(diagnosis[field]) || !diagnosis[field].every((item) => typeof item === "string")) throw new Error(`Diagnosis ${field} must be strings.`);
  }
  return diagnosis;
}

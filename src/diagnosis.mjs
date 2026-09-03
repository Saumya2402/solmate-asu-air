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
  replace(/\b(?:account|acct|project|allocation)(?:\s+name)?[=: ]+[A-Za-z0-9._-]+/gi, "<redacted-account>");
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
  const add = (category, ruleId, regex, explanation, confidence = "probable") => {
    const index = lines.findIndex((line) => regex.test(line));
    if (index >= 0) findings.push({ category, ruleId, confidence, evidence: [{ lineNumber: index + 1, text: lines[index].trim() }], explanation });
  };
  add("OUT_OF_MEMORY", "slurm-oom", /out of memory|oom-kill|oom_kill/i, "The log contains an explicit memory-exhaustion signal.", metadata.State === "OUT_OF_MEMORY" ? "confirmed" : "probable");
  add("TIMEOUT", "slurm-timeout", /time limit|timeout/i, "The supplied output indicates that a time limit was reached.", metadata.State === "TIMEOUT" ? "confirmed" : "probable");
  add("INVALID_PARTITION_OR_QOS_OR_CONSTRAINT", "slurm-invalid-feature", /invalid feature specification/i, "ASU documents this as an ambiguous partition, QoS, or constraint problem.");
  add("COMMAND_NOT_FOUND_OR_MODULE", "slurm-command-not-found", /command not found|module.*not found|execve\(\):\s*[^:\r\n]+:\s*no such file or directory/i, "The requested executable or module was not available in the job environment.", "confirmed");
  add("PENDING_NOT_FAILED", "slurm-pending", /\bpriority\b|\bresources\b|qosmax|reqnodenotavail/i, "This resembles a pending scheduler reason rather than a completed job failure.", "confirmed");
  add("INFRASTRUCTURE_OR_ADMIN", "slurm-infrastructure", /drain|maintenance|node.*down/i, "This indicates an administrator or infrastructure condition; do not rewrite the script.", "confirmed");
  return findings;
}

export function diagnosisFromDeterministicFindings(findings = []) {
  if (!findings.length) return null;
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
  const recommendations = finding.category === "COMMAND_NOT_FOUND_OR_MODULE"
    ? [
        "Use an absolute path for the failing executable or initialize PATH and required modules inside the batch script before srun.",
        "Submit a short test job again and verify the application command starts before changing resource requests.",
      ]
    : ["Review the cited evidence and applicable ASU guidance before changing the script."];
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
  if (typeof rule?.category === "string" && rule.category !== diagnosis.category) throw new Error("Diagnosis category does not match the cited rule.");
  if (diagnosis.confidence === "confirmed" && rule?.requiresCorroboration && !findings.some((item) => item.ruleId === diagnosis.ruleId && item.confidence === "confirmed")) {
    throw new Error("Diagnosis claimed confirmed confidence without required corroboration.");
  }
  if (!Array.isArray(diagnosis.recommendations) || !diagnosis.recommendations.every((item) => typeof item === "string")) throw new Error("Diagnosis recommendations must be strings.");
  return diagnosis;
}

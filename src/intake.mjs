import { PRODUCT_LIMITS, validateJobSpec } from "./job_spec.mjs";

export const BASE_REQUIRED_FIELDS = Object.freeze([
  "cluster", "workloadType", "jobName", "workingDirectory", "cpus", "gpus", "memoryGb",
  "walltime", "partition", "qos", "outputPath", "errorPath", "modules", "executable", "args",
]);
const AIR_FACT_FIELDS = new Set([...BASE_REQUIRED_FIELDS, "software", "epochs", "nodes", "tasks"]);

export function requiredFieldsFor(values = {}) {
  const fields = [...BASE_REQUIRED_FIELDS];
  if (values.workloadType === "ml_training" && values.epochsConfiguredExternally !== true) fields.push("epochs");
  if (values.workloadType === "distributed" || (Number.isInteger(values.tasks) && values.tasks > 1)) fields.push("nodes", "tasks");
  return fields;
}

export function missingFields(values = {}) {
  return requiredFieldsFor(values).filter((field) => {
    const value = values[field];
    if (field === "gpus") return !Number.isInteger(value);
    if (field === "modules" || field === "args") return !Array.isArray(value);
    return value === null || value === undefined || value === "";
  });
}

export function validateIntakeAnalysis(value) {
  const valid = value && typeof value === "object"
    && ["general", "simulation", "ml_training", "distributed"].includes(value.workloadType)
    && value.extracted && typeof value.extracted === "object"
    && Array.isArray(value.missingFields)
    && value.missingFields.every((item) => typeof item === "string")
    && Array.isArray(value.recommendations)
    && value.recommendations.every(validRecommendation)
    && typeof value.workflowSummary === "string"
    && Array.isArray(value.domainQuestions)
    && value.domainQuestions.every((item) => typeof item === "string")
    && Array.isArray(value.detectedConflicts)
    && value.detectedConflicts.every(validConflict);
  if (!valid) throw new Error("Planner returned an invalid intake object.");
  return value;
}

export function normalizeIntakeAnalysis(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Planner returned an invalid intake object.");
  const rawType = String(value.workloadType || "").toLowerCase();
  const softwareText = String(value.software || value.extracted?.software || "").toLowerCase();
  const workloadType = /openfoam/.test(softwareText) || /simulation|cfd|openfoam/.test(rawType)
    ? "simulation"
    : /train|machine|ml/.test(rawType)
    ? "ml_training"
    : /mpi|distributed|parallel/.test(rawType)
      ? "distributed"
      : "general";
  return {
    workloadType,
    workflowSummary: typeof value.workflowSummary === "string" ? value.workflowSummary : "AIR identified the workload and the remaining decisions needed before a script can be generated.",
    recommendationBasis: typeof value.recommendationBasis === "string" ? value.recommendationBasis : "AIR needs more workload evidence before it can refine the resource profile.",
    corrections: Array.isArray(value.corrections) ? value.corrections : [],
    nextQuestion: typeof value.nextQuestion === "string" && value.nextQuestion.trim() ? value.nextQuestion.trim() : null,
    software: typeof value.software === "string" ? value.software : null,
    extracted: value.extracted && typeof value.extracted === "object" && !Array.isArray(value.extracted) ? value.extracted : {},
    extractedEvidence: Array.isArray(value.extractedEvidence) ? value.extractedEvidence.filter(validEvidence) : [],
    missingFields: Array.isArray(value.missingFields) ? value.missingFields.filter((item) => typeof item === "string") : [],
    recommendations: Array.isArray(value.recommendations)
      ? value.recommendations.filter((item) => item?.value !== null && item?.value !== "null" && validRecommendation(item))
      : [],
    domainQuestions: Array.isArray(value.domainQuestions) ? value.domainQuestions.filter((item) => typeof item === "string").slice(0, 6) : [],
    detectedConflicts: Array.isArray(value.detectedConflicts) ? value.detectedConflicts.filter(validConflict).slice(0, 6) : [],
  };
}

export function validateCorrections(description, corrections = []) {
  const text = String(description || "");
  const categories = new Set(["language", "software", "identifier"]);
  const confidences = new Set(["low", "medium", "high"]);
  const seen = new Set();
  return corrections.filter((item) => {
    if (!item || typeof item.original !== "string" || typeof item.suggested !== "string") return false;
    if (!item.original.trim() || !item.suggested.trim() || item.original === item.suggested) return false;
    if (!text.includes(item.original) || !categories.has(item.category) || !confidences.has(item.confidence)) return false;
    if (item.suggested.length > 120 || /[\r\n\0]/.test(item.suggested)) return false;
    if (/^(?:sol|phoenix|slurm|asu|air)$/i.test(item.original) && item.original.toLowerCase() === item.suggested.toLowerCase()) return false;
    if (item.category === "identifier" && item.requiresConfirmation !== true) return false;
    const key = `${item.original}\0${item.suggested}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);
}

function validRecommendation(item) {
  return item && typeof item.field === "string" && "value" in item
    && typeof item.rationale === "string" && item.rationale.length >= 10
    && ["low", "medium", "high"].includes(item.uncertainty);
}

function validEvidence(item) {
  return item && typeof item.field === "string" && typeof item.quote === "string" && item.quote.trim().length > 0;
}

function validConflict(item) {
  return item && typeof item.message === "string" && ["info", "warning", "critical"].includes(item.severity || "warning");
}

export function buildReadySpec({ values, confirmedRecommendationFields = [] }) {
  const normalizedValues = { ...values };
  const normalizedWalltime = durationToWalltime(values?.walltime);
  if (normalizedWalltime) normalizedValues.walltime = normalizedWalltime;
  const missing = missingFields(normalizedValues);
  if (missing.length) return { ready: false, missingFields: missing, validation: null };
  const confirmed = new Set(confirmedRecommendationFields);
  const provenance = Object.fromEntries(requiredFieldsFor(normalizedValues).map((field) => [
    field,
    confirmed.has(field) ? "air_recommended_user_confirmed" : "user_provided",
  ]));
  const spec = { ...normalizedValues, provenance };
  const validation = validateJobSpec(spec, { requireComplete: true });
  return { ready: validation.valid, missingFields: [], validation, spec };
}

export function validatePlausibilityCandidate(field, value) {
  const max = PRODUCT_LIMITS[field];
  if (max !== undefined && (!Number.isInteger(value) || value < (field === "gpus" ? 0 : 1) || value > max)) {
    return { valid: false, error: `${field} must be an integer from ${field === "gpus" ? 0 : 1} to ${max}.` };
  }
  return { valid: true };
}

export function normalizeAirFacts(description, value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.facts)) throw new Error("Fact extractor returned an invalid object.");
  const text = String(description || "");
  const candidates = [];
  for (const fact of value.facts) {
    if (!fact || !AIR_FACT_FIELDS.has(fact.field) || typeof fact.quote !== "string" || fact.quote.trim() === "") continue;
    const index = text.toLowerCase().lastIndexOf(fact.quote.trim().toLowerCase());
    const normalizedFact = fact.field === "walltime"
      ? { ...fact, value: durationToWalltime(fact.quote) }
      : fact;
    if (index < 0 || !validAirFactValue(normalizedFact.field, normalizedFact.value, normalizedFact.quote)) continue;
    candidates.push({ ...normalizedFact, index });
  }
  candidates.sort((left, right) => left.index - right.index);
  const extracted = {};
  const evidenceByField = new Map();
  for (const fact of candidates) {
    extracted[fact.field] = fact.value;
    evidenceByField.set(fact.field, { field: fact.field, quote: fact.quote.trim() });
  }
  return { extracted, evidence: [...evidenceByField.values()] };
}

function validAirFactValue(field, value, quote) {
  if (!factQuoteSupportsField(field, quote)) return false;
  if (["cpus", "gpus", "memoryGb", "epochs", "nodes", "tasks"].includes(field)) {
    const plausible = validatePlausibilityCandidate(field, value);
    return plausible.valid && quoteSupportsNumericValue(field, value, quote);
  }
  if (["modules", "args"].includes(field)) return Array.isArray(value) && value.every((item) => typeof item === "string" && item.length > 0 && quote.toLowerCase().includes(item.toLowerCase()));
  if (typeof value !== "string" || value.trim() === "") return false;
  if (field === "walltime") return /^\d{2,3}:[0-5]\d:[0-5]\d$/.test(value) && quoteSupportsWalltime(value, quote);
  return quote.toLowerCase().includes(value.toLowerCase());
}

function quoteSupportsWalltime(value, quote) {
  return durationToWalltime(quote) === value;
}

function quoteSupportsNumericValue(field, value, quote) {
  const fieldPatterns = {
    cpus: /(?:\b(?:no|a|an|single|zero|one|two|three|four|five|six|seven|eight|nine|ten|\d[\d,]*)\s*(?:cpus?|cpu\s+cores?|cores?)\b|\b(?:cpus?|cpu\s+cores?|cores?)\s*(?:is|are|=|:)?\s*(?:no|a|an|single|zero|one|two|three|four|five|six|seven|eight|nine|ten|\d[\d,]*))/gi,
    gpus: /(?:\b(?:no|a|an|single|zero|one|two|three|four|five|six|seven|eight|nine|ten|\d[\d,]*)\s*gpus?\b|\bgpus?\s*(?:is|are|=|:)?\s*(?:no|a|an|single|zero|one|two|three|four|five|six|seven|eight|nine|ten|\d[\d,]*))/gi,
    memoryGb: /(?:\b(?:no|a|an|single|zero|one|two|three|four|five|six|seven|eight|nine|ten|\d[\d,]*)\s*(?:gb|gib)(?:\s+of)?\s+(?:memory|ram)\b|\b(?:memory|ram)\s*(?:is|of|=|:)?\s*(?:no|a|an|single|zero|one|two|three|four|five|six|seven|eight|nine|ten|\d[\d,]*)\s*(?:gb|gib))/gi,
    epochs: /(?:\b(?:no|a|an|single|zero|one|two|three|four|five|six|seven|eight|nine|ten|\d[\d,]*)\s*epochs?\b|\bepochs?\s*(?:is|are|=|:)?\s*(?:no|a|an|single|zero|one|two|three|four|five|six|seven|eight|nine|ten|\d[\d,]*))/gi,
    nodes: /(?:\b(?:no|a|an|single|zero|one|two|three|four|five|six|seven|eight|nine|ten|\d[\d,]*)\s*(?:compute\s+)?nodes?\b|\bnodes?\s*(?:is|are|=|:)?\s*(?:no|a|an|single|zero|one|two|three|four|five|six|seven|eight|nine|ten|\d[\d,]*))/gi,
    tasks: /(?:\bmpi\s*(?:n|ranks?|tasks?|processes?)?\s*(?:=|:)?\s*(?:no|a|an|single|zero|one|two|three|four|five|six|seven|eight|nine|ten|\d[\d,]*)\b|\b(?:no|a|an|single|zero|one|two|three|four|five|six|seven|eight|nine|ten|\d[\d,]*)\s*(?:mpi\s*)?(?:ranks?|tasks?|processes?)\b)/gi,
  };
  for (const match of quote.matchAll(fieldPatterns[field])) {
    const tokens = match[0].match(/(?<![A-Za-z0-9])(?:no|a|an|single|zero|one|two|three|four|five|six|seven|eight|nine|ten|\d[\d,]*)(?=$|[\s=:]|cpus?|gpus?|gb|gib|epochs?|nodes?|ranks?|tasks?|processes?)/gi) || [];
    if (tokens.some((token) => countValue(token.replaceAll(",", "")) === value)) return true;
  }
  const conversationalMpi = quote.match(/\bmpi\b[^.\n]{0,40}\b(?:n|ranks?|tasks?|processes?)\s*(?:=|:)?\s*(\d[\d,]*)\b/i);
  if (field === "tasks" && conversationalMpi && Number(conversationalMpi[1].replaceAll(",", "")) === value) return true;
  if (field === "cpus") {
    const cpuMatch = quote.match(/\b(\d[\d,]*)\s*(?:total\s+)?cpus?\b/i);
    const taskMatch = quote.match(/\bmpi\s*(?:n|ranks?|tasks?|processes?)?\s*(?:=|:)?\s*(\d[\d,]*)\b/i) || conversationalMpi;
    if (cpuMatch && taskMatch) {
      const totalCpus = Number(cpuMatch[1].replaceAll(",", ""));
      const tasks = Number(taskMatch[1].replaceAll(",", ""));
      if (tasks > 0 && totalCpus % tasks === 0 && totalCpus / tasks === value) return true;
    }
  }
  return false;
}

function factQuoteSupportsField(field, quote) {
  if (field === "workingDirectory" && /^\/[A-Za-z0-9._~\/-]+[.,;]?$/.test(quote.trim())) return true;
  const cues = {
    cluster: /\b(?:sol|phoenix|cluster)\b/i,
    jobName: /\b(?:job\s*name|job\s+(?:should\s+be\s+)?(?:called|named)|name\s+(?:the\s+)?job|call\s+(?:it|this\s+job|the\s+job)|as\s+(?:the\s+)?job)\b/i,
    workingDirectory: /\b(?:working\s+directory|work\s+directory|case\s+(?:directory|path)|path|run\s+from)\b/i,
    cpus: /(?:cpus?|cpu\s+cores?|cores?)/i,
    gpus: /gpus?/i,
    memoryGb: /\b(?:memory|ram|gb|gib)\b/i,
    walltime: /\b(?:walltime|run\s*time|runtime|hours?|minutes?)\b/i,
    nodes: /\bnodes?\b/i,
    tasks: /\b(?:mpi|ranks?|tasks?|processes?)\b/i,
    software: /\b(?:software|open\s*foam|[A-Za-z]+Foam|pytorch|python|matlab|r)\b/i,
    executable: /\b(?:executable|command|run|launch)\b/i,
    modules: /\bmodules?\b/i,
    epochs: /\bepochs?\b/i,
    partition: /\bpartition\b/i,
    qos: /\bqos\b/i,
    outputPath: /\b(?:output|stdout)\b/i,
    errorPath: /\b(?:error|stderr)\b/i,
    args: /\b(?:args?|arguments?|flags?)\b/i,
  };
  return cues[field]?.test(quote) === true;
}

export function normalizeExplicitFacts(description, extracted = {}, workloadType = "general", evidence = []) {
  const text = String(description || "");
  const verified = {};
  for (const item of evidence) {
    if (text.toLowerCase().includes(item.quote.trim().toLowerCase()) && item.field in extracted) verified[item.field] = extracted[item.field];
  }
  const result = { ...verified, workloadType };
  if (/\bopen\s*foam\b/i.test(text) || /\b(?:simple|pimple|ico|rho|inter|buoyant)[A-Za-z]*Foam\b/i.test(text)) result.software = "OpenFOAM";
  if (/\bsol\b/i.test(text)) result.cluster = "sol";
  else if (/\bphoenix\b/i.test(text)) result.cluster = "phoenix";
  const name = extractExplicitJobName(text);
  if (name) result.jobName = name.value.replace(/\.+$/, "");
  const workingDirectory = lastCaptured(text, [
    /\b(?:working\s+directory|work\s+directory|case\s+directory|case\s+path|path)\s*(?:should\s+be|is|=|:)?\s*["']?(\/[A-Za-z0-9._~\/-]+)/gi,
    /\brun\s+from\s+["']?(\/[A-Za-z0-9._~\/-]+)/gi,
  ]);
  if (workingDirectory) result.workingDirectory = workingDirectory.value.replace(/[.,;]+$/, "");
  const cpu = lastCaptured(text, [new RegExp(`\\b(${COUNT_TOKEN})\\s*(?:cpu|cpus|cpu cores?|cores?)\\b`, "gi")]);
  if (cpu) result.cpus = countValue(cpu.value);
  const memory = lastCaptured(text, [
    new RegExp(`\\b(${COUNT_TOKEN})\\s*(?:gb|gib)\\s*(?:of\\s+)?memory\\b`, "gi"),
    new RegExp(`\\bmemory\\s*(?:of|is|=|:)?\\s*(${COUNT_TOKEN})\\s*(?:gb|gib)\\b`, "gi"),
  ]);
  if (memory) result.memoryGb = countValue(memory.value);
  const gpu = lastCaptured(text, [new RegExp(`\\b(${COUNT_TOKEN}|no)\\s*(?:gpu|gpus)\\b`, "gi")]);
  if (gpu) result.gpus = countValue(gpu.value);
  const walltime = extractExplicitWalltime(text);
  if (walltime) result.walltime = walltime.value;
  const tasks = lastCaptured(text, [
    new RegExp(`\\bmpi\\s*(?:n|ranks?|tasks?|processes?)?\\s*(?:=|:)?\\s*(${COUNT_TOKEN})\\b`, "gi"),
    new RegExp(`\\b(${COUNT_TOKEN})\\s*(?:mpi\\s*)?(?:ranks?|tasks?|processes?)\\b`, "gi"),
  ]);
  if (tasks) result.tasks = countValue(tasks.value);
  const nodes = lastCaptured(text, [new RegExp(`\\b(${COUNT_TOKEN})\\s*(?:nodes?|compute nodes?)\\b`, "gi")]);
  if (nodes) result.nodes = countValue(nodes.value);
  return result;
}

export function extractExplicitJobName(description) {
  const match = lastCaptured(String(description || ""), [
    /\bname\s+(?:the\s+)?job(?:\s+as)?\s+["']?([A-Za-z0-9][A-Za-z0-9._-]{0,63})["']?/gi,
    /\b(?:the\s+)?job\s+name\s+(?:should\s+be|is|=|:)\s+["']?([A-Za-z0-9][A-Za-z0-9._-]{0,63})["']?/gi,
    /\b(?:the\s+)?job\s+(?:should\s+be\s+)?(?:called|named)\s+["']?([A-Za-z0-9][A-Za-z0-9._-]{0,63})["']?/gi,
    /\bcall\s+(?:(?:this\s+job|the\s+job|it)\s+)?["']?([A-Za-z0-9][A-Za-z0-9._-]{0,63})["']?/gi,
    /\buse\s+["']?([A-Za-z0-9][A-Za-z0-9._-]{0,63})["']?\s+as\s+(?:the\s+)?job\s*name\b/gi,
    /\bas\s+(?:the\s+)?job\s+name\s+["']?([A-Za-z0-9][A-Za-z0-9._-]{0,63})["']?/gi,
    /\bas\s+(?:the\s+)?job\s+(?!name\b)["']?([A-Za-z0-9][A-Za-z0-9._-]{0,63})["']?/gi,
  ]);
  return match ? { ...match, value: match.value.replace(/\.+$/, "") } : null;
}

export function durationToWalltime(value) {
  return extractExplicitWalltime(value)?.value || null;
}

export function extractExplicitWalltime(description) {
  const text = String(description || "");
  let latest = null;
  for (const match of text.matchAll(/\b(\d{1,3}):([0-5]\d):([0-5]\d)\b/g)) {
    latest = selectLaterDuration(latest, {
      index: match.index,
      end: match.index + match[0].length,
      seconds: Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]),
      quote: match[0],
    });
  }
  const unitPattern = /\b(\d+(?:\.\d+)?|zero|one|two|three|four|five|six|seven|eight|nine|ten|a|an|single)\s*(days?|hrs?|hours?|mins?|minutes?|secs?|seconds?)\b/gi;
  let group = null;
  for (const match of text.matchAll(unitPattern)) {
    const separator = group ? text.slice(group.end, match.index) : "";
    if (!group || !/^\s*(?:,|and)?\s*$/i.test(separator)) group = { index: match.index, seconds: 0 };
    const amount = countValue(match[1]);
    const unit = match[2].toLowerCase();
    const multiplier = unit.startsWith("d") ? 86400 : unit.startsWith("h") ? 3600 : unit.startsWith("m") ? 60 : 1;
    group.seconds += amount * multiplier;
    group.end = match.index + match[0].length;
    group.quote = text.slice(group.index, group.end);
    if (Number.isFinite(group.seconds) && group.seconds > 0 && Number.isInteger(group.seconds)) latest = selectLaterDuration(latest, group);
  }
  if (!latest) return null;
  const hours = Math.floor(latest.seconds / 3600);
  const minutes = Math.floor((latest.seconds % 3600) / 60);
  const seconds = latest.seconds % 60;
  return {
    index: latest.index,
    quote: latest.quote,
    value: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
  };
}

function selectLaterDuration(current, candidate) {
  return !current || candidate.index >= current.index ? candidate : current;
}

const COUNT_TOKEN = "(?:\\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten|a|an|single)";
const WORD_COUNTS = Object.freeze({ zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, a: 1, an: 1, single: 1, no: 0 });

function countValue(value) {
  const normalized = String(value).toLowerCase();
  return normalized in WORD_COUNTS ? WORD_COUNTS[normalized] : Number(normalized);
}

function lastCaptured(text, patterns) {
  let latest = null;
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      if (!latest || match.index > latest.index) latest = { index: match.index, value: match[1], quote: match[0] };
    }
  }
  return latest;
}

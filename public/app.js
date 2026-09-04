const $ = (selector) => document.querySelector(selector);
const OUTCOME_STORAGE_KEY = "solmate.outcomes.v1";
const API_BASE_URL = resolveApiBaseUrl(window.SOLMATE_CONFIG?.apiBaseUrl);
const motion = window.Motion || {};
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const state = {
  recommendations: new Map(),
  confirmedRecommendations: new Map(),
  acceptedFacts: [],
  formDraft: new Map(),
  script: "",
  filename: "solmate-job.slurm",
  nextQuestion: null,
  pendingAnswer: null,
  recommendationToken: null,
  generatedSpec: null,
  schedulerProfiles: [],
  schedulerUi: { glossary: {}, optionDescriptions: {} },
  localOutcomes: readOutcomeHistory(),
  latestAnalysis: null,
  apiAvailable: API_BASE_URL !== null,
};
let analysisTimer = null;
let analysisSequence = 0;
let intakeController = null;
let workflowTransitionSequence = 0;
let outputTransitionSequence = 0;
let docTransitionSequence = 0;
let activeDocAnchor = null;
let docPreviousFocus = null;

initialize();
initializeMotionExperience();

async function initialize() {
  try {
    const health = await api("/api/health");
    state.schedulerProfiles = Array.isArray(health.schedulerOptions) ? health.schedulerOptions : [];
    state.schedulerUi = health.schedulerUi || state.schedulerUi;
    $("#partitionLabel").title = state.schedulerUi.glossary?.partition?.definition || "Selects the hardware pool where the job may run.";
    $("#qosLabel").title = state.schedulerUi.glossary?.qos?.definition || "Sets scheduler time, priority, and preemption rules.";
    syncSchedulerOptions();
    $("#modeStatus").dataset.mode = health.mode;
    $("#modeLabel").textContent = health.mode === "mock" ? "MOCK | LOCAL FIXTURES" : `LIVE AIR | ${health.models.planner}`;
    $("#mockModeNotice").hidden = health.mode !== "mock";
    setApiAvailability(true);
  } catch (error) {
    $("#modeStatus").dataset.mode = "offline";
    $("#modeLabel").textContent = "AIR OFFLINE";
    $("#serviceNotice").hidden = false;
    $("#serviceNotice span").textContent = error.message;
    setApiAvailability(false);
  }
}

document.querySelectorAll(".tab").forEach((button) => button.addEventListener("click", () => switchWorkflow(button)));

async function switchWorkflow(button) {
  const target = $(`#${button.getAttribute("aria-controls")}`);
  const current = document.querySelector(".panel.active");
  if (!target || current === target) return;
  const sequence = ++workflowTransitionSequence;
  document.querySelectorAll(".tab").forEach((tab) => {
    const active = tab === button;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  if (current) await playMotion(current, { opacity: [1, 0], x: [0, -18] }, { duration: 0.16, ease: "easeIn" });
  if (sequence !== workflowTransitionSequence) return;
  document.querySelectorAll(".panel").forEach((panel) => {
    const active = panel === target;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  });
  await playMotion(target, { opacity: [0, 1], x: [22, 0] }, springTransition({ stiffness: 320, damping: 28 }));
}

document.querySelectorAll(".output-tab").forEach((button) => button.addEventListener("click", () => activateOutputTab(button.dataset.outputTab)));

async function activateOutputTab(name) {
  const next = document.querySelector(`[data-output-view="${CSS.escape(name)}"]`);
  const previous = document.querySelector(".output-view.active:not([hidden])");
  if (!next || previous === next) return;
  const sequence = ++outputTransitionSequence;
  if (previous) await playMotion(previous, { opacity: [1, 0], y: [0, -8] }, { duration: 0.12, ease: "easeIn" });
  if (sequence !== outputTransitionSequence) return;
  document.querySelectorAll(".output-tab").forEach((tab) => {
    const active = tab.dataset.outputTab === name;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll(".output-view").forEach((view) => {
    const active = view.dataset.outputView === name;
    view.classList.toggle("active", active);
    view.hidden = !active;
  });
  await playMotion(next, { opacity: [0, 1], y: [12, 0] }, springTransition({ stiffness: 360, damping: 31 }));
}

$("#description").addEventListener("input", () => {
  window.clearTimeout(analysisTimer);
  analysisSequence += 1;
  const description = $("#description").value.trim();
  if (!state.apiAvailable) {
    $("#analysisStatus").textContent = "Connect the server-side AIR API to analyze this workload.";
    return;
  }
  if (description.length < 10) {
    intakeController?.abort();
    setBusy($("#analyzeButton"), false, "Analyze with AIR");
    if (!description) resetPlanningOutput();
    $("#analysisStatus").textContent = "Add a little more detail for AIR to interpret the workload.";
    return;
  }
  markPlanningPending();
  $("#analysisStatus").textContent = "Waiting for a pause...";
  analysisTimer = window.setTimeout(() => runIntake({ automatic: true }), 800);
});

$("#analyzeButton").addEventListener("click", () => runIntake({ automatic: false }));

async function runIntake({ automatic, preserveRecommendations = false }) {
  if (!state.apiAvailable) return false;
  window.clearTimeout(analysisTimer);
  intakeController?.abort();
  intakeController = new AbortController();
  const controller = intakeController;
  const sequence = ++analysisSequence;
  const description = $("#description").value;
  updatePlanProgress("describe");
  setBusy($("#analyzeButton"), true, "AIR is interpreting the workflow...");
  $("#analysisStatus").textContent = "AIR is interpreting software, intent, resources, and conflicts...";
  $("#planError").textContent = "";
  try {
    const payload = await api("/api/intake", {
      description,
      priorFacts: state.acceptedFacts,
      priorRecommendationToken: preserveRecommendations ? state.recommendationToken : null,
      priorOutcomes: state.localOutcomes,
    }, { signal: controller.signal });
    if (sequence !== analysisSequence) return false;
    renderIntake(payload, { scroll: !automatic });
    $("#analysisStatus").textContent = `Interpreted by ${payload.agent.model} in ${payload.agent.latencyMs ?? "n/a"} ms.`;
    return true;
  } catch (error) {
    if (error.name === "AbortError") return false;
    if (sequence !== analysisSequence) return false;
    $("#planError").textContent = error.message;
    $("#analysisStatus").textContent = "AIR could not complete this analysis.";
    return false;
  } finally {
    if (intakeController === controller) intakeController = null;
    if (sequence === analysisSequence) setBusy($("#analyzeButton"), false, "Analyze again with AIR");
  }
}

function renderIntake(payload, { scroll = false } = {}) {
  const form = $("#specForm");
  updatePlanProgress("confirm");
  restoreSuggestionControls();
  form.reset();
  form.hidden = false;
  const extracted = payload.analysis.extracted || {};
  const currentValues = { ...extracted, workloadType: extracted.workloadType || payload.analysis.workloadType };
  if (currentValues.cluster) form.elements.namedItem("cluster").value = currentValues.cluster;
  syncSchedulerOptions({ partition: currentValues.partition, qos: currentValues.qos });
  for (const [field, value] of Object.entries(currentValues)) {
    const input = form.elements.namedItem(field);
    if (input && value !== null && value !== undefined) input.value = Array.isArray(value) ? value.join(field === "args" ? "\n" : ",") : value;
  }
  for (const field of Object.keys(extracted)) state.formDraft.delete(field);
  for (const [field, value] of state.formDraft) {
    const input = form.elements.namedItem(field);
    if (input && !Object.hasOwn(extracted, field)) input.value = value;
  }
  syncSchedulerOptions({ partition: form.elements.namedItem("partition").value, qos: form.elements.namedItem("qos").value });
  state.acceptedFacts = (payload.analysis.extractedEvidence || []).flatMap(({ field, quote }) => {
    const value = extracted[field];
    return value === null || value === undefined ? [] : [{ field, value, quote }];
  });
  state.recommendations.clear();
  state.recommendationToken = payload.recommendationToken || null;
  state.pendingAnswer = null;
  state.latestAnalysis = { workloadType: payload.analysis.workloadType, software: payload.analysis.software || null };
  renderInterpretation(payload.analysis);
  renderKnowledgeGrounding(payload.analysis.knowledgeSources || [], payload.analysis.localOutcomeCount || 0);
  const container = $("#recommendations");
  container.replaceChildren();
  for (const recommendation of payload.analysis.recommendations) state.recommendations.set(recommendation.field, recommendation);
  const partitionSuggestion = state.recommendations.get("partition")?.value;
  const qosSuggestion = state.recommendations.get("qos")?.value;
  syncSchedulerOptions({
    partition: form.elements.namedItem("partition").value || partitionSuggestion,
    qos: form.elements.namedItem("qos").value || qosSuggestion,
  });
  for (const recommendation of payload.analysis.recommendations) {
    const input = form.elements.namedItem(recommendation.field);
    if (input && !input.value) input.value = Array.isArray(recommendation.value) ? recommendation.value.join(recommendation.field === "args" ? "\n" : ",") : recommendation.value;
    const item = document.createElement("div");
    item.className = "recommendation";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.confirmField = recommendation.field;
    checkbox.setAttribute("aria-label", `Confirm ${recommendation.field}`);
    checkbox.checked = state.confirmedRecommendations.get(recommendation.field) === recommendationKey(recommendation.value);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) state.confirmedRecommendations.set(recommendation.field, recommendationKey(recommendation.value));
      else state.confirmedRecommendations.delete(recommendation.field);
      refreshReadinessMessage();
    });
    const identity = document.createElement("label");
    identity.className = "recommendation-identity";
    identity.append(checkbox);
    const field = document.createElement("strong"); field.textContent = recommendation.field;
    const value = document.createElement("span"); value.textContent = formatValue(recommendation.value);
    const confidence = document.createElement("small"); confidence.textContent = recommendation.uncertainty;
    identity.append(field, value, confidence);
    const details = document.createElement("details"); details.className = "recommendation-details";
    const summary = document.createElement("summary"); summary.textContent = "Why";
    const rationale = document.createElement("p"); rationale.textContent = recommendation.rationale;
    const assumptions = document.createElement("p"); assumptions.textContent = `Assumes: ${(recommendation.assumptions || []).join("; ") || "no additional assumptions"}.`;
    const tuning = document.createElement("p"); tuning.textContent = `Measure next: ${recommendation.tuningAdvice}`;
    details.append(summary, rationale, assumptions, tuning);
    item.append(identity, details);
    container.append(item);
  }
  animateStagger(container.children, { distance: 10, interval: 0.035 });
  animateStagger([...form.querySelectorAll("input, select, textarea")].filter((input) => input.value), { distance: 5, interval: 0.012 });
  for (const field of [...state.confirmedRecommendations.keys()]) {
    if (!state.recommendations.has(field)) state.confirmedRecommendations.delete(field);
  }
  $("#confirmAllSuggestions").hidden = payload.analysis.recommendations.length === 0;
  const recommendationReview = payload.analysis.recommendationReview;
  $("#recommendationReview").hidden = !recommendationReview;
  $("#recommendationReview").textContent = recommendationReview ? `Independent resource review: ${recommendationReview.findings.join(" ")}` : "";
  const agents = payload.agents || [payload.agent];
  $("#agentLine").textContent = agents.map((agent) => `${agent.role}: ${agent.model} | ${agent.latencyMs ?? "n/a"} ms`).join(" | ");
  updateResourceEstimate();
  refreshReadinessMessage();
  if (scroll) form.scrollIntoView({ behavior: "smooth", block: "start" });
}

const specForm = $("#specForm");
specForm.elements.namedItem("cluster").addEventListener("change", () => syncSchedulerOptions());
specForm.elements.namedItem("partition").addEventListener("change", () => syncSchedulerOptions({ partition: specForm.elements.namedItem("partition").value }));
specForm.elements.namedItem("qos").addEventListener("change", () => syncSchedulerOptions({ partition: specForm.elements.namedItem("partition").value, qos: specForm.elements.namedItem("qos").value }));

function syncSchedulerOptions({ partition, qos } = {}) {
  const form = $("#specForm");
  const cluster = form.elements.namedItem("cluster").value;
  const partitionSelect = form.elements.namedItem("partition");
  const qosSelect = form.elements.namedItem("qos");
  const profiles = state.schedulerProfiles.filter((profile) => profile.cluster === cluster);
  const selectedPartition = partition ?? partitionSelect.value;
  replaceSelectOptions(partitionSelect, unique(profiles.map((profile) => profile.partition)), cluster ? "Select hardware queue" : "Select cluster first", selectedPartition, (value) => schedulerOptionLabel("partition", value));
  partitionSelect.disabled = !cluster;
  const selectedQos = qos ?? qosSelect.value;
  const qosProfiles = profiles.filter((profile) => profile.partition === partitionSelect.value);
  replaceSelectOptions(qosSelect, unique(qosProfiles.map((profile) => profile.qos)), partitionSelect.value ? "Select run policy" : "Select hardware queue first", selectedQos, (value) => {
    const profile = qosProfiles.find((item) => item.qos === value);
    const label = schedulerOptionLabel("qos", value);
    return profile?.requiresAccount ? label + " (account required)" : label;
  });
  qosSelect.disabled = !partitionSelect.value;
  const selectedProfile = qosProfiles.find((profile) => profile.qos === qosSelect.value);
  const account = form.elements.namedItem("account");
  account.required = selectedProfile?.requiresAccount === true;
  account.placeholder = account.required ? "Required; verify with myaccounts" : "Optional; verify with myaccounts";
  $("#accountField").title = selectedProfile?.notes || (account.required ? "This scheduler profile requires an allocation account." : "Account access is never inferred by SolMate.");
}

function replaceSelectOptions(select, values, placeholder, selected, labelFor = (value) => value) {
  const options = [optionElement("", placeholder), ...values.map((value) => optionElement(value, labelFor(value)))];
  select.replaceChildren(...options);
  select.value = values.includes(selected) ? selected : "";
}

function optionElement(value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

function unique(values) { return [...new Set(values)].sort(); }

$("#confirmAllSuggestions").addEventListener("click", () => {
  document.querySelectorAll("[data-confirm-field]").forEach((checkbox) => {
    checkbox.checked = true;
    const recommendation = state.recommendations.get(checkbox.dataset.confirmField);
    if (recommendation) state.confirmedRecommendations.set(recommendation.field, recommendationKey(recommendation.value));
  });
  $("#generationStatus").textContent = "AIR suggestions confirmed. You can still edit any field before generation.";
  refreshReadinessMessage();
});

function renderInterpretation(analysis) {
  $("#airInterpretation").hidden = false;
  $("#workflowSummary").textContent = analysis.workflowSummary;
  $("#detectedSoftware").textContent = analysis.software ? `Detected software or framework: ${analysis.software}` : "No specific software or framework was named; the executable can still be configured below.";
  $("#recommendationBasis").textContent = analysis.recommendationBasis;
  renderCorrections(analysis.corrections || []);
  state.nextQuestion = analysis.nextQuestion;
  $("#advisorExchange").hidden = !analysis.nextQuestion;
  $("#advisorExchange").setAttribute("aria-busy", "false");
  $("#answerQuestionButton").disabled = false;
  $("#answerQuestionButton").textContent = "Send answer to AIR";
  $("#followupAnswer").disabled = false;
  $("#followupStatus").textContent = "";
  $("#nextQuestion").textContent = analysis.nextQuestion || "";
  renderList($("#conflictList"), analysis.detectedConflicts.map((item) => item.message));
  renderList($("#domainQuestionList"), analysis.domainQuestions);
  $("#conflictBlock").hidden = analysis.detectedConflicts.length === 0;
  $("#questionBlock").hidden = analysis.domainQuestions.length === 0;
}

function renderCorrections(corrections) {
  const bar = $("#correctionBar");
  const list = $("#correctionList");
  bar.hidden = corrections.length === 0;
  list.replaceChildren(...corrections.map((correction) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "correction-chip";
    button.textContent = `${correction.original} -> ${correction.suggested}`;
    button.title = correction.requiresConfirmation ? "Technical identifier: click to confirm this correction" : `AIR interpreted this ${correction.category} correction; click to apply it to the description`;
    button.addEventListener("click", () => {
      const description = $("#description");
      description.value = description.value.replace(correction.original, correction.suggested);
      description.dispatchEvent(new Event("input", { bubbles: true }));
    });
    return button;
  }));
}

$("#answerQuestionButton").addEventListener("click", async () => {
  const button = $("#answerQuestionButton");
  if (button.disabled) return;
  const answer = $("#followupAnswer").value.trim();
  if (!answer) {
    $("#planError").textContent = "Answer AIR's question, or edit the workload description directly.";
    return;
  }
  const description = $("#description");
  const addition = `Additional detail from the researcher: ${answer}`;
  if (state.pendingAnswer !== addition) {
    description.value = appendFollowupOnce(description.value, addition);
    state.pendingAnswer = addition;
  }
  button.disabled = true;
  button.textContent = "Answer received - AIR is updating...";
  $("#followupAnswer").disabled = true;
  $("#advisorExchange").setAttribute("aria-busy", "true");
  $("#followupStatus").textContent = "Your answer was added once. Please wait while AIR revises the plan.";
  const succeeded = await runIntake({ automatic: false, preserveRecommendations: true });
  if (succeeded) {
    $("#followupStatus").textContent = "AIR updated the plan using your answer.";
    return;
  }
  button.disabled = false;
  button.textContent = "Retry AIR analysis";
  $("#followupAnswer").disabled = false;
  $("#advisorExchange").setAttribute("aria-busy", "false");
  $("#followupStatus").textContent = "Your answer is saved and will not be duplicated. Retry when ready.";
});

function resetPlanningOutput() {
  $("#specForm").reset();
  $("#specForm").hidden = true;
  $("#airInterpretation").hidden = true;
  $("#results").hidden = true;
  $("#emptyState").hidden = false;
  state.recommendations.clear();
  state.confirmedRecommendations.clear();
  state.recommendationToken = null;
  state.acceptedFacts = [];
  state.formDraft.clear();
  state.nextQuestion = null;
  state.pendingAnswer = null;
  state.script = "";
  state.generatedSpec = null;
  state.latestAnalysis = null;
  $("#useGeneratedEvidenceButton").disabled = true;
  $("#planError").textContent = "";
  updatePlanProgress("describe");
}

function markPlanningPending() {
  restoreSuggestionControls();
  $("#results").hidden = true;
  $("#emptyState").hidden = false;
  state.script = "";
  state.generatedSpec = null;
  $("#useGeneratedEvidenceButton").disabled = true;
  state.pendingAnswer = null;
  $("#outcomeStatus").textContent = "";
  $("#planError").textContent = "";
  $("#generationStatus").textContent = "";
  $("#generationError").textContent = "";
  updatePlanProgress("describe");
  if (!$("#specForm").hidden) {
    $("#missingFields").textContent = "Changes are awaiting AIR verification; the last good values remain visible.";
  }
}

$("#specForm").addEventListener("input", (event) => {
  const input = event.target;
  updateResourceEstimate();
  if (!input.name || input.dataset.confirmField) return;
  if (state.generatedSpec) invalidateGeneratedResult();
  state.formDraft.set(input.name, input.value);
  const recommendation = state.recommendations.get(input.name);
  const checkbox = document.querySelector(`[data-confirm-field="${CSS.escape(input.name)}"]`);
  if (recommendation && checkbox && !inputMatchesRecommendation(input, recommendation.value)) {
    checkbox.checked = false;
    state.confirmedRecommendations.delete(input.name);
  }
  refreshReadinessMessage();
});

function updateResourceEstimate() {
  const form = $("#specForm");
  const number = (name) => Number(form.elements.namedItem(name)?.value || 0);
  const cpus = number("cpus");
  const tasks = number("tasks") || 1;
  const nodes = number("nodes") || 1;
  const gpus = number("gpus");
  const memory = number("memoryGb");
  const parts = String(form.elements.namedItem("walltime")?.value || "").split(":").map(Number);
  const hours = parts.length === 3 && parts.every(Number.isFinite) ? parts[0] + parts[1] / 60 + parts[2] / 3600 : 0;
  const totalCores = cpus * tasks;
  const estimate = $("#resourceEstimate");
  estimate.hidden = !(cpus && memory);
  if (!estimate.hidden) estimate.textContent = `${totalCores} total cores | ${round(totalCores * hours)} core-hours | ${round(memory / tasks)} GB/task | ${round(gpus * nodes * hours)} GPU-hours`;
}

function appendFollowupOnce(description, addition) {
  const paragraphs = String(description).split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
  const seenFollowups = new Set();
  const unique = paragraphs.filter((paragraph) => {
    if (!/^additional detail from the researcher:/i.test(paragraph)) return true;
    const key = paragraph.replace(/\s+/g, " ").toLowerCase();
    if (seenFollowups.has(key)) return false;
    seenFollowups.add(key);
    return true;
  });
  const additionKey = addition.replace(/\s+/g, " ").toLowerCase();
  if (!seenFollowups.has(additionKey)) unique.push(addition);
  return unique.join("\n\n");
}

$("#specForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("#generateButton");
  setBusy(button, true, "Validating and reviewing...");
  $("#planError").textContent = "";
  $("#generationError").textContent = "";
  $("#generationStatus").textContent = "Validating the specification, rendering the script, and asking AIR for an independent review...";
  try {
    const form = event.currentTarget;
    const confirmed = [...form.querySelectorAll("[data-confirm-field]:checked")].map((box) => box.dataset.confirmField);
    const unconfirmed = [...state.recommendations.keys()].filter((field) => {
      const input = form.elements.namedItem(field);
      return input && inputMatchesRecommendation(input, state.recommendations.get(field).value) && !confirmed.includes(field);
    });
    const spec = readSpec(form);
    const missing = missingLocalFields(spec);
    const blockers = [
      missing.length ? `Enter required values for: ${missing.join(", ")}.` : "",
      unconfirmed.length ? `Confirm or change AIR recommendations for: ${unconfirmed.join(", ")}.` : "",
    ].filter(Boolean);
    if (blockers.length) throw new Error(blockers.join(" "));
    const payload = await api("/api/generate", { description: $("#description").value, spec, confirmedRecommendationFields: confirmed, recommendationToken: state.recommendationToken });
    renderGenerated(payload);
    $("#generationStatus").textContent = "Validation passed and the reviewed Slurm script is ready.";
  } catch (error) {
    $("#generationError").textContent = error.message;
    $("#generationStatus").textContent = "Generation stopped. Correct the highlighted requirement and try again.";
    $("#generationError").scrollIntoView({ behavior: "smooth", block: "center" });
  } finally {
    setBusy(button, false, "Validate and generate");
  }
});

function readSpec(form) {
  const value = (name) => form.elements.namedItem(name).value.trim();
  const integer = (name) => value(name) === "" ? null : Number(value(name));
  return {
    cluster: value("cluster"), workloadType: value("workloadType"), jobName: value("jobName"),
    workingDirectory: value("workingDirectory"), cpus: integer("cpus"), gpus: integer("gpus"),
    nodes: integer("nodes"), tasks: integer("tasks"),
    memoryGb: integer("memoryGb"), walltime: value("walltime"), partition: value("partition"), qos: value("qos"), account: value("account") || undefined,
    outputPath: value("outputPath"), errorPath: value("errorPath"),
    modules: value("modules") ? value("modules").split(",").map((item) => item.trim()).filter(Boolean) : [],
    executable: value("executable"), args: value("args") ? value("args").split("\n").map((item) => item.trim()).filter(Boolean) : [],
    epochs: integer("epochs"), rationale: "Resources were supplied or explicitly confirmed through the guided intake."
  };
}

function missingLocalFields(spec) {
  const required = ["cluster", "workloadType", "jobName", "workingDirectory", "cpus", "gpus", "memoryGb", "walltime", "partition", "qos", "outputPath", "errorPath", "executable"];
  if (spec.workloadType === "ml_training") required.push("epochs");
  if (spec.workloadType === "distributed" || (Number.isInteger(spec.tasks) && spec.tasks > 1)) required.push("nodes", "tasks");
  const profile = state.schedulerProfiles.find((item) => item.cluster === spec.cluster && item.partition === spec.partition && item.qos === spec.qos);
  if (profile?.requiresAccount) required.push("account");
  return required.filter((field) => spec[field] === null || spec[field] === undefined || spec[field] === "");
}

function refreshReadinessMessage() {
  const form = $("#specForm");
  if (form.hidden) return;
  const missing = missingLocalFields(readSpec(form));
  const unconfirmed = [...state.recommendations.keys()].filter((field) => {
    const input = form.elements.namedItem(field);
    const checkbox = document.querySelector(`[data-confirm-field="${CSS.escape(field)}"]`);
    return input && inputMatchesRecommendation(input, state.recommendations.get(field).value) && !checkbox?.checked;
  });
  const messages = [];
  if (missing.length) messages.push(`Still needs your input: ${missing.join(", ")}.`);
  if (unconfirmed.length) messages.push(`Confirm or change AIR recommendations: ${unconfirmed.join(", ")}.`);
  $("#missingFields").textContent = messages.join(" ") || "Ready for deterministic validation and AIR review.";
}

function renderGenerated(payload) {
  $("#emptyState").hidden = true;
  $("#results").hidden = false;
  state.script = payload.script;
  state.generatedSpec = payload.spec;
  updatePlanProgress("review");
  showAcceptedSuggestions(payload.spec);
  $("#useGeneratedEvidenceButton").disabled = false;
  state.filename = `${payload.spec.jobName}.slurm`;
  $("#validationBadge").textContent = "Validation passed";
  $("#reviewBadge").textContent = payload.review.verdict;
  $("#agentLine").textContent = payload.agents.map((agent) => `${agent.role}: ${agent.model} | ${agent.latencyMs ?? "n/a"} ms`).join(" | ");
  $("#scriptOutput").textContent = payload.script;
  activateOutputTab("script");
  const metrics = payload.guidance.metrics;
  const fields = [["Total cores", metrics.totalCpuCores], ["Core-hours", metrics.coreHours], ["Memory/task", `${metrics.memoryPerTaskGb} GB`], ["GPU-hours", metrics.gpuHours], ["Partition", payload.spec.partition], ["QoS", payload.spec.qos]];
  $("#resourceSummary").replaceChildren(...fields.map(([label, value]) => {
    const wrapper = document.createElement("div");
    const dt = document.createElement("dt"); dt.textContent = label;
    const dd = document.createElement("dd"); dd.textContent = value;
    wrapper.append(dt, dd); return wrapper;
  }));
  renderList($("#reviewList"), [...payload.validation.warnings, ...payload.review.findings, ...payload.review.recommendations]);
  renderExplanations(payload.explanations, payload.agents.find((agent) => agent.role === "explainer"));
  renderGuidance(payload.guidance);
  renderSourceLinks($("#generationKnowledgeSources"), payload.knowledgeSources || []);
  renderOutcomeSelection();
  animateResultReveal($("#results"));
}

function showAcceptedSuggestions(spec) {
  const acceptedFields = Object.entries(spec.provenance || {})
    .filter(([, source]) => source === "air_recommended_user_confirmed")
    .map(([field]) => field);
  $("#recommendationHeadingLabel").textContent = "Accepted suggestions";
  $("#recommendations").hidden = true;
  $("#confirmAllSuggestions").hidden = true;
  $("#recommendationReview").hidden = true;
  $("#acceptedSuggestions").hidden = false;
  $("#acceptedSuggestions").textContent = acceptedFields.length
    ? `${acceptedFields.length} AIR suggestion${acceptedFields.length === 1 ? "" : "s"} accepted and included in the reviewed script.`
    : "Requirements validated and reviewed; no AIR suggestions remain pending.";
  $("#missingFields").textContent = "Requirements validated. The generated script reflects the confirmed form values.";
  $("#confirmationSubtitle").textContent = "Requirements validated and reviewed.";
}

function restoreSuggestionControls() {
  $("#recommendationHeadingLabel").textContent = "AIR suggestions";
  $("#recommendations").hidden = false;
  $("#acceptedSuggestions").hidden = true;
  $("#confirmationSubtitle").textContent = "Recommended values remain advisory until confirmed.";
}

function invalidateGeneratedResult() {
  state.script = "";
  state.generatedSpec = null;
  $("#results").hidden = true;
  $("#emptyState").hidden = false;
  $("#emptyState").textContent = "Requirements changed; validate again to refresh the reviewed output.";
  $("#useGeneratedEvidenceButton").disabled = true;
  $("#generationStatus").textContent = "Requirements changed. Validate and generate again.";
  restoreSuggestionControls();
  $("#confirmAllSuggestions").hidden = state.recommendations.size === 0;
  $("#recommendationReview").hidden = true;
  updatePlanProgress("confirm");
}

function renderExplanations(explanations, agent) {
  $("#explanationAgent").textContent = agent ? `${agent.model} | ${agent.latencyMs ?? "n/a"} ms` : "Validated built-in explanations";
  $("#scriptExplanations").replaceChildren(...explanations.map((explanation) => {
    const item = document.createElement("li");
    const code = document.createElement("code"); code.textContent = explanation.line;
    const meaning = document.createElement("p"); meaning.textContent = explanation.meaning;
    const tip = document.createElement("small"); tip.textContent = explanation.newcomerTip;
    item.append(code, meaning, tip); return item;
  }));
}

function renderGuidance(guidance) {
  const firstRun = $("#firstRunPlan");
  const title = document.createElement("strong"); title.textContent = guidance.firstRun.label;
  const summary = document.createElement("span"); summary.textContent = guidance.firstRun.summary;
  const measures = document.createElement("small"); measures.textContent = `Measure: ${guidance.firstRun.measurements.join(", ")}.`;
  firstRun.replaceChildren(title, summary, measures);
  const warnings = guidance.beginnerWarnings.length ? guidance.beginnerWarnings : ["No common beginner configuration conflicts were detected."];
  renderList($("#beginnerWarnings"), warnings);
  $("#readinessChecks").replaceChildren(...guidance.readinessChecks.map((check) => {
    const item = document.createElement("li");
    const label = document.createElement("strong"); label.textContent = check.label;
    const code = document.createElement("code"); code.textContent = check.command;
    const button = document.createElement("button"); button.type = "button"; button.className = "secondary"; button.textContent = "Copy";
    button.addEventListener("click", () => copyText(check.command, button));
    item.append(label, code, button); return item;
  }));
  $("#toolGuidance").replaceChildren(...(guidance.tools || []).map((tool) => {
    const item = document.createElement("li");
    const label = document.createElement("strong"); label.textContent = tool.label + " - " + tool.when;
    const code = document.createElement("code"); code.textContent = tool.command;
    const source = document.createElement("a"); source.href = tool.source.url; source.target = "_blank"; source.rel = "noreferrer"; source.textContent = "ASU guide";
    source.dataset.docPreview = "";
    source.dataset.docSummary = tool.source.summary || `Official ASU Research Computing guidance for ${tool.label}.`;
    const button = document.createElement("button"); button.type = "button"; button.className = "secondary"; button.textContent = "Copy";
    button.addEventListener("click", () => copyText(tool.command, button));
    item.append(label, code, button, source); return item;
  }));
}

document.querySelectorAll("[data-outcome]").forEach((button) => button.addEventListener("click", () => saveOutcome(button.dataset.outcome)));

function saveOutcome(outcome) {
  if (!state.generatedSpec || !state.latestAnalysis) return;
  const spec = state.generatedSpec;
  const record = {
    outcome,
    workloadType: state.latestAnalysis.workloadType,
    software: state.latestAnalysis.software || undefined,
    cpus: spec.cpus,
    gpus: spec.gpus,
    memoryGb: spec.memoryGb,
    nodes: spec.nodes,
    tasks: spec.tasks,
    walltime: spec.walltime,
    partition: spec.partition,
    qos: spec.qos,
  };
  const signature = outcomeSignature(record);
  state.localOutcomes = [...state.localOutcomes.filter((item) => outcomeSignature(item) !== signature), record].slice(-12);
  try { window.localStorage.setItem(OUTCOME_STORAGE_KEY, JSON.stringify(state.localOutcomes)); } catch { /* Storage may be disabled. */ }
  renderOutcomeSelection(outcome);
  $("#outcomeStatus").textContent = "Outcome saved locally. AIR can use it as advisory context on the next analysis.";
}

function renderOutcomeSelection(selected = null) {
  document.querySelectorAll("[data-outcome]").forEach((button) => {
    const active = button.dataset.outcome === selected;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  if (!selected) $("#outcomeStatus").textContent = "";
}

function readOutcomeHistory() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(OUTCOME_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.slice(-12).map(normalizeBrowserOutcome).filter(Boolean) : [];
  } catch { return []; }
}

function normalizeBrowserOutcome(record) {
  if (!record || !["succeeded", "submission_failed", "runtime_failed", "resources_off"].includes(record.outcome)) return null;
  if (!["general", "simulation", "ml_training", "distributed"].includes(record.workloadType)) return null;
  const clean = { outcome: record.outcome, workloadType: record.workloadType };
  if (typeof record.software === "string" && /^[A-Za-z0-9._+-]{1,64}$/.test(record.software)) clean.software = record.software;
  for (const [field, min, max] of [["cpus", 1, 4096], ["gpus", 0, 64], ["memoryGb", 1, 32768], ["nodes", 1, 256], ["tasks", 1, 4096]]) {
    if (Number.isInteger(record[field]) && record[field] >= min && record[field] <= max) clean[field] = record[field];
  }
  if (typeof record.walltime === "string" && /^\d{2,3}:[0-5]\d:[0-5]\d$/.test(record.walltime)) clean.walltime = record.walltime;
  if (typeof record.partition === "string" && /^[A-Za-z0-9._+-]{1,64}$/.test(record.partition)) clean.partition = record.partition;
  if (typeof record.qos === "string" && /^[A-Za-z0-9._+-]{1,64}$/.test(record.qos)) clean.qos = record.qos;
  return clean;
}

function outcomeSignature(record) {
  return [record.workloadType, record.software || "", record.cpus, record.gpus, record.memoryGb, record.nodes, record.tasks, record.walltime, record.partition, record.qos].join("|");
}

function renderKnowledgeGrounding(sources, outcomeCount) {
  const bar = $("#groundingBar");
  bar.hidden = sources.length === 0 && outcomeCount === 0;
  renderSourceLinks($("#knowledgeSources"), sources);
  $("#outcomeContext").textContent = outcomeCount ? outcomeCount + " local outcome" + (outcomeCount === 1 ? "" : "s") + " supplied as advisory context" : "";
}

function renderSourceLinks(container, sources) {
  const uniqueSources = [...new Map(sources.map((source) => [source.url, source])).values()];
  container.replaceChildren(...uniqueSources.map((source) => {
    const item = document.createElement("li");
    const anchor = document.createElement("a"); anchor.href = source.url; anchor.target = "_blank"; anchor.rel = "noreferrer"; anchor.textContent = source.title;
    anchor.dataset.docPreview = "";
    anchor.dataset.docSummary = source.summary || "Official guidance from ASU Research Computing.";
    item.append(anchor); return item;
  }));
}

function schedulerOptionLabel(kind, value) {
  const description = state.schedulerUi.optionDescriptions?.[kind]?.[value];
  return description ? value + " - " + description : value;
}

$("#copyScriptButton").addEventListener("click", () => copyText(state.script, $("#copyScriptButton")));
$("#downloadButton").addEventListener("click", () => {
  const url = URL.createObjectURL(new Blob([state.script.replaceAll("\r\n", "\n")], { type: "text/plain;charset=utf-8" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = state.filename; anchor.click(); URL.revokeObjectURL(url);
});

$("#handoffForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#handoffError").textContent = "";
  const data = Object.fromEntries(new FormData(event.currentTarget));
  try {
    const payload = await api("/api/handoff", { ...data, filename: state.filename });
    const ordinary = payload.steps;
    $("#handoffSteps").replaceChildren(...ordinary.map((step) => {
      const item = document.createElement("li");
      const label = document.createElement("strong"); label.textContent = step.label;
      const code = document.createElement(step.kind === "link" ? "a" : "code"); code.textContent = step.command;
      if (step.kind === "link") { code.href = step.command; code.target = "_blank"; code.rel = "noreferrer"; }
      const button = document.createElement("button"); button.type = "button"; button.className = "secondary"; button.textContent = step.unresolved ? "Add job ID to enable" : "Copy";
      button.disabled = step.unresolved || step.kind === "link";
      if (!button.disabled) button.addEventListener("click", () => copyText(step.command, button));
      item.append(label, code); if (step.kind !== "link") item.append(button); return item;
    }));
    const acknowledgement = $("#submissionAcknowledgement");
    acknowledgement.hidden = !payload.submissionRequired;
    acknowledgement.querySelector("input").checked = false;
    const submitContainer = $("#submitStep"); submitContainer.hidden = true; submitContainer.replaceChildren();
    acknowledgement.onchange = async () => {
      const checked = acknowledgement.querySelector("input").checked;
      submitContainer.hidden = true; submitContainer.replaceChildren();
      if (!checked) return;
      try {
        const acknowledgedPayload = await api("/api/handoff", { ...data, filename: state.filename, acknowledged: true, acknowledgementToken: payload.acknowledgementToken });
        const submit = acknowledgedPayload.steps.find((step) => step.requiresAcknowledgement);
        if (!submit) throw new Error("Submission command was not authorized.");
        submitContainer.append(commandControl(submit)); submitContainer.hidden = false;
      } catch (error) {
        acknowledgement.querySelector("input").checked = false;
        $("#handoffError").textContent = error.message;
      }
    };
  } catch (error) { $("#handoffError").textContent = error.message; }
});

function commandControl(step) {
  const wrapper = document.createElement("div"); wrapper.className = "submit-command";
  const label = document.createElement("strong"); label.textContent = step.label;
  const code = document.createElement("code"); code.textContent = step.command;
  const button = document.createElement("button"); button.type = "button"; button.className = "secondary"; button.textContent = "Copy submit command";
  button.addEventListener("click", () => copyText(step.command, button));
  wrapper.append(label, code, button); return wrapper;
}

$("#useGeneratedEvidenceButton").addEventListener("click", () => {
  if (!state.script || !state.generatedSpec) return;
  const form = $("#diagnosisForm");
  form.elements.namedItem("script").value = state.script;
  $("#diagnosisDemoStatus").textContent = "";
  $("#diagnosisError").textContent = "Generated script attached; add the real failure log and scheduler metadata.";
});

$("#loadDiagnosisDemoButton").addEventListener("click", async () => {
  const button = $("#loadDiagnosisDemoButton");
  setBusy(button, true, "Loading documented demo...");
  $("#diagnosisError").textContent = "";
  $("#diagnosisDemoStatus").textContent = "";
  try {
    const demo = await api("/api/demo-diagnosis");
    const form = $("#diagnosisForm");
    form.elements.namedItem("cluster").value = demo.cluster;
    form.elements.namedItem("script").value = demo.script;
    form.elements.namedItem("log").value = demo.log;
    for (const field of ["State", "Reason", "ExitCode", "Elapsed", "ReqMem", "MaxRSS", "AllocTRES"]) {
      form.elements.namedItem(field).value = demo.metadata[field] || "";
    }
    $("#diagnosisResult").hidden = true;
    $("#diagnosisEmpty").hidden = false;
    $("#diagnosisAgent").textContent = "Documented demo loaded; AIR diagnosis has not run yet.";
    $("#diagnosisDemoStatus").textContent = `Synthetic demo loaded: ${demo.label}. Click Diagnose with AIR.`;
    form.elements.namedItem("log").scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (error) {
    $("#diagnosisError").textContent = error.message;
  } finally {
    setBusy(button, false, "Load documented demo");
  }
});

$("#failurePhase").addEventListener("change", () => {
  const submission = $("#failurePhase").value === "submission";
  $("#failureJobId").disabled = submission;
  if (submission) $("#failureJobId").value = "";
  $("#evidenceGuideResult").hidden = true;
});

$("#buildEvidenceButton").addEventListener("click", async () => {
  const button = $("#buildEvidenceButton");
  setBusy(button, true, "Building commands...");
  $("#diagnosisError").textContent = "";
  try {
    const payload = await api("/api/failure-evidence", { phase: $("#failurePhase").value, jobId: $("#failureJobId").value });
    $("#evidenceGuideNotice").textContent = payload.notice;
    $("#evidenceCommands").replaceChildren(...payload.commands.map((step) => {
      const item = document.createElement("li");
      const label = document.createElement("strong"); label.textContent = step.label;
      const code = document.createElement("code"); code.textContent = step.command;
      const copy = document.createElement("button"); copy.type = "button"; copy.className = "secondary"; copy.textContent = "Copy";
      copy.addEventListener("click", () => copyText(step.command, copy));
      item.append(label, code, copy);
      return item;
    }));
    $("#evidenceGuideResult").hidden = false;
  } catch (error) { $("#diagnosisError").textContent = error.message; }
  finally { setBusy(button, false, "Build evidence commands"); }
});

$("#diagnosisForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("#diagnoseButton");
  setBusy(button, true, "AIR is examining evidence...");
  $("#diagnosisError").textContent = "";
  const data = Object.fromEntries(new FormData(event.currentTarget));
  const metadata = Object.fromEntries(["State", "Reason", "ExitCode", "Elapsed", "ReqMem", "MaxRSS", "AllocTRES"].filter((field) => data[field]).map((field) => [field, data[field]]));
  try {
    const originalSpec = state.generatedSpec && data.script === state.script ? state.generatedSpec : null;
    const payload = await api("/api/diagnose", { cluster: data.cluster, script: data.script, log: data.log, metadata, originalSpec });
    renderDiagnosis(payload);
  } catch (error) { $("#diagnosisError").textContent = error.message; }
  finally { setBusy(button, false, "Diagnose with AIR"); }
});

function renderDiagnosis(payload) {
  $("#diagnosisEmpty").hidden = true;
  $("#diagnosisResult").hidden = false;
  $("#confidenceBadge").textContent = payload.diagnosis.confidence;
  $("#categoryBadge").textContent = payload.diagnosis.category.replaceAll("_", " ");
  $("#dispositionLabel").textContent = payload.disposition?.label || "Review required";
  $("#dispositionDetail").textContent = payload.disposition?.detail || "Review the evidence before changing or resubmitting the job.";
  $("#dispositionLink").hidden = payload.disposition?.id !== "support";
  $("#diagnosisExplanation").textContent = payload.diagnosis.explanation;
  const validationLabel = payload.diagnosisValidation?.airAccepted === false
    ? "AIR response rejected; verified checks shown"
    : "AIR evidence validated";
  $("#diagnosisAgent").textContent = `Diagnostician: ${payload.agent.model} | ${payload.agent.latencyMs ?? "n/a"} ms | ${validationLabel}`;
  renderList($("#evidenceList"), payload.diagnosis.evidence.map((item) => item.source === "metadata" ? `${item.field}: ${item.text}` : `Line ${item.lineNumber}: ${item.text}`));
  renderOptionalList($("#deterministicFindings"), payload.deterministicFindings.map((item) => `${item.confidence}: ${item.explanation}`));
  renderOptionalList($("#diagnosisAlternatives"), payload.diagnosis.alternatives || []);
  renderOptionalList($("#missingEvidence"), payload.diagnosis.missingEvidence || []);
  renderList($("#diagnosisRecommendations"), payload.diagnosis.recommendations);
  const ruleSources = payload.applicableRules.map((rule) => ({ title: rule.id + ": " + rule.category, url: rule.source }));
  renderSourceLinks($("#diagnosisSources"), [...ruleSources, ...(payload.knowledgeSources || [])]);
  const comparison = $("#repairComparison"); comparison.hidden = !payload.repair;
  if (payload.repair) { $("#originalScript").textContent = state.script; $("#proposedScript").textContent = payload.repair.script; }
  $("#redactionNote").textContent = payload.redactions ? `${payload.redactions} sensitive value(s) were redacted before the AIR request.` : "No sensitive patterns were detected.";
  animateResultReveal($("#diagnosisResult"));
}

async function api(url, body, { signal } = {}) {
  if (API_BASE_URL === null) throw new Error("Connect the deployed interface to a server-side AIR API before running analysis.");
  const endpoint = `${API_BASE_URL}${url}`;
  const response = await fetch(endpoint, body === undefined ? { signal } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : { error: `Service returned HTTP ${response.status}.` };
  if (!response.ok) {
    const details = payload.validation?.errors?.join(" ") || (payload.missingFields?.length ? `Still required: ${payload.missingFields.join(", ")}.` : payload.error);
    throw new Error(details || "Request failed.");
  }
  return payload;
}

function renderList(container, items) {
  container.replaceChildren(...items.map((text) => { const item = document.createElement("li"); item.textContent = text; return item; }));
}
function renderOptionalList(container, items) {
  renderList(container, items);
  container.closest(".evidence-block").hidden = items.length === 0;
}
function setBusy(button, busy, label) {
  button.disabled = busy;
  button.textContent = label;
  button.setAttribute("aria-busy", String(busy));
}
function formatValue(value) { return Array.isArray(value) ? (value.length ? value.join(", ") : "none") : String(value); }
function recommendationKey(value) { return JSON.stringify(value); }
function hasFormValue(input) { return input && String(input.value).trim() !== ""; }
function round(value) { return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0; }
function inputMatchesRecommendation(input, recommendation) {
  if (Array.isArray(recommendation)) {
    const separator = input.name === "args" ? "\n" : ",";
    return input.value.split(separator).map((item) => item.trim()).filter(Boolean).join("\u0000") === recommendation.join("\u0000");
  }
  return String(input.value) === String(recommendation);
}
async function copyText(text, button) {
  await navigator.clipboard.writeText(text);
  const old = button.textContent;
  button.textContent = "Copied";
  showToast("Copied to clipboard");
  setTimeout(() => { button.textContent = old; }, 1000);
}

function resolveApiBaseUrl(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) return window.location.hostname.endsWith("github.io") ? null : "";
  try {
    const url = new URL(value);
    const localHttp = url.protocol === "http:" && new Set(["localhost", "127.0.0.1"]).has(url.hostname);
    if (url.protocol !== "https:" && !localHttp) return null;
    return url.href.replace(/\/$/, "");
  } catch {
    return null;
  }
}

function setApiAvailability(available) {
  state.apiAvailable = available;
  const controls = ["#analyzeButton", "#answerQuestionButton", "#generateButton", "#buildEvidenceButton", "#loadDiagnosisDemoButton", "#diagnoseButton", "#handoffForm button[type=submit]"];
  for (const selector of controls) {
    const control = $(selector);
    if (control) control.disabled = !available;
  }
  if (available) $("#serviceNotice").hidden = true;
}

function updatePlanProgress(stage) {
  const order = ["describe", "confirm", "review"];
  const activeIndex = order.indexOf(stage);
  document.querySelectorAll("#planProgress [data-progress]").forEach((item) => {
    const index = order.indexOf(item.dataset.progress);
    item.classList.toggle("current", index === activeIndex);
    item.classList.toggle("complete", index < activeIndex);
    if (index === activeIndex) item.setAttribute("aria-current", "step");
    else item.removeAttribute("aria-current");
  });
  const activeMarker = document.querySelector("#planProgress .current span");
  if (activeMarker) playMotion(activeMarker, { scale: [0.68, 1] }, springTransition({ stiffness: 480, damping: 24 }));
}

let toastTimer = null;
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.hidden = false;
  playMotion(toast, { opacity: [0, 1], y: [16, 0], scale: [0.96, 1] }, springTransition({ stiffness: 420, damping: 30 }));
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(async () => {
    await playMotion(toast, { opacity: [1, 0], y: [0, 10] }, { duration: 0.16, ease: "easeIn" });
    toast.hidden = true;
  }, 1800);
}

function initializeMotionExperience() {
  document.documentElement.classList.add("motion-ready");
  window.lucide?.createIcons?.({ attrs: { "aria-hidden": "true" } });
  setupDocPreviews();
  setupQuickActions();
  setupPointerHalo();
  if (reducedMotion || typeof motion.animate !== "function") return;

  playMotion(document.querySelectorAll(".brand, .header-actions"), { opacity: [0, 1], y: [-12, 0] }, { duration: 0.42, delay: motion.stagger?.(0.08), ease: "circOut" });
  playMotion($(".tabs"), { opacity: [0, 1], y: [-8, 0] }, { duration: 0.35, delay: 0.1, ease: "circOut" });
  playMotion($(".work-grid"), { opacity: [0, 1], y: [24, 0], scale: [0.985, 1] }, springTransition({ stiffness: 260, damping: 27, delay: 0.12 }));
  playMotion($("#quickActionToggle"), { opacity: [0, 1], scale: [0.55, 1] }, springTransition({ stiffness: 460, damping: 24, delay: 0.3 }));

  setupScrollMotion();
  if (typeof motion.inView === "function") {
    motion.inView(".section-title, .evidence-strip, .motion-reveal", (element) => {
      const prominent = element.classList.contains("motion-reveal");
      playMotion(element, { opacity: [0.28, 1], y: [prominent ? 34 : 16, 0], scale: [prominent ? 0.98 : 0.995, 1] }, springTransition({ stiffness: 290, damping: 28 }));
      return () => playMotion(element, { opacity: prominent ? 0.82 : 0.68, y: -5 }, { duration: 0.16, ease: "easeOut" });
    }, { margin: "-8% 0px -10% 0px", amount: 0.25 });
    motion.inView(".support-link", (element) => {
      playMotion(element, { opacity: [0, 1], y: [24, 0], rotate: [1.2, 0] }, springTransition({ stiffness: 330, damping: 27 }));
    }, { margin: "-4% 0px -4% 0px", amount: 0.35 });
  }
  if (typeof motion.press === "function") {
    motion.press("button", (element) => {
      playMotion(element, { scale: 0.97 }, { duration: 0.08, ease: "easeOut" });
      return () => playMotion(element, { scale: 1 }, springTransition({ stiffness: 520, damping: 25 }));
    });
  }
  document.addEventListener("change", (event) => {
    if (!event.target.matches("input, select, textarea")) return;
    playMotion(event.target, { scale: [0.985, 1] }, springTransition({ stiffness: 500, damping: 28 }));
  });
}

function setupScrollMotion() {
  if (typeof motion.scroll !== "function") return;
  const progressBar = $("#scrollProgress");
  const brandMark = document.querySelector(".brand-mark");
  let target = 0;
  let current = 0;
  let velocity = 0;
  let frame = 0;
  const update = () => {
    velocity = (velocity + (target - current) * 0.16) * 0.72;
    current += velocity;
    progressBar.style.transform = `scaleX(${Math.max(0, Math.min(1, current))})`;
    document.documentElement.style.setProperty("--page-progress", current.toFixed(4));
    if (brandMark) brandMark.style.transform = `translateY(${(current * 3).toFixed(2)}px) rotate(${(current * 6).toFixed(2)}deg)`;
    if (Math.abs(target - current) > 0.0002 || Math.abs(velocity) > 0.0002) frame = requestAnimationFrame(update);
    else frame = 0;
  };
  motion.scroll((progress) => {
    target = progress;
    if (!frame) frame = requestAnimationFrame(update);
  });
}

function setupPointerHalo() {
  const halo = $("#pointerHalo");
  if (!halo || reducedMotion || !window.matchMedia("(pointer: fine)").matches) return;
  const pointer = { x: -40, y: -40, width: 18, height: 18 };
  const target = { ...pointer };
  const velocity = { x: 0, y: 0, width: 0, height: 0 };
  let frame = 0;

  const tick = () => {
    let moving = false;
    for (const key of ["x", "y", "width", "height"]) {
      velocity[key] = (velocity[key] + (target[key] - pointer[key]) * 0.2) * 0.64;
      pointer[key] += velocity[key];
      moving ||= Math.abs(target[key] - pointer[key]) > 0.04 || Math.abs(velocity[key]) > 0.04;
    }
    halo.style.width = `${Math.max(10, pointer.width)}px`;
    halo.style.height = `${Math.max(10, pointer.height)}px`;
    halo.style.borderRadius = `${Math.min(pointer.width, pointer.height) / 2}px`;
    halo.style.transform = `translate3d(${pointer.x - pointer.width / 2}px, ${pointer.y - pointer.height / 2}px, 0)`;
    frame = moving ? requestAnimationFrame(tick) : 0;
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(tick); };

  document.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    const magnetic = event.target instanceof Element ? event.target.closest("[data-magnetic]") : null;
    if (magnetic && !magnetic.matches(":disabled")) {
      const rect = magnetic.getBoundingClientRect();
      target.x = rect.left + rect.width / 2;
      target.y = rect.top + rect.height / 2;
      target.width = Math.min(190, rect.width + 8);
      target.height = Math.min(64, rect.height + 8);
      halo.dataset.snapped = "true";
    } else {
      target.x = event.clientX;
      target.y = event.clientY;
      target.width = 18;
      target.height = 18;
      delete halo.dataset.snapped;
    }
    halo.style.opacity = "1";
    schedule();
  }, { passive: true });
  document.addEventListener("pointerdown", () => {
    target.width *= 0.88;
    target.height *= 0.88;
    schedule();
  }, { passive: true });
  document.addEventListener("pointerup", (event) => {
    const magnetic = event.target instanceof Element ? event.target.closest("[data-magnetic]") : null;
    if (magnetic) {
      const rect = magnetic.getBoundingClientRect();
      target.width = Math.min(190, rect.width + 8);
      target.height = Math.min(64, rect.height + 8);
    } else {
      target.width = 18;
      target.height = 18;
    }
    schedule();
  }, { passive: true });
  document.documentElement.addEventListener("pointerleave", () => { halo.style.opacity = "0"; });
  window.addEventListener("blur", () => { halo.style.opacity = "0"; });
}

function setupDocPreviews() {
  document.addEventListener("click", (event) => {
    const anchor = event.target instanceof Element ? event.target.closest("a[data-doc-preview]") : null;
    if (!anchor || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const url = new URL(anchor.href);
    if (url.hostname !== "docs.rc.asu.edu") return;
    event.preventDefault();
    openDocPreview(anchor);
  });
  $("#docBackdrop").addEventListener("click", closeDocPreview);
  $("#closeDocPreview").addEventListener("click", closeDocPreview);
  document.addEventListener("keydown", (event) => {
    const modal = $("#docModal");
    if (modal.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeDocPreview();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...$("#docPreview").querySelectorAll("button:not(:disabled), a[href]")];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
}

async function openDocPreview(anchor) {
  const sequence = ++docTransitionSequence;
  const modal = $("#docModal");
  const surface = $("#docPreview");
  const backdrop = $("#docBackdrop");
  activeDocAnchor = anchor;
  docPreviousFocus = document.activeElement;
  $("#docPreviewTitle").textContent = anchor.dataset.docTitle || anchor.textContent.trim();
  $("#docPreviewSummary").textContent = anchor.dataset.docSummary || "Official guidance from ASU Research Computing.";
  $("#docPreviewOpen").href = anchor.href;
  $("#docPreviewHost").textContent = new URL(anchor.href).hostname;
  modal.hidden = false;
  document.body.classList.add("modal-open");
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const transform = docExpansionTransform(anchor.getBoundingClientRect(), surface.getBoundingClientRect());
  await Promise.all([
    playMotion(backdrop, { opacity: [0, 1] }, { duration: 0.24, ease: "easeOut" }),
    playMotion(surface, {
      opacity: [0.5, 1], x: [transform.x, 0], y: [transform.y, 0],
      scaleX: [transform.scaleX, 1], scaleY: [transform.scaleY, 1],
    }, { duration: 0.44, ease: [0.39, 0.14, 0.26, 1] }),
  ]);
  if (sequence === docTransitionSequence) $("#closeDocPreview").focus();
}

async function closeDocPreview() {
  const modal = $("#docModal");
  if (modal.hidden) return;
  const sequence = ++docTransitionSequence;
  const surface = $("#docPreview");
  const backdrop = $("#docBackdrop");
  const sourceRect = activeDocAnchor?.isConnected ? activeDocAnchor.getBoundingClientRect() : null;
  const transform = sourceRect ? docExpansionTransform(sourceRect, surface.getBoundingClientRect()) : { x: 0, y: 18, scaleX: 0.96, scaleY: 0.96 };
  await Promise.all([
    playMotion(backdrop, { opacity: [1, 0] }, { duration: 0.18, ease: "easeIn" }),
    playMotion(surface, {
      opacity: [1, 0], x: [0, transform.x], y: [0, transform.y],
      scaleX: [1, transform.scaleX], scaleY: [1, transform.scaleY],
    }, { duration: 0.32, ease: [0.46, 0.04, 0.97, 0.44] }),
  ]);
  if (sequence !== docTransitionSequence) return;
  modal.hidden = true;
  document.body.classList.remove("modal-open");
  const returnTarget = activeDocAnchor?.isConnected ? activeDocAnchor : docPreviousFocus;
  activeDocAnchor = null;
  returnTarget?.focus?.();
}

function docExpansionTransform(source, destination) {
  return {
    x: source.left - destination.left,
    y: source.top - destination.top,
    scaleX: Math.max(0.12, Math.min(1, source.width / destination.width)),
    scaleY: Math.max(0.08, Math.min(1, source.height / destination.height)),
  };
}

function setupQuickActions() {
  const toggle = $("#quickActionToggle");
  const menu = $("#quickActionMenu");
  toggle.addEventListener("click", () => setQuickActions(toggle.getAttribute("aria-expanded") !== "true"));
  menu.addEventListener("click", async (event) => {
    const action = event.target.closest("[data-quick-action]")?.dataset.quickAction;
    if (!action) return;
    await setQuickActions(false);
    if (action === "top") window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
    if (action === "plan") {
      await switchWorkflow($("#planTab"));
      $("#description").scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
      $("#description").focus({ preventScroll: true });
    }
    if (action === "demo") {
      await switchWorkflow($("#diagnoseTab"));
      $("#loadDiagnosisDemoButton").click();
    }
    if (action === "support") $("#supportHub").scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  });
  document.addEventListener("pointerdown", (event) => {
    if (toggle.getAttribute("aria-expanded") === "true" && !event.target.closest(".quick-actions")) setQuickActions(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setQuickActions(false);
  });
}

let quickActionSequence = 0;
async function setQuickActions(open) {
  const sequence = ++quickActionSequence;
  const toggle = $("#quickActionToggle");
  const menu = $("#quickActionMenu");
  const items = [...menu.querySelectorAll(".quick-action-item")];
  const toggleIcon = toggle.querySelector(".floating-action-icon");
  toggle.setAttribute("aria-expanded", String(open));
  toggle.title = open ? "Close quick actions" : "Open quick actions";
  toggle.querySelector(".sr-only").textContent = toggle.title;
  playMotion(toggleIcon, { rotate: open ? 45 : 0 }, springTransition({ stiffness: 520, damping: 27 }));
  playMotion(toggle, { scale: [0.94, 1] }, springTransition({ stiffness: 560, damping: 24 }));
  if (open) {
    menu.hidden = false;
    await playMotion(items, { opacity: [0, 1], y: [18, 0], scale: [0.72, 1] }, springTransition({
      stiffness: 430,
      damping: 27,
      delay: motion.stagger?.(0.055, { from: "last" }),
    }));
    if (sequence === quickActionSequence) menu.querySelector("button")?.focus();
    return;
  }
  if (menu.hidden) return;
  const returnFocus = menu.contains(document.activeElement);
  await playMotion(items, { opacity: [1, 0], y: [0, 12], scale: [1, 0.78] }, {
    duration: 0.14,
    ease: "easeIn",
    delay: motion.stagger?.(0.025),
  });
  if (sequence === quickActionSequence) {
    menu.hidden = true;
    if (returnFocus) toggle.focus();
  }
}

function animateStagger(elements, { distance = 12, interval = 0.04 } = {}) {
  const targets = [...elements];
  if (!targets.length || reducedMotion || typeof motion.animate !== "function") return;
  motion.animate(targets, { opacity: [0, 1], y: [distance, 0] }, springTransition({ stiffness: 340, damping: 29, delay: motion.stagger?.(interval) }));
}

function animateResultReveal(container) {
  if (!container || reducedMotion) return;
  playMotion(container, { opacity: [0, 1], y: [18, 0], scale: [0.985, 1] }, springTransition({ stiffness: 300, damping: 28 }));
  animateStagger(container.querySelectorAll(".badge, .resource-summary > div, .evidence-block, .review"), { distance: 9, interval: 0.045 });
}

function springTransition(overrides = {}) {
  return { type: "spring", stiffness: 380, damping: 30, mass: 0.8, ...overrides };
}

async function playMotion(target, keyframes, options) {
  if (!target || reducedMotion || typeof motion.animate !== "function") return;
  try {
    const controls = motion.animate(target, keyframes, options);
    if (typeof controls?.then === "function") await controls;
    else if (controls?.finished) await controls.finished;
  } catch (error) {
    if (error?.name !== "AbortError") console.warn("Animation could not complete.");
  }
}

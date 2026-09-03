const $ = (selector) => document.querySelector(selector);
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
};
let analysisTimer = null;
let analysisSequence = 0;
let intakeController = null;

initialize();

async function initialize() {
  try {
    const health = await api("/api/health");
    state.schedulerProfiles = Array.isArray(health.schedulerOptions) ? health.schedulerOptions : [];
    syncSchedulerOptions();
    $("#modeStatus").dataset.mode = health.mode;
    $("#modeLabel").textContent = health.mode === "mock" ? "MOCK | LOCAL FIXTURES" : `LIVE AIR | ${health.models.planner}`;
    $("#mockModeNotice").hidden = health.mode !== "mock";
  } catch {
    $("#modeLabel").textContent = "Service unavailable";
  }
}

document.querySelectorAll(".tab").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach((tab) => {
    const active = tab === button;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll(".panel").forEach((panel) => panel.classList.toggle("active", panel.id === `${button.dataset.tab}Panel`));
}));

document.querySelectorAll(".output-tab").forEach((button) => button.addEventListener("click", () => activateOutputTab(button.dataset.outputTab)));

function activateOutputTab(name) {
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
}

$("#description").addEventListener("input", () => {
  window.clearTimeout(analysisTimer);
  analysisSequence += 1;
  const description = $("#description").value.trim();
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
  window.clearTimeout(analysisTimer);
  intakeController?.abort();
  intakeController = new AbortController();
  const controller = intakeController;
  const sequence = ++analysisSequence;
  const description = $("#description").value;
  setBusy($("#analyzeButton"), true, "AIR is interpreting the workflow...");
  $("#analysisStatus").textContent = "AIR is interpreting software, intent, resources, and conflicts...";
  $("#planError").textContent = "";
  try {
    const payload = await api("/api/intake", {
      description,
      priorFacts: state.acceptedFacts,
      priorRecommendationToken: preserveRecommendations ? state.recommendationToken : null,
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
  renderInterpretation(payload.analysis);
  const suggestedFields = new Set(payload.analysis.recommendations.map((item) => item.field));
  const draftedFields = new Set(payload.analysis.missingFields.filter((field) => !suggestedFields.has(field) && hasFormValue(form.elements.namedItem(field))));
  const unresolvedFields = payload.analysis.missingFields.filter((field) => !suggestedFields.has(field) && !draftedFields.has(field));
  const suggestedMessage = suggestedFields.size ? ` AIR prefilled editable suggestions for: ${[...suggestedFields].join(", ")}.` : "";
  const draftedMessage = draftedFields.size ? ` Keeping your form values for: ${[...draftedFields].join(", ")}.` : "";
  $("#missingFields").textContent = unresolvedFields.length ? `Still needs your input: ${unresolvedFields.join(", ")}.${suggestedMessage}${draftedMessage}` : `No blank required fields remain.${suggestedMessage}${draftedMessage}`;
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
    if (input && !input.value) input.value = Array.isArray(recommendation.value) ? recommendation.value.join(",") : recommendation.value;
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
  replaceSelectOptions(partitionSelect, unique(profiles.map((profile) => profile.partition)), cluster ? "Select partition" : "Select cluster first", selectedPartition);
  partitionSelect.disabled = !cluster;
  const selectedQos = qos ?? qosSelect.value;
  const qosProfiles = profiles.filter((profile) => profile.partition === partitionSelect.value);
  replaceSelectOptions(qosSelect, unique(qosProfiles.map((profile) => profile.qos)), partitionSelect.value ? "Select QoS" : "Select partition first", selectedQos, (value) => {
    const profile = qosProfiles.find((item) => item.qos === value);
    return profile?.requiresAccount ? `${value} (account required)` : value;
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
});

function renderInterpretation(analysis) {
  $("#airInterpretation").hidden = false;
  $("#workflowSummary").textContent = analysis.workflowSummary;
  $("#detectedSoftware").textContent = analysis.software ? `Detected software: ${analysis.software}` : "Software was not identified yet.";
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
  $("#useGeneratedEvidenceButton").disabled = true;
  $("#planError").textContent = "";
}

function markPlanningPending() {
  restoreSuggestionControls();
  $("#results").hidden = true;
  $("#emptyState").hidden = false;
  state.script = "";
  state.generatedSpec = null;
  $("#useGeneratedEvidenceButton").disabled = true;
  state.pendingAnswer = null;
  $("#planError").textContent = "";
  $("#generationStatus").textContent = "";
  $("#generationError").textContent = "";
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
      const recommendation = state.recommendations.get(field);
      return String(input?.value ?? "") === String(recommendation.value) && !confirmed.includes(field);
    });
    if (unconfirmed.length) throw new Error(`Confirm or change AIR recommendations: ${unconfirmed.join(", ")}.`);
    const spec = readSpec(form);
    const payload = await api("/api/generate", { description: $("#description").value, spec, confirmedRecommendationFields: confirmed, recommendationToken: state.recommendationToken });
    renderGenerated(payload);
    $("#generationStatus").textContent = "Validation passed and the reviewed Slurm script is ready.";
  } catch (error) {
    $("#planError").textContent = error.message;
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

function renderGenerated(payload) {
  $("#emptyState").hidden = true;
  $("#results").hidden = false;
  state.script = payload.script;
  state.generatedSpec = payload.spec;
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
  $("#diagnosisError").textContent = "Generated script attached; add the real failure log and scheduler metadata.";
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
  $("#diagnosisExplanation").textContent = payload.diagnosis.explanation;
  const validationLabel = payload.diagnosisValidation?.airAccepted === false
    ? "AIR response rejected; verified checks shown"
    : "AIR evidence validated";
  $("#diagnosisAgent").textContent = `Diagnostician: ${payload.agent.model} | ${payload.agent.latencyMs ?? "n/a"} ms | ${validationLabel}`;
  renderList($("#evidenceList"), payload.diagnosis.evidence.map((item) => item.source === "metadata" ? `${item.field}: ${item.text}` : `Line ${item.lineNumber}: ${item.text}`));
  renderList($("#deterministicFindings"), payload.deterministicFindings.map((item) => `${item.confidence}: ${item.explanation}`));
  renderList($("#diagnosisAlternatives"), payload.diagnosis.alternatives || []);
  renderList($("#missingEvidence"), payload.diagnosis.missingEvidence || []);
  renderList($("#diagnosisRecommendations"), payload.diagnosis.recommendations);
  const sourceList = $("#diagnosisSources");
  sourceList.replaceChildren(...payload.applicableRules.map((rule) => {
    const item = document.createElement("li"); const anchor = document.createElement("a"); anchor.href = rule.source; anchor.target = "_blank"; anchor.rel = "noreferrer"; anchor.textContent = `${rule.id}: ${rule.category}`; item.append(anchor); return item;
  }));
  const comparison = $("#repairComparison"); comparison.hidden = !payload.repair;
  if (payload.repair) { $("#originalScript").textContent = state.script; $("#proposedScript").textContent = payload.repair.script; }
  $("#redactionNote").textContent = payload.redactions ? `${payload.redactions} sensitive value(s) were redacted before the AIR request.` : "No sensitive patterns were detected.";
}

async function api(url, body, { signal } = {}) {
  const response = await fetch(url, body === undefined ? { signal } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
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
function setBusy(button, busy, label) { button.disabled = busy; button.textContent = label; }
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
async function copyText(text, button) { await navigator.clipboard.writeText(text); const old = button.textContent; button.textContent = "Copied"; setTimeout(() => { button.textContent = old; }, 1000); }

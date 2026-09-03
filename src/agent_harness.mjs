import { applyRepairPatch, extractJsonObject, isExactRenderedScript, renderSlurmScript, validateJobSpec, walltimeHours } from "./job_spec.mjs";
import { extractExplicitJobName, extractExplicitWalltime, extractOpenFoamSolver, missingFields, normalizeAirFacts, normalizeExplicitFacts, normalizeIntakeAnalysis, validateCorrections, validateIntakeAnalysis } from "./intake.mjs";
import { diagnosisFromDeterministicFindings, deterministicFindings, normalizeLog, redactRecord, redactSensitive, validateDiagnosis } from "./diagnosis.mjs";
import { schedulerProfileFor } from "./knowledge.mjs";
import { beginnerWarnings, buildReadinessChecks, deterministicScriptExplanations, firstRunPlan, resourceMetrics, validateScriptExplanations } from "./newcomer_guidance.mjs";
import { configuredRoleModel } from "./model_router.mjs";

export const INTAKE_SYSTEM = `You are the ASU AIR scientific-computing planner. Interpret the research workflow, not merely its numbers. Return one JSON object only with exactly these top-level fields:
- workloadType: general, simulation, ml_training, or distributed
- software: detected software name or null
- workflowSummary: one concise sentence explaining what the researcher is trying to run
- recommendationBasis: one concise sentence explaining what evidence drives resource sizing and what remains uncertain
- corrections: up to six likely typo corrections with original (exact user substring), suggested, category (language, software, or identifier), confidence (low, medium, or high), and requiresConfirmation
- nextQuestion: the single highest-information follow-up question, or null when no clarification is needed
- extracted: only explicit facts, using these exact keys: cluster, workloadType, jobName, workingDirectory, cpus, gpus, memoryGb, walltime, partition, qos, outputPath, errorPath, modules, executable, args, epochs, nodes, tasks
- extractedEvidence: one object per extracted fact with field and an exact verbatim quote from the request
- missingFields: string array
- recommendations: objects with field, value, rationale, uncertainty (low, medium, or high), assumptions (string array), and tuningAdvice (string)
- domainQuestions: up to six specific questions needed to make this scientific workflow runnable or efficient
- detectedConflicts: objects with field, message, and severity (info, warning, or critical)

Use null for unknown values and never convert a recommendation into an extracted fact. Keep the entire response concise and below 900 tokens. Detect ordinary spelling mistakes in prose and scientific software names. Treat corrected language/software as interpretation only, preserving the original transcript for audit. Any possible typo in a job name, path, module, partition, QoS, account, executable, filename, or argument is category identifier and requiresConfirmation=true; never silently rewrite it. Recognize scientific packages and their execution model. OpenFOAM is a CFD simulation workflow: ask about solver, case directory, mesh or cell count, serial versus MPI execution, decomposition, and whether a GPU-enabled solver/build is actually available. Standard OpenFOAM workflows are commonly CPU/MPI-oriented, so a GPU request needs a warning unless the user identifies a compatible GPU implementation. Extract names from phrases such as "name the job X", "job called X", "job named X", "job should be called X", "as job X", "call this job X", or "use X as the job name", and cite the exact phrase. If "general" could describe intent rather than a literal partition, ask instead of assuming.

Act like an HPC consultant. Choose nextQuestion by information gain: ask for the one answer that most changes resource sizing or execution strategy. When enough evidence exists, recommend the best defensible starting values for every missing resource field among cpus, gpus, memoryGb, and walltime. Each rationale must connect workload details to the value; assumptions must be explicit; tuningAdvice must say what first-run measurement, such as MaxRSS, elapsed time, scaling, or GPU utilization, should change the next request. If evidence is weak, recommend a small profiling run rather than pretending to know an optimum. Do not recommend partition, QoS, module names, paths, or commands without verified cluster-specific evidence. Never silently assume values or invent ASU policy.`;
export const FACT_EXTRACTOR_SYSTEM = `You are the ASU AIR real-time workload fact extractor. Return one compact JSON object only: {"facts":[{"field":"...","value":...,"quote":"exact user words"}]}. Extract all explicitly supplied facts using these field names: cluster, jobName, workingDirectory, cpus, gpus, memoryGb, walltime, partition, qos, outputPath, errorPath, modules, executable, args, epochs, nodes, tasks, software. Every quote must be a minimal verbatim substring of the user text.

Interpret ordinary language: articles such as "a CPU" mean numeric value 1; canonicalize stated durations to HHH:MM:SS; job-name paraphrases such as "the job name should be X", "job called X", "job named X", "call this job X", "use X as the job name", or "as job X" identify jobName; a stated absolute Linux path supplied as a case or working location identifies workingDirectory; and "MPI n=16" identifies 16 tasks or ranks, not 16 cpus per task. The cpus field always means CPUs per task. When a total CPU count and MPI rank count are given, divide total CPUs by ranks for cpus and return the rank count as tasks. For an OpenFOAM request phrased as "16 CPUs for a parallel run" with no per-task wording, return tasks=16 and cpus=1. Cite the exact phrase supporting both fields. "general Sol cluster" identifies cluster=sol but does not identify a partition. Keep job names and path components separate: never combine a job name such as "of13" with a directory basename such as "sparky". Re-read the complete transcript and return every currently applicable explicit fact. If the user corrects a value later, return only the latest value. Do not infer nodes, partition, QoS, files, modules, or resource quantities that the user did not state.`;
const FACT_AUDITOR_SYSTEM = `${FACT_EXTRACTOR_SYSTEM}
Act as an independent completeness auditor. Pay special attention to facts another extractor often misses: singular articles ("a CPU", "a GPU"), zero resources, standalone paths, job-name corrections, cluster wording, and MPI ranks. Return the same facts schema and no commentary.`;
export const TYPO_REVIEWER_SYSTEM = `You are the ASU AIR typo reviewer for a scientific-computing request. Return one compact JSON object only: {"corrections":[{"original":"exact user substring","suggested":"correct spelling","category":"language|software|identifier","confidence":"low|medium|high","requiresConfirmation":false}]}. Detect likely spelling mistakes in ordinary language and research software names, including omitted letters. Use category identifier and requiresConfirmation=true for any job name, path, module, partition, QoS, account, executable, filename, or command argument. Never rewrite an identifier silently. Ignore grammar/style preferences, do not change capitalization alone, and do not alter the established names Sol, Phoenix, Slurm, ASU, or AIR. Return at most six genuine corrections. Examples: OpenFom -> OpenFOAM as software; simualtion -> simulation as language. The original must be copied exactly from the user text.`;
export const COMPLETION_ADVISOR_SYSTEM = `You are the ASU AIR Slurm specification completion advisor. Return one compact JSON object only in this exact shape: {"suggestions":{"jobName":"...","outputPath":"...","errorPath":"...","partition":"...","qos":"...","executable":"...","modules":[],"args":[],"nodes":1,"gpus":0},"reasons":{"field":"short reason"}}. Omit any field you cannot safely suggest.

Recommend only fields the researcher did not explicitly provide. Create a short safe job name from the detected workload when one is missing. For output and error filenames, use valid Slurm filename substitutions such as %x for job name and %j for job ID so files remain identifiable. A named OpenFOAM solver such as pimpleFoam may be recommended as executable. For an OpenFOAM run with more than one MPI task, recommend args=["-parallel"] and explain that the case must already be decomposed. Standard CPU/MPI OpenFOAM may use gpus=0 unless the researcher identifies a verified GPU-enabled build. For a multi-task profiling run that fits one node, nodes=1 may be recommended with a scaling caveat. When no command arguments or environment modules were stated, recommend empty arrays and clearly require environment verification rather than inventing names. Select partition and QoS only as an exact pair from the supplied supportedSchedulerProfiles for the extracted cluster and requested walltime. Treat profiles as supported choices, not proof of account entitlement. Prefer a general-purpose profile when the researcher describes a general cluster workload. Never invent a profile, path, account, or entitlement. If no supported pair applies, omit both fields. Keep values editable and explain what the researcher should verify.`;
export const SCHEDULER_ADVISOR_SYSTEM = `You are the ASU AIR scheduler-profile selector. Return JSON only: {"partition":"value","qos":"value","reason":"short reason"}. Select exactly one partition and QoS pair from supportedSchedulerProfiles matching the stated cluster and walltime. Prefer the general-purpose public profile unless the workload explicitly requests HTC or class use. This is an editable recommendation, not a claim of account entitlement. Return {"partition":null,"qos":null,"reason":"..."} when no supplied profile applies.`;
export const CRITIC_SYSTEM = `You are an independent ASU AIR HPC critic. Return one JSON object only with verdict (approve or review), findings, and recommendations. Every findings and recommendations item must be {"message":"...","basis":"spec|validation|policy","source":null}. Use basis policy only for a claim directly supported by supplied policyContext, and then source must exactly equal its supplied source URL. Otherwise use spec or validation and source null. Review the supplied validated specification and script. Do not invent ASU policies.`;
export const SCRIPT_EXPLAINER_SYSTEM = `You are an ASU AIR Slurm teacher. Return one JSON object only: {"explanations":[{"lineNumber":1,"line":"exact script line","meaning":"plain-language meaning","newcomerTip":"one practical check"}]}. Explain every non-empty shebang, #SBATCH directive, shell-safety line, module command, and srun command. Cite each exact line and 1-based line number once. Do not add policy claims or commands that are absent from the script.`;
export const RESOURCE_CRITIC_SYSTEM = `You are an independent ASU AIR job-recommendation critic. Return one concise JSON object only with verdict (approve or revise), reviews, findings, and profilingProfile. reviews must contain exactly one object for every proposed field, with field, decision (approve or reject), and a brief reason. profilingProfile must be none, openfoam_small, openfoam_medium, or openfoam_large.

Reject recommendations that contradict the workload, rely on an unstated production scale or execution mode, claim an optimum without evidence, or invent cluster policy. Approve scheduler fields only when partition and QoS are an exact pair in supportedSchedulerProfiles for the selected cluster. Job names and output/error paths must be safe, editable conventions rather than extracted user facts. When OpenFOAM sizing lacks historical measurements, select a controlled first-run profile instead: openfoam_small for fewer than 500,000 cells, openfoam_medium for 500,000 through 5 million cells, and openfoam_large above 5 million cells. These are profiling profiles, not production optima or ASU policy. Use none when no OpenFOAM profile applies. Apply scientific knowledge carefully; standard simpleFoam is steady-state, so a transient assumption is unsupported. Keep every reason under 25 words.`;
const PROFILING_PROFILES = Object.freeze({
  openfoam_small: { cpus: 4, gpus: 0, memoryGb: 8, walltime: "00:30:00" },
  openfoam_medium: { cpus: 8, gpus: 0, memoryGb: 16, walltime: "01:00:00" },
  openfoam_large: { cpus: 16, gpus: 0, memoryGb: 32, walltime: "01:00:00" },
});
export const DIAGNOSIS_SYSTEM = `You are an ASU AIR Slurm diagnostician. Return one JSON object only with category, confidence (confirmed, probable, or inconclusive), ruleId, evidence (array using exact 1-based log lineNumber and text, or source metadata with field and text), explanation, alternatives (string array), missingEvidence (string array), recommendations (string array), and patch (object or null). Cite only supplied evidence and applicable rule IDs. Use category UNKNOWN and ruleId null when no supplied rule is supported. A rule marked requiresCorroboration cannot be confirmed unless the supplied deterministic finding is confirmed. Invalid feature specification is ambiguous. Never claim exit code alone proves root cause.`;
const RESOURCE_RECOMMENDATION_FIELDS = new Set(["cpus", "gpus", "memoryGb", "walltime", "nodes", "tasks", "epochs"]);
const JSON_REPAIR_SYSTEM = "Return only a valid JSON object preserving the supplied meaning. Do not add facts.";

export class AgentHarness {
  constructor({ gateway, schedulerProfiles = [], extractorModel = configuredRoleModel("extractor"), factAuditorModel = configuredRoleModel("factAuditor"), typoModel = configuredRoleModel("typo"), completionModel = configuredRoleModel("completion"), schedulerModel = configuredRoleModel("scheduler"), plannerModel = configuredRoleModel("planner"), criticModel = configuredRoleModel("critic"), diagnosticianModel = configuredRoleModel("diagnostician"), explainerModel = configuredRoleModel("explainer") }) {
    if (!gateway?.chat) throw new Error("AgentHarness requires a chat gateway.");
    this.gateway = gateway;
    this.schedulerProfiles = Array.isArray(schedulerProfiles) ? schedulerProfiles : [];
    this.models = { extractor: extractorModel, factAuditor: factAuditorModel, typo: typoModel, completion: completionModel, scheduler: schedulerModel, planner: plannerModel, critic: criticModel, diagnostician: diagnosticianModel, explainer: explainerModel };
  }

  async intake(description, { priorFacts = [], priorRecommendations = {}, signal } = {}) {
    const normalized = validateDescription(description);
    let [factResponse, response, factAuditResponse, typoResponse, completionResponse, schedulerResponse] = await Promise.all([
      this.gateway.chat({ model: this.models.extractor, temperature: 0, maxTokens: 600, signal, messages: [{ role: "system", content: FACT_EXTRACTOR_SYSTEM }, { role: "user", content: normalized }] }),
      this.gateway.chat({ model: this.models.planner, temperature: 0, maxTokens: 1100, signal, messages: [{ role: "system", content: INTAKE_SYSTEM }, { role: "user", content: normalized }] }),
      this.gateway.chat({ model: this.models.factAuditor, temperature: 0, maxTokens: 600, signal, messages: [{ role: "system", content: FACT_AUDITOR_SYSTEM }, { role: "user", content: normalized }] }).catch(() => null),
      this.gateway.chat({ model: this.models.typo, temperature: 0, maxTokens: 450, signal, messages: [{ role: "system", content: TYPO_REVIEWER_SYSTEM }, { role: "user", content: normalized }] }).catch(() => null),
      this.schedulerProfiles.length
        ? this.gateway.chat({ model: this.models.completion, temperature: 0, maxTokens: 500, signal, messages: [{ role: "system", content: COMPLETION_ADVISOR_SYSTEM }, { role: "user", content: JSON.stringify({ description: normalized, supportedSchedulerProfiles: this.schedulerProfiles }) }] }).catch(() => null)
        : Promise.resolve(null),
      this.schedulerProfiles.length
        ? this.gateway.chat({ model: this.models.scheduler, temperature: 0, maxTokens: 220, signal, messages: [{ role: "system", content: SCHEDULER_ADVISOR_SYSTEM }, { role: "user", content: JSON.stringify({ description: normalized, supportedSchedulerProfiles: this.schedulerProfiles }) }] }).catch(() => null)
        : Promise.resolve(null),
    ]);
    let factPayload;
    try {
      factPayload = await this.#parse(factResponse, "extractor", signal);
    } catch {
      factResponse = await this.gateway.chat({ model: this.models.extractor, temperature: 0, maxTokens: 600, signal, messages: [{ role: "system", content: `${FACT_EXTRACTOR_SYSTEM}\nThe previous attempt was malformed. Return shorter JSON with no prose.` }, { role: "user", content: normalized }] });
      factPayload = await this.#parse(factResponse, "extractor", signal);
    }
    let parsed;
    try {
      parsed = await this.#parse(response, "planner", signal);
    } catch {
      response = await this.gateway.chat({ model: this.models.planner, temperature: 0, maxTokens: 1100, signal, messages: [{ role: "system", content: `${INTAKE_SYSTEM}\nThe previous attempt was malformed. Return a shorter JSON object with no prose.` }, { role: "user", content: normalized }] });
      parsed = await this.#parse(response, "planner", signal);
    }
    const analysis = validateIntakeAnalysis(normalizeIntakeAnalysis(parsed));
    let typoCorrections = [];
    if (typoResponse) {
      try {
        const typoPayload = await this.#parse(typoResponse, "typo", signal);
        typoCorrections = Array.isArray(typoPayload.corrections) ? typoPayload.corrections : [];
      } catch { typoResponse = null; }
    }
    analysis.corrections = validateCorrections(normalized, [...analysis.corrections, ...typoCorrections]);
    const previousAirFacts = normalizeAirFacts(normalized, { facts: Array.isArray(priorFacts) ? priorFacts : [] });
    const currentAirFacts = normalizeAirFacts(normalized, factPayload);
    let auditedAirFacts = { extracted: {}, evidence: [] };
    if (factAuditResponse) {
      try { auditedAirFacts = normalizeAirFacts(normalized, await this.#parse(factAuditResponse, "factAuditor", signal)); } catch { factAuditResponse = null; }
    }
    const airFacts = mergeAirFacts(mergeAirFacts(previousAirFacts, currentAirFacts), auditedAirFacts);
    const deterministicFacts = normalizeExplicitFacts(normalized, {}, analysis.workloadType);
    for (const [field, value] of Object.entries(deterministicFacts)) {
      if (field === "workloadType") continue;
      airFacts.extracted[field] = value;
      if (!airFacts.evidence.some((item) => item.field === field)) airFacts.evidence.push({ field, quote: normalized });
    }
    const explicitJobName = extractExplicitJobName(normalized);
    if (explicitJobName) {
      airFacts.extracted.jobName = explicitJobName.value;
      airFacts.evidence = [...airFacts.evidence.filter((item) => item.field !== "jobName"), { field: "jobName", quote: explicitJobName.quote }];
    }
    const explicitWalltime = extractExplicitWalltime(normalized);
    if (explicitWalltime) {
      airFacts.extracted.walltime = explicitWalltime.value;
      airFacts.evidence = [...airFacts.evidence.filter((item) => item.field !== "walltime"), { field: "walltime", quote: explicitWalltime.quote }];
    }
    analysis.extracted = { ...airFacts.extracted, workloadType: analysis.workloadType };
    analysis.extractedEvidence = airFacts.evidence;
    analysis.software = analysis.extracted.software || analysis.software;
    const interpretedDescription = applySafeCorrectionInterpretations(analysis, normalized);
    reconcileMpiCpuSemantics(analysis, normalized);
    applyScientificFallbacks(analysis, interpretedDescription);
    analysis.nextQuestion ||= analysis.domainQuestions[0] || null;
    analysis.missingFields = missingFields(analysis.extracted);
    let completionRecommendations = [];
    if (completionResponse) {
      try {
        completionRecommendations = validateCompletionRecommendations(await this.#parse(completionResponse, "completion", signal), analysis.extracted, this.schedulerProfiles, normalized);
        const recommendationsByField = new Map(analysis.recommendations.map((item) => [item.field, item]));
        for (const item of completionRecommendations) recommendationsByField.set(item.field, item);
        analysis.recommendations = [...recommendationsByField.values()];
      } catch { completionResponse = null; }
    }
    if (schedulerResponse) {
      try {
        const schedulerRecommendations = validateSchedulerAdvisor(await this.#parse(schedulerResponse, "scheduler", signal), analysis.extracted, this.schedulerProfiles);
        const recommendationsByField = new Map(analysis.recommendations.map((item) => [item.field, item]));
        for (const item of schedulerRecommendations) recommendationsByField.set(item.field, item);
        analysis.recommendations = [...recommendationsByField.values()];
        completionRecommendations = validateSchedulerRecommendationPair([...completionRecommendations.filter((item) => !["partition", "qos"].includes(item.field)), ...schedulerRecommendations], analysis.extracted, this.schedulerProfiles);
      } catch { schedulerResponse = null; }
    }
    analysis.recommendations = carryForwardCompletionRecommendations(analysis.recommendations, priorRecommendations, analysis.extracted, this.schedulerProfiles, normalized);
    analysis.recommendations = carryForwardSchedulerRecommendations(analysis.recommendations, priorRecommendations, analysis.extracted, this.schedulerProfiles);
    analysis.recommendations = analysis.recommendations.filter((item) => analysis.missingFields.includes(item.field));
    const agents = [agentMetadata("extractor", factResponse)];
    if (factAuditResponse) agents.push(agentMetadata("fact_auditor", factAuditResponse));
    if (typoResponse) agents.push(agentMetadata("typo_reviewer", typoResponse));
    if (completionResponse) agents.push(agentMetadata("completion_advisor", completionResponse));
    if (schedulerResponse) agents.push(agentMetadata("scheduler_advisor", schedulerResponse));
    agents.push(agentMetadata("planner", response));
    const resourceRecommendations = analysis.recommendations.filter((item) => RESOURCE_RECOMMENDATION_FIELDS.has(item.field));
    const conventionRecommendations = analysis.recommendations.filter((item) => !RESOURCE_RECOMMENDATION_FIELDS.has(item.field));
    if (resourceRecommendations.length) {
      try {
        const criticInput = JSON.stringify({ workload: normalized, software: analysis.software, workflowSummary: analysis.workflowSummary, supportedSchedulerProfiles: this.schedulerProfiles, recommendations: resourceRecommendations });
        let criticResponse = await this.gateway.chat({ model: this.models.critic, temperature: 0, maxTokens: 1400, signal, messages: [{ role: "system", content: RESOURCE_CRITIC_SYSTEM }, { role: "user", content: criticInput }] });
        let recommendationReview;
        try {
          recommendationReview = validateResourceReview(await this.#parse(criticResponse, "critic", signal), resourceRecommendations);
        } catch {
          const fields = resourceRecommendations.map((item) => item.field).join(", ");
          criticResponse = await this.gateway.chat({ model: this.models.critic, temperature: 0, maxTokens: 1800, signal, messages: [{ role: "system", content: `${RESOURCE_CRITIC_SYSTEM}\nThe previous response violated the schema. Return exactly one reviews item for each of these fields: ${fields}.` }, { role: "user", content: criticInput }] });
          recommendationReview = validateResourceReview(await this.#parse(criticResponse, "critic", signal), resourceRecommendations);
        }
        const original = new Map(resourceRecommendations.map((item) => [item.field, item]));
        const profile = PROFILING_PROFILES[recommendationReview.profilingProfile];
        const reviewedResources = recommendationReview.reviews.flatMap((item) => {
          if (item.decision === "approve") return [original.get(item.field)];
          if (!profile || !(item.field in profile)) return [];
          return [{ field: item.field, value: profile[item.field], rationale: `${recommendationReview.profilingProfile.replaceAll("_", " ")} supplies a bounded first measurement instead of an unsupported production estimate.`, uncertainty: "high", assumptions: ["This is a short profiling run, not a production allocation."], tuningAdvice: tuningAdviceFor(item.field) }];
        });
        analysis.recommendations = validateSchedulerRecommendationPair([...conventionRecommendations, ...reviewedResources], analysis.extracted, this.schedulerProfiles);
        analysis.recommendationReview = recommendationReview;
        agents.push(agentMetadata("resource_critic", criticResponse));
      } catch (error) {
        analysis.recommendations = validateSchedulerRecommendationPair(conventionRecommendations, analysis.extracted, this.schedulerProfiles);
        const retained = analysis.recommendations.length ? " Validated naming, command-shape, and exact profile suggestions remain available; unreviewed resource sizing was withheld." : "";
        analysis.recommendationReview = { verdict: "unavailable", reviews: [], findings: [`Independent recommendation review was unavailable: ${error.message}${retained}`] };
      }
    }
    return { analysis, agent: agents.find((item) => item.role === "planner"), agents };
  }

  async generateSpec({ description, spec }) {
    const normalized = validateDescription(description);
    const validation = validateJobSpec(spec, { requireComplete: true });
    if (!validation.valid) return { status: "rejected", spec, validation, script: null, review: null, agents: [] };
    const script = renderSlurmScript(spec);
    const profile = schedulerProfileFor(spec);
    const policyContext = profile ? { id: profile.id, limits: profile.limits, notes: profile.notes || null, source: profile.source } : null;
    const [response, explainerResponse] = await Promise.all([
      this.gateway.chat({ model: this.models.critic, temperature: 0, maxTokens: 500, messages: [{ role: "system", content: CRITIC_SYSTEM }, { role: "user", content: JSON.stringify({ workload: normalized, spec, validation, script, policyContext }) }] }),
      this.gateway.chat({ model: this.models.explainer, temperature: 0, maxTokens: 1400, messages: [{ role: "system", content: SCRIPT_EXPLAINER_SYSTEM }, { role: "user", content: JSON.stringify({ script }) }] }).catch(() => null),
    ]);
    const review = validateReview(await this.#parse(response, "critic"), profile ? [profile.source] : []);
    let explanations = deterministicScriptExplanations(script);
    if (explainerResponse) {
      try { explanations = validateScriptExplanations(await this.#parse(explainerResponse, "explainer"), script); } catch { explainerResponse = null; }
    }
    const guidance = {
      metrics: resourceMetrics(spec),
      readinessChecks: buildReadinessChecks(spec),
      beginnerWarnings: beginnerWarnings(spec),
      firstRun: firstRunPlan(spec),
    };
    return { status: "reviewed", spec, validation, script, review, explanations, guidance, agents: [agentMetadata("critic", response), ...(explainerResponse ? [agentMetadata("explainer", explainerResponse)] : [])] };
  }

  async generate(description) {
    const intake = await this.intake(description);
    return { status: "needs_input", spec: intake.analysis.extracted, missingFields: intake.analysis.missingFields, recommendations: intake.analysis.recommendations, validation: { valid: false, errors: ["Confirm all required fields before generation."], warnings: [] }, script: null, review: null, agents: [intake.agent] };
  }

  async diagnose({ cluster = "unknown", script = "", log, metadata = {}, rules = [], originalSpec = null }) {
    if (!["sol", "phoenix", "unknown"].includes(cluster)) throw new Error("cluster must be sol, phoenix, or unknown.");
    const normalizedLog = normalizeLog(log);
    const applicable = rules.filter((rule) => rule.cluster === "any" || rule.cluster === cluster);
    const redactedLog = redactSensitive(normalizedLog);
    const redactedScript = redactSensitive(script);
    const redactedMetadata = redactRecord(metadata);
    const findings = deterministicFindings(redactedLog.text, redactedMetadata.value);
    let response = null;
    let diagnosis;
    let diagnosisValidation = { airAccepted: true, fallback: null };
    try {
      response = await this.gateway.chat({ model: this.models.diagnostician, temperature: 0, maxTokens: 700, messages: [{ role: "system", content: DIAGNOSIS_SYSTEM }, { role: "user", content: JSON.stringify({ cluster, script: redactedScript.text, log: redactedLog.text, metadata: redactedMetadata.value, deterministicFindings: findings, rules: applicable }) }] });
      diagnosis = validateDiagnosis(await this.#parse(response, "diagnostician"), { log: redactedLog.text, metadata: redactedMetadata.value, allowedRuleIds: applicable.map((rule) => rule.id), rules: applicable, deterministicFindings: findings });
    } catch (error) {
      diagnosis = diagnosisFromDeterministicFindings(findings);
      if (!diagnosis) throw error;
      diagnosisValidation = { airAccepted: false, fallback: "deterministic", reason: "AIR output did not pass deterministic diagnosis validation." };
    }
    let repair = null;
    if (originalSpec && diagnosis.confidence === "confirmed" && !["PENDING_NOT_FAILED", "INFRASTRUCTURE_OR_ADMIN"].includes(diagnosis.category) && diagnosis.patch && isExactRenderedScript(originalSpec, script)) {
      try { repair = applyRepairPatch(originalSpec, diagnosis.patch); } catch { repair = null; }
    }
    const agent = response ? agentMetadata("diagnostician", response) : { role: "diagnostician", model: this.models.diagnostician, latencyMs: null, usage: null };
    return { diagnosis, diagnosisValidation, deterministicFindings: findings, repair, redactions: redactedLog.redactionCount + redactedScript.redactionCount + redactedMetadata.redactionCount, applicableRules: applicable.map(({ id, category, source }) => ({ id, category, source })), agent };
  }

  async #parse(response, role, signal) {
    try { return extractJsonObject(response.content); } catch (firstError) {
      const repaired = await this.gateway.chat({ model: this.models[role], temperature: 0, maxTokens: 1400, signal, messages: [{ role: "system", content: JSON_REPAIR_SYSTEM }, { role: "user", content: response.content }] });
      try { return extractJsonObject(repaired.content); } catch { throw firstError; }
    }
  }
}

function mergeAirFacts(previous, current) {
  const extracted = { ...previous.extracted, ...current.extracted };
  const evidenceByField = new Map(previous.evidence.map((item) => [item.field, item]));
  for (const item of current.evidence) evidenceByField.set(item.field, item);
  return { extracted, evidence: [...evidenceByField.values()] };
}

function validateCompletionRecommendations(value, extracted, schedulerProfiles, description = "") {
  if (!value || (!Array.isArray(value.recommendations) && (!value.suggestions || typeof value.suggestions !== "object"))) throw new Error("Completion advisor returned an invalid object.");
  let candidates = Array.isArray(value.recommendations)
    ? value.recommendations
    : Object.entries(value.suggestions).map(([field, suggestion]) => ({
        field,
        value: suggestion,
        rationale: typeof value.reasons?.[field] === "string" ? value.reasons[field] : "AIR selected this editable value from the supplied workload and scheduler profiles.",
        uncertainty: ["partition", "qos"].includes(field) ? "medium" : "low",
        assumptions: ["This remains editable and requires researcher confirmation."],
        tuningAdvice: ["partition", "qos"].includes(field) ? "Confirm this profile is available to your account before submission." : "Review this value before generating the script.",
      }));
  const solver = extractOpenFoamSolver(description);
  candidates = candidates.map((item) => item?.field === "executable" && solver && String(item.value).toLowerCase() === solver.quote.toLowerCase()
    ? { ...item, value: solver.value }
    : item);
  const recommendation = (field, recommendationValue, rationale, tuningAdvice) => ({ field, value: recommendationValue, rationale, uncertainty: "low", assumptions: ["This remains editable and requires researcher confirmation."], tuningAdvice });
  if (solver && extracted.executable === undefined && !candidates.some((item) => item?.field === "executable")) {
    candidates.push(recommendation("executable", solver.value, "AIR recognized the named OpenFOAM solver and normalized its case-sensitive executable name.", "Verify that this executable is available in the loaded OpenFOAM environment."));
  }
  if (Number.isInteger(extracted.tasks) && extracted.tasks > 1) {
    if (extracted.nodes === undefined && !candidates.some((item) => item?.field === "nodes")) candidates.push(recommendation("nodes", 1, "AIR selected a one-node profiling run before assuming multi-node scaling efficiency.", "Measure MPI scaling before increasing the node count."));
    if (extracted.args === undefined && !candidates.some((item) => item?.field === "args")) candidates.push(recommendation("args", ["-parallel"], "AIR recognized an MPI OpenFOAM run that requires the parallel solver flag after decomposition.", "Verify that the case has been decomposed before submission."));
  }
  const allowed = new Set(["jobName", "outputPath", "errorPath", "partition", "qos", "executable", "modules", "args", "nodes", "gpus"]);
  const safeName = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
  const safePath = /^(?!-)(?!.*\.\.)(?!.*[\r\n\0;&|`$<>])[A-Za-z0-9_./+%{}-]{1,240}$/;
  const result = candidates.filter((item) => {
    if (!item || !allowed.has(item.field) || extracted[item.field] !== undefined) return false;
    if (typeof item.rationale !== "string" || item.rationale.length < 10 || !["low", "medium", "high"].includes(item.uncertainty)) return false;
    if (!Array.isArray(item.assumptions) || typeof item.tuningAdvice !== "string") return false;
    if (item.field === "outputPath" || item.field === "errorPath") return typeof item.value === "string" && safePath.test(item.value);
    if (item.field === "nodes") return Number.isInteger(item.value) && item.value >= 1 && item.value <= 256;
    if (item.field === "gpus") return Number.isInteger(item.value) && item.value >= 0 && item.value <= 64;
    if (item.field === "modules") return Array.isArray(item.value) && item.value.length === 0;
    if (item.field === "args") return Array.isArray(item.value) && item.value.every((entry) => typeof entry === "string" && entry.length <= 160 && !/[\r\n\0;&|`$<>]/.test(entry));
    if (item.field === "executable") return typeof item.value === "string" && /^[A-Za-z0-9][A-Za-z0-9._/+:-]{0,159}$/.test(item.value);
    return typeof item.value === "string" && safeName.test(item.value);
  });
  return validateSchedulerRecommendationPair(result, extracted, schedulerProfiles);
}

function validateSchedulerAdvisor(value, extracted, schedulerProfiles) {
  if (!value || typeof value.partition !== "string" || typeof value.qos !== "string") return [];
  const recommendations = ["partition", "qos"].map((field) => ({
    field,
    value: value[field],
    rationale: typeof value.reason === "string" && value.reason.length >= 10 ? value.reason : "AIR selected this pair from the supplied cluster profiles.",
    uncertainty: "medium",
    assumptions: ["The profile is documented, but account entitlement is not known."],
    tuningAdvice: "Confirm this profile is available to your account before submission.",
  }));
  return validateSchedulerRecommendationPair(recommendations, extracted, schedulerProfiles);
}

function reconcileMpiCpuSemantics(analysis, description) {
  const explicitMpi = description.match(/\b(\d[\d,]*)\s*(?:total\s+)?cpus?\b(?!\s+per\s+task)[^.\n]{0,160}\bmpi\b[^.\n]{0,50}\bn\s*=\s*(\d[\d,]*)\b/i);
  const openFoamParallel = analysis.software === "OpenFOAM"
    ? description.match(/\b(\d[\d,]*)\s*cpus?\b[^.\n]{0,80}\b(?:for\s+)?(?:a\s+)?parallel(?:\s+run)?\b/i)
    : null;
  const match = explicitMpi || openFoamParallel;
  if (!match) return;
  const totalCpus = Number(match[1].replaceAll(",", ""));
  const tasks = explicitMpi ? Number(match[2].replaceAll(",", "")) : totalCpus;
  if (tasks < 1 || totalCpus % tasks !== 0) return;
  analysis.extracted.tasks = tasks;
  analysis.extracted.cpus = totalCpus / tasks;
  analysis.extractedEvidence = [
    ...analysis.extractedEvidence.filter((item) => !["cpus", "tasks"].includes(item.field)),
    { field: "cpus", quote: match[0] },
    { field: "tasks", quote: match[0] },
  ];
  const cpusPerTask = totalCpus / tasks;
  analysis.detectedConflicts.push({ field: "cpus", severity: "info", message: `AIR interpreted ${totalCpus} total CPUs as ${tasks} MPI ranks with ${cpusPerTask} ${cpusPerTask === 1 ? "CPU" : "CPUs"} per task.` });
}

function validateSchedulerRecommendationPair(recommendations, extracted, schedulerProfiles) {
  const partition = recommendations.find((item) => item.field === "partition")?.value;
  const qos = recommendations.find((item) => item.field === "qos")?.value;
  if (partition || qos) {
    const profile = schedulerProfiles.find((item) => item.cluster === extracted.cluster && item.partition === partition && item.qos === qos);
    const requestedHours = walltimeHours(extracted.walltime);
    const exceedsProfile = profile?.limits?.walltimeHours && Number.isFinite(requestedHours) && requestedHours > profile.limits.walltimeHours;
    if (!profile || exceedsProfile) return recommendations.filter((item) => !["partition", "qos"].includes(item.field));
  }
  return recommendations;
}

function carryForwardSchedulerRecommendations(recommendations, priorValues, extracted, schedulerProfiles) {
  if (recommendations.some((item) => item.field === "partition" || item.field === "qos")) return recommendations;
  if (extracted.partition !== undefined || extracted.qos !== undefined) return recommendations;
  if (typeof priorValues?.partition !== "string" || typeof priorValues?.qos !== "string") return recommendations;
  const carried = ["partition", "qos"].map((field) => ({
    field,
    value: priorValues[field],
    rationale: "AIR previously selected this scheduler pair, and it still matches the latest dated cluster profile.",
    uncertainty: "medium",
    assumptions: ["The cluster and applicable scheduler profile have not changed."],
    tuningAdvice: "Confirm this profile is available to your account before submission.",
  }));
  return validateSchedulerRecommendationPair([...recommendations, ...carried], extracted, schedulerProfiles);
}

function carryForwardCompletionRecommendations(recommendations, priorValues, extracted, schedulerProfiles, description) {
  const byField = new Map(recommendations.map((item) => [item.field, item]));
  const stableFields = ["jobName", "outputPath", "errorPath", "executable", "modules", "args", "nodes"];
  const carried = stableFields.flatMap((field) => {
    if (byField.has(field) || extracted[field] !== undefined || !Object.hasOwn(priorValues || {}, field)) return [];
    return [{
      field,
      value: priorValues[field],
      rationale: "AIR previously suggested this unchanged value for the same accumulated workload.",
      uncertainty: "low",
      assumptions: ["The researcher appended detail rather than replacing the workload."],
      tuningAdvice: "Confirm or edit this value before generating the script.",
    }];
  });
  for (const item of validateCompletionRecommendations({ recommendations: carried }, extracted, schedulerProfiles, description)) {
    if (!byField.has(item.field)) byField.set(item.field, item);
  }
  return [...byField.values()];
}

function applyScientificFallbacks(analysis, description) {
  if (analysis.extracted.software !== "OpenFOAM" && analysis.software !== "OpenFOAM") return;
  analysis.software = "OpenFOAM";
  if (!/openfoam/i.test(analysis.workflowSummary)) analysis.workflowSummary = "Run an OpenFOAM CFD simulation with a verified solver, case layout, and execution strategy.";
  if (analysis.extracted.nodes === undefined && /\bsingle[- ]node\b/i.test(analysis.workflowSummary)) {
    analysis.workflowSummary = "Run an OpenFOAM CFD simulation on the selected cluster; its execution scale still needs clarification.";
  }
  const hasSolver = /\b(?:simple|pimple|ico|rho|inter|buoyant)[A-Za-z]*Foam\b/i.test(description)
    || /\bsolver\s*(?:is|:)?\s+[A-Za-z][A-Za-z0-9_-]+/i.test(description);
  const hasMeshScale = /\b\d[\d,.]*\s*(?:million|thousand|m|k)?\s*(?:mesh\s+)?cells?\b/i.test(description);
  const hasParallelStrategy = /\b(?:mpi|parallel|serial|ranks?)\b/i.test(description);
  if (!hasSolver || !hasMeshScale) {
    analysis.nextQuestion = "Which OpenFOAM solver will run, and approximately how many mesh cells are in the case?";
    analysis.recommendationBasis = "Solver behavior and mesh size are needed before AIR can defend CPU, memory, and walltime recommendations.";
    analysis.recommendations = analysis.recommendations.filter((item) => !["cpus", "gpus", "memoryGb", "walltime"].includes(item.field));
  }
  if (!Number.isInteger(analysis.extracted.gpus)) {
    analysis.detectedConflicts = analysis.detectedConflicts.filter((item) => !/no gpu.*specified/i.test(item.message));
  }
  const questions = [
    { keyword: "solver", text: "Which OpenFOAM solver and case directory should the job run?" },
    { keyword: "mpi", text: "Should the case run serially or with MPI, and if parallel, how is it decomposed?" },
    { keyword: "mesh", text: "What mesh or cell count should resource sizing account for?" },
  ];
  for (const question of questions) {
    if (!analysis.domainQuestions.some((item) => item.toLowerCase().includes(question.keyword))) analysis.domainQuestions.push(question.text);
  }
  if (/\bgeneral\s+sol\s+cluster\b/i.test(description) && !/\bgeneral\s+partition\b/i.test(description)) {
    delete analysis.extracted.partition;
    if (!analysis.domainQuestions.some((item) => /partition/i.test(item))) {
      analysis.domainQuestions.push("Does 'general' mean a specific partition, or only a general-purpose Sol workload?");
    }
  }
  analysis.domainQuestions = analysis.domainQuestions.slice(0, 6);
  analysis.domainQuestions = analysis.domainQuestions.filter((question) => {
    if (hasSolver && /solver/i.test(question)) return false;
    if (hasMeshScale && /mesh|cells?/i.test(question)) return false;
    if (hasParallelStrategy && /mpi|parallel|serial|decompos/i.test(question)) return false;
    return true;
  });
  if (hasSolver && hasMeshScale) {
    if (analysis.extracted.gpus > 0) analysis.nextQuestion = "Is this a verified GPU-enabled OpenFOAM build, or should AIR revise the plan to a CPU/MPI run?";
    else if (!hasParallelStrategy) analysis.nextQuestion = "Should this OpenFOAM case run serially or with MPI, and how many ranks should the profiling run test?";
    else if (analysis.domainQuestions.length) analysis.nextQuestion = analysis.domainQuestions[0];
    else analysis.nextQuestion = null;
  }
  if (analysis.extracted.gpus > 0 && !analysis.detectedConflicts.some((item) => /gpu/i.test(item.message))) {
    analysis.detectedConflicts.push({ field: "gpus", severity: "warning", message: "Confirm that the selected OpenFOAM solver and build support GPU execution; otherwise request CPU/MPI resources instead." });
  }
}

function applySafeCorrectionInterpretations(analysis, description) {
  let interpreted = description;
  for (const correction of analysis.corrections) {
    if (correction.category === "identifier" || correction.confidence !== "high") continue;
    interpreted = interpreted.replace(correction.original, correction.suggested);
    if (correction.category === "software" && !analysis.software) analysis.software = correction.suggested;
  }
  if (/\bopen\s*foam\b/i.test(interpreted)) {
    analysis.software = "OpenFOAM";
    analysis.workloadType = "simulation";
    analysis.extracted.workloadType = "simulation";
  } else if (/\bpytorch\b/i.test(interpreted) && !analysis.software) {
    analysis.software = "PyTorch";
  }
  return interpreted;
}

function validateDescription(value) {
  const normalized = String(value || "").trim();
  if (normalized.length < 10) throw new Error("Describe the workload in at least 10 characters.");
  if (normalized.length > 5000) throw new Error("Workload description must be 5000 characters or fewer.");
  return normalized;
}

function validateReview(review, allowedPolicySources) {
  const validItem = (item) => item && typeof item.message === "string" && item.message.trim().length > 0
    && ["spec", "validation", "policy"].includes(item.basis)
    && (item.basis === "policy" ? allowedPolicySources.includes(item.source) : item.source == null);
  if (!review || !["approve", "review"].includes(review.verdict) || !Array.isArray(review.findings) || !review.findings.every(validItem) || !Array.isArray(review.recommendations) || !review.recommendations.every(validItem)) throw new Error("Critic returned an invalid or ungrounded review object.");
  return { verdict: review.verdict, findings: review.findings.map((item) => item.message), recommendations: review.recommendations.map((item) => item.message) };
}

function validateResourceReview(review, recommendations) {
  const expected = new Set(recommendations.map((item) => item.field));
  const valid = review && ["approve", "revise"].includes(review.verdict)
    && Array.isArray(review.findings) && review.findings.every((item) => typeof item === "string")
    && Array.isArray(review.reviews) && review.reviews.length === expected.size
    && ["none", ...Object.keys(PROFILING_PROFILES)].includes(review.profilingProfile)
    && review.reviews.every((item) => expected.has(item.field) && ["approve", "reject"].includes(item.decision) && typeof item.reason === "string");
  if (!valid || new Set(review.reviews.map((item) => item.field)).size !== expected.size) throw new Error("Resource critic returned an invalid review object.");
  return review;
}

function tuningAdviceFor(field) {
  if (field === "memoryGb") return "Use MaxRSS from sacct or seff to set measured memory headroom.";
  if (field === "walltime") return "Use elapsed time and solver progress to size the next walltime.";
  if (field === "cpus") return "Compare elapsed time and CPU efficiency before scaling the MPI ranks.";
  return "Verify GPU utilization and solver compatibility before requesting an accelerator.";
}

function agentMetadata(role, response) {
  return { role, model: response.model, latencyMs: response.latencyMs ?? null, usage: response.usage ?? null };
}

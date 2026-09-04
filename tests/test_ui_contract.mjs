import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

test("UI invalidates recommendation confirmation after edits and sends signed token", () => {
  assert.match(app, /checkbox\.checked = false/);
  assert.match(app, /recommendationToken: state\.recommendationToken/);
  assert.match(app, /state\.formDraft\.delete\(field\)/);
});

test("UI exposes complete diagnosis metadata and repair comparison", () => {
  for (const field of ["Reason", "Elapsed", "AllocTRES"]) assert.match(html, new RegExp(`name="${field}"`));
  for (const id of ["deterministicFindings", "diagnosisAlternatives", "missingEvidence", "diagnosisSources", "repairComparison"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(app, /originalSpec/);
  assert.match(html, /<option value="OUT_OF_MEMORY">Out of memory<\/option>/);
  assert.doesNotMatch(html, /Detected 1 oom_kill event/);
});

test("UI provides compact failure evidence collection without sending the job ID to diagnosis", () => {
  for (const id of ["failurePhase", "failureJobId", "buildEvidenceButton", "evidenceCommands", "dispositionBanner"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(app, /api\("\/api\/failure-evidence"/);
  assert.match(app, /api\("\/api\/diagnose", \{ cluster: data\.cluster, script: data\.script, log: data\.log, metadata, originalSpec \}\)/);
});

test("UI discloses whether the AIR diagnosis passed evidence validation", () => {
  assert.match(app, /AIR evidence validated/);
  assert.match(app, /AIR response rejected; verified checks shown/);
});

test("UI gates final submission and unresolved job commands", () => {
  assert.match(html, /id="submissionAcknowledgement"[^>]*hidden/);
  assert.match(app, /button\.disabled = step\.unresolved/);
  assert.match(app, /submitContainer\.hidden/);
});

test("UI cancels superseded intake requests", () => {
  assert.match(app, /intakeController\?\.abort\(\)/);
  assert.match(app, /signal: controller\.signal/);
});

test("UI distinguishes mock mode and retains unchanged user decisions", () => {
  assert.match(html, /id="mockModeNotice"/);
  assert.match(app, /MOCK \| LOCAL FIXTURES/);
  assert.match(app, /confirmedRecommendations/);
  assert.match(app, /refreshReadinessMessage/);
  assert.match(app, /missingLocalFields\(readSpec\(form\)\)/);
});

test("readiness uses actual form state and treats modules and arguments as optional", () => {
  assert.match(html, /Modules, comma separated<input name="modules" placeholder="Optional;/);
  assert.match(html, /Arguments, one per line<textarea name="args"[^>]*placeholder="Optional;/);
  assert.match(app, /inputMatchesRecommendation\(input, state\.recommendations\.get\(field\)\.value\)/);
  assert.match(app, /recommendation\.field === "args" \? "\\n" : ","/);
  assert.doesNotMatch(app, /Still needs your input:.*payload\.analysis\.missingFields/);
});

test("successful generation collapses accepted suggestions and edits invalidate stale output", () => {
  assert.match(html, /id="acceptedSuggestions"/);
  assert.match(html, /id="confirmationSubtitle"/);
  assert.match(app, /showAcceptedSuggestions\(payload\.spec\)/);
  assert.match(app, /air_recommended_user_confirmed/);
  assert.match(app, /invalidateGeneratedResult\(\)/);
  assert.match(app, /Requirements changed; validate again/);
});

test("newcomer tools use compact recommendations and task tabs", () => {
  for (const tab of ["script", "explain", "check", "run"]) assert.match(html, new RegExp(`data-output-tab="${tab}"`));
  for (const id of ["correctionBar", "resourceEstimate", "scriptExplanations", "readinessChecks", "firstRunPlan"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(app, /recommendation-details/);
  assert.match(app, /updateResourceEstimate/);
});

test("UI exposes ASU documentation grounding and local outcome feedback", () => {
  for (const id of ["groundingBar", "knowledgeSources", "toolGuidance", "generationKnowledgeSources", "outcomeFeedback", "outcomeStatus"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /Hardware queue \(partition\)/);
  assert.match(html, /Run policy \(QoS\)/);
  assert.match(app, /OUTCOME_STORAGE_KEY/);
  assert.match(app, /map\(normalizeBrowserOutcome\)\.filter\(Boolean\)/);
  assert.match(app, /priorOutcomes: state\.localOutcomes/);
  assert.match(app, /Outcome saved locally/);
});

test("partition and QoS are dependent scheduler-profile selects", () => {
  assert.match(html, /<select name="partition" required disabled>/);
  assert.match(html, /<select name="qos" required disabled>/);
  assert.match(app, /health\.schedulerOptions/);
  assert.match(app, /syncSchedulerOptions/);
  assert.match(app, /account\.required = selectedProfile\?\.requiresAccount/);
  assert.match(app, /priorRecommendationToken: preserveRecommendations \? state\.recommendationToken : null/);
  assert.match(app, /preserveRecommendations: true/);
});

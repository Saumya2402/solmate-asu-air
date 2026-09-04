import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const config = await readFile(new URL("../public/config.js", import.meta.url), "utf8");

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
  for (const id of ["failurePhase", "failureJobId", "buildEvidenceButton", "evidenceCommands", "loadDiagnosisDemoButton", "diagnosisDemoStatus", "dispositionBanner"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(app, /api\("\/api\/failure-evidence"/);
  assert.match(app, /api\("\/api\/demo-diagnosis"\)/);
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

test("static interface supports a separate AIR API without embedding credentials", () => {
  assert.match(html, /src="\.\/config\.js"/);
  assert.match(html, /src="\.\/app\.js"/);
  assert.match(html, /href="\.\/styles\.css"/);
  assert.match(app, /SOLMATE_CONFIG\?\.apiBaseUrl/);
  assert.match(app, /AIR service not connected|AIR OFFLINE/);
  assert.match(config, /apiBaseUrl: ""/);
  assert.doesNotMatch(config, /sk-[A-Za-z0-9]/);
});

test("UI exposes workflow progress, busy state, and accessible tab panels", () => {
  assert.match(html, /id="planProgress"/);
  assert.match(html, /role="tabpanel"/);
  assert.match(app, /updatePlanProgress\("review"\)/);
  assert.match(app, /setAttribute\("aria-busy", String\(busy\)\)/);
});

test("UI provides Motion-powered spring, scroll, exit, and floating-action interactions", () => {
  assert.match(html, /src="\.\/vendor\/motion\.js"/);
  assert.match(html, /src="\.\/vendor\/lucide\.js"/);
  assert.match(html, /id="quickActionToggle"/);
  assert.match(html, /id="quickActionMenu"/);
  assert.match(html, /class="quick-action-button"/);
  assert.match(html, /data-lucide="clipboard-pen-line"/);
  assert.match(html, /id="scrollProgress"/);
  assert.match(app, /motion\.scroll/);
  assert.match(app, /motion\.inView/);
  assert.match(app, /motion\.press/);
  assert.match(app, /type: "spring"/);
  assert.match(app, /motion\.stagger/);
  assert.match(app, /lucide\?\.createIcons/);
  assert.match(app, /opacity: \[1, 0\]/);
  assert.match(app, /prefers-reduced-motion/);
});

test("UI previews ASU documentation and exposes verified human support routes", () => {
  for (const id of ["docModal", "docPreview", "docPreviewOpen", "pointerHalo", "supportHub"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /https:\/\/asu\.service-now\.com\/sp\?/);
  assert.match(html, /https:\/\/links\.asu\.edu\/rc-support/);
  assert.match(html, /https:\/\/asu\.zoom\.us\/my\/rcofficehours/);
  assert.match(html, /mailto:rc-help@asu\.edu/);
  assert.match(app, /function openDocPreview/);
  assert.match(app, /function closeDocPreview/);
  assert.match(app, /docExpansionTransform/);
  assert.match(app, /source\.dataset\.docPreview/);
  assert.match(app, /function setupScrollMotion/);
  assert.match(app, /function setupPointerHalo/);
  assert.match(app, /velocity\[key\]/);
});

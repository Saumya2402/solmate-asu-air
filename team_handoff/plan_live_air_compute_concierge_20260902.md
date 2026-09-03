# Live AIR Compute Concierge Implementation Plan

## Objective

Convert the existing mock prototype into a tested, pitch-ready website whose guided job-planning, safe Sol handoff, and failure-diagnosis workflows use ASU AIR-hosted models in real time through the Voyager-provided API key.

## Sources checked

- `AGENTS.md`
- `plans/plan_air_compute_concierge_demo_20260902.md`
- `diary/20260902_1941_air-compute-concierge-demo.md`
- `reviews/review_hackathon-idea-options_20260902.md`
- All files under `src/`, `public/`, `scripts/`, and `tests/`
- `README.md`, `.env.example`, and `package.json`
- `ASU AIR Spark Kick Off Slides (in progress).pptx`
- `Spark Challenge Prep Workshop Deck.pdf`
- ASU RC LLM API documentation: `https://docs.rc.asu.edu/ai/api/`
- ASU RC VS Code BYOK documentation: `https://docs.rc.asu.edu/ai/api/vscode-byok/`
- ASU RC Voyager account documentation: `https://docs.rc.asu.edu/voyager-request-account/`
- ASU RC AIR getting-started documentation: `https://docs.rc.asu.edu/ai/getting-started/`
- ASU RC job-state reference: `https://docs.rc.asu.edu/jobstates/`
- ASU RC Slurm/SBATCH reference: `https://docs.rc.asu.edu/slurm-sbatch/`
- ASU RC job-statistics reference: `https://docs.rc.asu.edu/job-statistics/`
- ASU RC partitions and QoS reference: `https://docs.rc.asu.edu/partitions-and-qos/`
- ASU RC available-software reference: `https://docs.rc.asu.edu/available-software/`
- ASU RC web-portal reference: `https://docs.rc.asu.edu/web-portal/`
- ASU RC Slurm script generator tutorial: `https://docs.rc.asu.edu/tutorials/slurm-script-generator/`
- ASU RC new-user guide: `https://docs.rc.asu.edu/new-user-guide`
- ASU RC file-transfer guide: `https://docs.rc.asu.edu/transferring-to-supercomputer/`
- ASU RC transition-to-SBATCH guide: `https://docs.rc.asu.edu/transition-interactive-to-sbatch/`
- ASU RC helpful Slurm commands: `https://docs.rc.asu.edu/helpful-slurm-commands/`
- `reviews/review_live_air_plan_20260902.md`
- `diary/20260902_2035_live-air-critic-review.md`

## Current state

- The dependency-free Node.js website runs on `http://127.0.0.1:4173` in mock mode.
- The planner/validator/renderer/critic mock workflow passes 8 automated tests and an HTTP smoke test.
- A user-level AIR API credential is available without printing its value. Its validity still requires live preflight verification.
- Live `/v1/chat/completions` connectivity through the project's Node `AirClient` is verified with `qwen3-coder-next`.
- The minimal live preflight returned the exact requested text in 815 ms.
- A full-plan critic call returned successfully in 145,059 ms using 5,945 total tokens. This latency is unacceptable for the synchronous demo path.
- Two requests to the AIR-hosted `gpt-oss-120b` model returned HTTP 400 after approximately 43 seconds; that model is excluded until its request compatibility is diagnosed.
- Planner and critic mock responses are fixtures; they are not acceptable evidence of AIR use.
- ASU explicitly publishes AIR skills for Slurm batch scripts and diagnosing stuck or failed jobs, validating the institutional relevance of failure forensics.
- Official account documentation says an LLM-only Voyager account does not grant Sol/Phoenix HPC access. HPC access requires the appropriate sponsored account, and Voyager access requires the ASU VPN.
- HTTP reachability checks to the Sol and Phoenix portals from the current process returned no response. This does not determine the user's authorization; it only means direct cluster validation is unavailable from this environment now.
- A live AIR failure-forensics critic run with `qwen3-coder-next` completed in 51,337 ms using 1,051 tokens. Its supported findings are incorporated below; its blanket `reject` verdict is narrowed to rejection of overconfident claims, not rejection of the feature.
- The UI has an encoding artifact in `public/app.js`; replace it with an ASCII separator during the first UI edit.

## Assumptions / unknowns

- The AIR credential remains in the user-level environment; it will never be pasted into prompts, emitted by a command, or committed.
- `https://openai.rc.asu.edu/v1/chat/completions` remains the required endpoint.
- At least one code-oriented and one review-oriented model from the Voyager model list will successfully handle the prompts.
- AIR may not support `response_format` or identical tool-calling behavior across models, so the implementation will continue using plain Chat Completions with defensive JSON extraction.
- Model latency, JSON adherence, context limits, and availability must be measured rather than inferred from model size.
- Exact Sol partitions, module names, and resource limits are outside the current evidence base. The app must not present demo guardrails as ASU policy.
- Sol and Phoenix may have different partitions, QoS policies, hardware, and module catalogs. Every diagnosis must be scoped to `sol`, `phoenix`, or `unknown`, and rules may not leak across cluster profiles.
- Public ASU documentation can support a credible offline MVP, but it cannot establish a user's account-specific QoS access, current module availability, or that a proposed repair succeeds on a real cluster.
- Synthetic failures support regression testing for known categories only; they do not justify a general real-world accuracy percentage.
- The user reports having Sol access. This permits a human-operated validation session, but the application will not store Sol credentials, open SSH sessions, or submit jobs itself.
- Resource recommendations are advisory until the user explicitly confirms them. The system must distinguish user-provided values from AIR recommendations in both state and UI.
- Epoch count is meaningful for model-training workloads but is an application argument rather than a Slurm resource. It is required only when the selected workload template uses epochs.
- A public deployment is not required for the current deliverables; the primary demonstration can run locally with a recorded backup.
- Runtime calls have a 20-second median latency target and a 45-second hard timeout per role. A critic that misses the target becomes an optional second action rather than blocking initial script display.

## Decisions from live AIR critic review

- Keep live AIR success as a compliance gate. Do not substitute mock output for proof of AIR use.
- Keep the existing phase ordering; no benchmark/preflight circular dependency exists.
- Add an early structured-JSON conformance probe before feature expansion.
- Define diagnosis evidence matching and repair boundaries before implementing diagnosis.
- Add explicit credential preflight, repair-safety, secret-redaction, filename, and per-role latency tests.
- Fix the encoding artifact in `public/app.js` during the first UI change using an ASCII separator.
- Keep long-context critic calls off the golden-path demo unless a faster model passes the benchmark.

## Scope

### User workflow 1: Plan a job

1. Accept a plain-language workload description.
2. Call an AIR planner model to extract only explicitly stated requirements, classify the workload, identify missing fields, and propose separately labeled recommendations with rationale.
3. Ask focused follow-up questions for every conditionally required field; do not generate a script while required values are missing or merely recommended.
4. Require the user to confirm or replace each recommendation, then record provenance as `user_provided` or `air_recommended_user_confirmed`.
5. Parse and validate the completed structured job specification using deterministic code and the selected cluster/QoS profile.
6. On validation failure, return field-specific errors and acceptable documented bounds; preserve valid answers and request only corrected fields.
7. Render a controlled Slurm script only after completeness and validation pass.
8. Call an independent AIR critic model.
9. Display resources, recommendation rationale, warnings, model identities, latency, script, and review.
10. Allow copying or downloading the generated `.slurm` file with Unix LF line endings.

### Guided intake and recommendation contract

- Required for every job: target cluster, workload type, executable/entry point, working directory, CPU count, memory amount with unit, GPU count including explicit `0`, walltime, partition, QoS/account context, and output/error paths.
- Conditionally required fields come from deterministic workload templates. ML training requires framework/environment, training entry point, dataset location, and epochs or an explicit statement that epochs are controlled in a config file. Distributed jobs require nodes, tasks, and CPUs per task. GPU jobs require GPU count and, only when necessary, GPU type/constraint.
- AIR may recommend missing CPU, memory, GPU, walltime, or training values, but its output must contain a rationale, uncertainty, and evidence from the user's description. Recommendations never silently become requested resources.
- Present each recommendation in an editable confirmation step. `Confirm` and `Change` are explicit actions; continuing without either is prohibited.
- Never infer that a workload needs a GPU merely because it is machine learning, or infer epochs from a model/framework name.
- When the user cannot estimate resources, AIR should recommend a small profiling/debug run and explain how `seff`, `sacct`, or workload-specific metrics can refine the next request.
- Keep scheduler resources separate from application parameters: epochs, batch size, learning rate, and dataset paths belong to the command/template, not `#SBATCH` headers.
- Planner output must use `null` for unknown values and include `missingFields`; default-looking numbers supplied by the model are rejected unless marked as recommendations and confirmed by the user.

### Resource validation contract

- Validate types, integer precision, positivity, units, time format, cross-field consistency, and shell-safe strings before policy validation.
- Reject impossible or abusive magnitudes such as `10,000,000` CPUs before any AIR call used to render a script. Never clamp a bad value silently.
- Validate against the selected dated cluster/QoS profile. For example, when the user selects the documented Sol `class` QoS, enforce its published per-job CPU, memory, GPU, and walltime limits.
- For account-specific or unavailable limits, do not invent a maximum. Block readiness, explain what is unknown, and provide `myaccounts`, `myfairshare`, or other documented discovery commands for the user to run and report back.
- Maintain a conservative application-level plausibility ceiling, explicitly labeled as a product guardrail rather than ASU policy. Its exact values must be documented in `knowledge/asu_rc_rules.json`, reviewed against current cluster inventory before implementation, and kept lower than JavaScript's unsafe-integer range.
- Cross-check GPU count against GPU-capable partition/profile rules, requested memory against profile capacity, walltime against QoS, and nodes/tasks/CPUs for arithmetic consistency.
- Validation errors must include the rejected field/value, why it failed, the applicable source/rule ID, and either an allowed range or a discovery action. AIR may explain and recommend a revised value, but deterministic validation decides acceptance.
- A corrected value must pass the complete validator again; repeated failure returns to the same focused correction step without losing other confirmed inputs.

### User workflow 1B: Run on Sol

1. Make this panel available only after a script passes completeness, deterministic validation, rendering, and critic checks.
2. Ask for non-secret handoff values such as ASURITE placeholder, local script path, and remote working directory; never ask for a password, Duo code, private key, or token.
3. Generate two copyable command sequences: upload from the local terminal with `scp`, or use a script already present through the Sol web portal.
4. Show `ssh <asurite>@sol.asu.edu`, `cd <remote-directory>`, `bash -n <script>`, and `sbatch --test-only <script>` before the separate final `sbatch <script>` action.
5. Show `squeue -u $USER`/`myjobs` for monitoring and a `sacct`/`seff` collection command whose output can be returned to Failure Forensics.
6. Keep placeholders visibly unresolved and disable one-click command copying until required path values pass strict validation.
7. Explain that commands are generated for user review and execution. The website never runs them, captures credentials, or claims successful submission.
8. Provide the Sol Open OnDemand route as an alternative for uploading the file and opening Shell Access.

### Terminal command safety contract

- Build commands from typed fields using deterministic templates; AIR may explain the sequence but may not emit the executable command string.
- Permit only the fixed command verbs required by the documented workflow: `scp`, `ssh`, `cd`, `bash -n`, `sbatch --test-only`, `sbatch`, `squeue`, `myjobs`, `sacct`, and `seff`.
- Reject control characters, newlines, command substitutions, shell metacharacters, traversal segments, leading-option filenames, and unvalidated remote destinations.
- Use a validated `.slurm` filename and Unix LF output. Do not add `dos2unix` as an automatic step; show it only as documented troubleshooting for a detected line-ending problem.
- Keep dry-run and real submission commands visually separated. Never combine upload, login, validation, and submission into a single chained command.
- Never include `sbatch` flag overrides in the generated submission command because they can silently replace validated directives in the file.

### User workflow 2: Diagnose a failure

1. Accept a cluster selector (`sol`, `phoenix`, or `unknown`), Slurm script, job log, and optional structured job metadata with strict size limits.
2. Request the most useful corroborating metadata: Slurm state/reason plus `sacct` or `seff` fields such as `State`, `ExitCode`, `Elapsed`, `MaxRSS`, `ReqMem`, and `AllocTRES`.
3. Detect a small deterministic set of recognizable errors before calling a model.
4. Call an AIR diagnostician with the cluster scope, script, log, metadata, deterministic findings, and applicable versioned ASU rules.
5. Require structured evidence: category, quoted input lines or metadata fields, explanation, confidence tier, missing evidence, and recommended changes.
6. Validate every diagnosis evidence entry against the submitted input.
7. For an app-generated script, apply only an allowlisted structured patch to the original validated specification and render through the existing controlled renderer.
8. For an arbitrary pasted script, show diagnosis and recommendations but do not automatically rewrite the script.
9. Label rendered changes as a "proposed script validated against documented constraints," never as a proven correction unless a real cluster test is completed.
10. Show original and proposed app-generated scripts side by side without executing either.

### Failure-forensics interpretation boundary

- **Confirmed:** use only when an exact documented Slurm state/reason or error is present and required corroborating metadata agrees. Confirmation means the supplied evidence supports the category, not that the app reproduced the failure.
- **Probable:** use when one strong signal exists but plausible alternatives remain. List those alternatives and the metadata needed to distinguish them.
- **Inconclusive:** use when evidence is missing, contradictory, cluster-unspecified, or compatible with multiple causes. Do not produce an automatic repair.
- Treat `PENDING` reasons such as priority or resource availability as scheduler states, not failed jobs or user mistakes.
- Treat node-down, drained-node, maintenance, launch-infrastructure, and other administrator conditions as escalation/advice cases; do not rewrite the script automatically.
- Do not map exit codes one-to-one to causes. For example, an OOM conclusion requires corroboration such as an OOM state/message or memory usage relative to the request; exit code alone is insufficient.
- Treat "Invalid feature specification" as an ambiguous partition/QoS/constraint family unless another exact signal identifies the invalid field.
- Do not infer account-specific partition or QoS authorization from public documentation. Recommend the documented account/fair-share checks when authorization is unknown.
- Keep platform rules versioned and cluster-scoped. When the cluster is `unknown`, use only cluster-neutral rules and explicitly request clarification.
- Redact or warn about usernames, email addresses, account/project names, job IDs, hostnames, and sensitive paths before an AIR request. Never persist raw pasted logs in benchmark results or the diary.
- The MVP can accurately parse inputs, enforce evidence matching, identify documented patterns, and report uncertainty offline. It cannot prove real-cluster repair success, current entitlement, or production-wide diagnostic accuracy without sponsored HPC access and controlled validation.

### Diagnosis evidence contract

- Reject empty logs and logs larger than 20,000 characters.
- Normalize CRLF to LF, split into numbered lines, and preserve the submitted line order.
- Require evidence as an array of `{ lineNumber, text }` objects using 1-based line numbers.
- Trim leading and trailing whitespace from both the submitted line and evidence text, then require exact equality.
- Use `lineNumber` to disambiguate duplicate lines; a correct text value on the wrong line is rejected.
- Represent multi-line evidence as multiple evidence objects, one per source line.
- Reject the entire model diagnosis when any evidence entry is empty, out of range, or does not match.
- Display deterministic pattern findings separately from model findings so one cannot silently validate the other.
- Validate metadata evidence by exact field name and normalized value; do not let a model cite metadata that the user did not supply.
- Record source rule IDs separately from user-input evidence. A documentation citation can explain a diagnosis but cannot substitute for evidence that the condition occurred in this job.

### Repair safety contract

- Never accept or render a raw replacement shell script from a model.
- Automatic repair is available only when the submitted script exactly matches `renderSlurmScript(originalSpec)` for a previously validated app-generated specification.
- Allow model patches only for `cpus`, `gpus`, `memoryGb`, `walltime`, `partition`, and `modules`.
- Keep `jobName`, `executable`, and `args` immutable during automatic repair.
- Merge the allowlisted patch into the original specification, run full validation, and render only when validation succeeds.
- For arbitrary or modified scripts, return diagnosis and recommendations without an automatic repair.
- Suppress automatic repair for `inconclusive` findings and administrator/infrastructure conditions.

### ASU rules knowledge contract

- Store a small curated rule set locally rather than scraping documentation at request time.
- Each rule must include a stable rule ID, category, cluster scope, trigger conditions, required corroboration, exclusions, source URL, and `checkedAt` date.
- Rules derived from public docs must distinguish documented fact from team-authored inference.
- A deterministic selector may provide only rules matching the chosen cluster or marked cluster-neutral.
- Changes to partitions, QoS, modules, state meanings, or exit-code guidance require fixture and test updates plus a refreshed source-check date.

### Agentic harness

- Planner role: workload description to explicit facts, missing fields, and separately labeled recommendations; then confirmed inputs to structured job specification.
- Critic role: independent review of validated specification and rendered script.
- Diagnostician role: evidence-grounded failure analysis and structured repair proposal.
- Deterministic gate: validation, evidence checking, rendering, and rejection logic owned by code rather than a model.
- All role model IDs configurable through environment variables.
- Every response records role, requested model, returned model, latency, and token usage when provided.
- Conversation state is a deterministic intake state machine; the model cannot mark a job ready or bypass a required field.

### Model evaluation

Use a small, repeatable benchmark rather than calling every catalog model. Initial candidates:

| Role | Primary candidate | Comparison candidates | Selection criteria |
|---|---|---|---|
| Planner | `qwen3-coder-next` | `qwen3-coder-30b-a3b-instruct`, `north-mini-code` | Valid JSON rate, valid job-spec rate, median latency <=20 seconds |
| Critic | `devstral2-123b` | `qwen3-235b-a22b-thinking-2507`, `qwen3-coder-next` | Useful defect detection, unsupported-claim rate, median latency <=20 seconds |
| Diagnostician | `qwen3-coder-next` | `devstral2-123b`, `qwen3-coder-30b-a3b-instruct` | Correct category/evidence, valid patch, median latency <=20 seconds |

The benchmark will use five workload cases and five seeded failure cases, run sequentially, and be time-boxed to 60 minutes. Stop evaluating a model after one hard timeout, an API compatibility failure, or repeated malformed output. Select one AIR-hosted model per role and record the evidence; do not route production requests to all candidates. The AIR-hosted `gpt-oss-120b` model is excluded unless its HTTP 400 behavior is resolved after the core product works.

## Out of scope

- Executing, submitting, cancelling, or monitoring real cluster jobs.
- SSH, Sol credentials, or direct filesystem access to a cluster.
- Autonomous shell execution or model-generated tool calls.
- Collecting or storing ASURITE passwords, Duo responses, SSH keys, or cluster session credentials.
- Automatically accepting AIR resource estimates or silently filling missing requirements.
- Exhaustive Slurm support, scheduling optimization, or guaranteed resource recommendations.
- Claims that a proposed script is fixed, production-safe, or verified on Sol/Phoenix without a controlled cluster run.
- Real-world accuracy percentages based only on synthetic fixtures.
- Unverified ASU-specific partitions, modules, limits, pricing, or queue-time predictions.
- User accounts, databases, conversation persistence, billing, or public multi-tenant hosting.
- Full documentation RAG, embeddings, image generation, voice, or unrelated multimodal features.
- Calling all available AIR models merely to claim broad model usage.
- Major framework migration or unnecessary runtime dependencies.

## Exact files and interfaces

### Existing files to modify

- `package.json`
  - Add explicit `start:mock`, `start:live`, `demo:live`, and model benchmark scripts.
  - Preserve `npm start` compatibility but make its active mode unmistakable.
- `.env.example`
  - Add diagnostician model, request timeout, and explicit mode variables with no secrets.
- `src/air_client.mjs`
  - Record request latency.
  - Add bounded retry delay and clearer 401, 404, 429, timeout, and malformed-response errors.
  - Preserve the existing `chat()` call shape and documented endpoint.
- `src/job_spec.mjs`
  - Add normalized job-spec output, required/conditional field rules, provenance, and reusable structured validation results.
  - Add `.slurm` download-safe filename generation.
  - Add exact script/spec equivalence checking and allowlisted structured patch application.
  - Preserve current validation and rendering behavior for valid existing fixtures.
- `src/agent_harness.mjs`
  - Add one bounded JSON-repair attempt for malformed planner or critic output and a planner response contract that separates extracted facts from recommendations.
  - Add diagnostician role and `diagnose({ cluster, spec, script, log, metadata, rules })` method.
  - Return timing/model metadata consistently.
- `src/mock_gateway.mjs`
  - Add deterministic mock responses for each seeded diagnosis case.
- `src/server.mjs`
  - Keep `GET /api/health` and `POST /api/generate` working.
  - Add `POST /api/intake`, `POST /api/diagnose`, and `GET /api/demo-status`.
  - Add security headers, stricter content-type checks, and endpoint-specific body limits.
  - In live mode, fail startup when the key is absent; never silently fall back to mock.
- `public/index.html`
  - Add tabs for Plan Job and Diagnose Failure plus the validated Sol handoff panel.
  - Add model provenance, latency, downloadable output, diagnosis evidence, and repair comparison.
- `public/app.js`
  - Add API calls, deterministic intake state, recommendation confirmation, field-level correction, loading/error states, safe rendering, tabs, file download, and command copying.
  - Replace the malformed separator with an ASCII separator during the first UI edit.
- `public/styles.css`
  - Add stable responsive layouts for diagnosis and script comparison.
  - Preserve the current ASU maroon/gold visual language and compact operational design.
- `scripts/demo_run.mjs`
  - Exercise both planner/critic and diagnosis flows in mock and live modes.
- `tests/test_job_spec.mjs`
  - Add normalization, missing/conditional fields, resource boundaries, cross-field constraints, filename, and repair-rendering cases.
- `tests/test_agent_harness.mjs`
  - Add malformed JSON recovery, invalid output rejection, diagnosis evidence, and latency metadata tests.
- `README.md`
  - Document credential-safe preflight, explicit modes, model benchmark, demo checklist, limitations, and recovery steps.
- `AGENTS.md`
  - Add live-run evidence and benchmark-result requirements without changing existing safety rules.

### New files to add

- `src/diagnosis.mjs`
  - Deterministic patterns, confidence tiers, cluster/rule selection, diagnosis schema validation, log/metadata evidence checking, redaction, and repair validation.
- `knowledge/asu_rc_rules.json`
  - Curated, versioned, source-linked, cluster-scoped diagnostic and resource-policy rules derived from official ASU RC documentation, plus separately labeled application plausibility ceilings.
- `src/intake.mjs`
  - Workload templates, required-field derivation, provenance tracking, recommendation confirmation, and ready-state calculation.
- `src/terminal_handoff.mjs`
  - Deterministic, placeholder-safe Sol upload, validation, submission, monitoring, and diagnostic collection command generation.
- `scripts/air_preflight.mjs`
  - Fail quickly when the key is absent, call a selected model for exact structured JSON, and print only sanitized metadata.
- `scripts/model_benchmark.mjs`
  - Run selected candidate models against versioned fixtures and write sanitized results.
- `fixtures/workload_cases.json`
  - Five representative workload prompts with invariant expectations.
- `fixtures/failure_cases.json`
  - Synthetic scripts/logs/metadata for out-of-memory, timeout, ambiguous invalid feature, missing executable/module, GPU allocation, pending-not-failed, and administrator-condition cases.
- `tests/test_diagnosis.mjs`
  - Unit tests for deterministic detection, confidence tiers, exact evidence validation, duplicate/empty/multi-line cases, metadata corroboration, cluster isolation, redaction, ambiguity, and rejected hallucinated evidence.
- `tests/test_repair_safety.mjs`
  - Verify immutable command fields, rejected arbitrary scripts, safe filenames, shell quoting, and full validation before rendering.
- `tests/test_server.mjs`
  - HTTP tests for health, iterative intake, planning, diagnosis, content type, size limits, and safe errors using mock injection.
- `tests/test_intake.mjs`
  - Verify no assumed values, conditional epochs/distributed fields, explicit zero GPUs, provenance, recommendation confirmation, and correction loops.
- `tests/test_terminal_handoff.mjs`
  - Verify exact documented command sequences, unresolved placeholders, quoting, LF filenames, metacharacter rejection, no directive overrides, and dry-run/submission separation.
- `results/results_air_model_benchmark_<timestamp>.json`
  - Sanitized live benchmark output containing no API key, prompts with sensitive data, or raw upstream errors.
- `diary/<timestamp>_live-air-compute-concierge.md`
  - Implementation record required by `AGENTS.md`.

## Implementation steps

### Phase 0 - Credential and live preflight gate

1. Stop the currently running mock server to avoid mode confusion.
2. Live preflight confirms that the user-level AIR credential is active.
3. Add `npm run preflight:live`, which fails before network access when the key or model ID is absent.
4. Call `qwen3-coder-next` with `temperature: 0` for an exact small JSON object and validate every field.
5. Record only status, requested/returned model IDs, latency, token usage, and schema pass/fail.
6. If the primary model fails, distinguish authentication, model availability, rate limit, timeout, and schema failure before changing models.
7. Do not begin feature expansion until live connectivity and structured-output conformance both succeed.

Existing evidence: live connectivity through the website's Node client passed with `qwen3-coder-next` in 815 ms. Structured JSON conformance is still required.

Exit criterion: a sanitized live preflight proves the app can reach AIR with a valid model ID and return a schema-valid JSON object.

### Phase 1 - Harden the AIR client and explicit runtime modes

1. Add latency metadata and bounded retry delay to `AirClient.chat()`.
2. Keep authorization server-side and redact upstream bodies from user-facing errors.
3. Make mock/live startup explicit; live mode must fail closed without a key.
4. Add unit tests for success, timeout, 401, 429 retry, malformed JSON, and empty completion.

Exit criterion: client tests pass and a live completion succeeds through the same client used by the website.

### Phase 2 - Benchmark and select role models

1. Add versioned workload and failure fixtures containing no sensitive data.
2. Implement the benchmark runner with sequential calls to avoid unnecessary load.
3. Time-box the benchmark to 60 minutes and test no more than three candidates per role.
4. Measure JSON adherence, deterministic validation pass rate, expected diagnosis category/evidence, and per-call latency.
5. Stop a candidate after one 45-second timeout or an API compatibility failure.
6. Save sanitized results and select one model per role.
7. Update defaults only when benchmark evidence supports the change; otherwise proceed with confirmed `qwen3-coder-next` and mark comparison work incomplete.

Exit criterion: selected planner, critic, and diagnostician models have recorded pass/fail and latency evidence.

### Phase 3 - Complete the planning workflow

1. Replace the malformed separator in `public/app.js` with an ASCII separator.
2. Implement deterministic workload templates and the intake state machine before modifying the planner prompt.
3. Change the planner contract to return stated facts, `null` unknowns, missing fields, and advisory recommendations with rationale.
4. Add iterative follow-up and explicit recommendation confirmation; preserve completed valid fields during correction.
5. Normalize completed planner output and apply deterministic syntax, plausibility, cluster/QoS, and cross-field validation.
6. Add one bounded repair prompt only for malformed model JSON, never to fill missing user decisions.
7. Keep completeness and deterministic validation as the only path to script rendering.
8. Add model provenance, per-role latency, recommendation provenance, field errors, warnings, stable `data-mode`, and LF `.slurm` download to the UI.
9. Preserve `/api/generate` for existing callers but reject incomplete legacy requests with structured missing-field responses.
10. If critic median latency exceeds 20 seconds, return the validated script first and make critic review an explicit secondary action.

Exit criterion: five benchmark workloads complete through live AIR only after all required values are confirmed; omitted values and extreme requests cannot render; errors request focused corrections; and the browser downloads valid LF scripts.

### Phase 3B - Add the Sol handoff

1. Verify the team's Sol access manually through VPN and either the Sol portal or `ssh`; record only success/failure and no credential material.
2. Implement deterministic command builders and strict path, username, and filename validators.
3. Generate separate upload, login/navigation, syntax check, Slurm dry-run, submission, monitoring, and diagnostic collection steps.
4. Add copy controls per command, unresolved-placeholder blocking, and an explicit review acknowledgement before revealing the final submission command.
5. Validate one harmless generated script with `bash -n` and `sbatch --test-only` on Sol under human control. Submit a minimal debug job only if the team explicitly chooses to spend cluster resources.
6. Record sanitized command outcomes and any current policy differences in the dated knowledge profile.

Exit criterion: deterministic tests pass and a team member with Sol access can follow the generated steps through `sbatch --test-only` without the app receiving credentials or executing commands.

### Phase 4 - Add evidence-grounded failure diagnosis

1. Curate versioned Sol, Phoenix, and cluster-neutral rules from the official ASU references, with required corroboration and exclusions.
2. Implement cluster selection, sensitive-input redaction, and deterministic detection for the seeded failure categories and ambiguity/control cases.
3. Implement the exact diagnosis evidence and confidence contracts in this plan before calling a model.
4. Add the diagnostician AIR prompt and structured response parsing using only applicable rules.
5. Reject the entire model diagnosis when any evidence object fails exact input validation or any cited rule is absent/inapplicable.
6. For app-generated scripts only, validate exact script/spec equivalence and apply only allowlisted patch fields for confirmed or sufficiently corroborated probable findings.
7. Keep job name, executable, and arguments immutable; run full validation before rendering a proposal.
8. Return diagnosis without repair for arbitrary, modified, inconclusive, or infrastructure-failure cases.
9. Add the diagnosis tab, missing-evidence prompts, uncertainty labels, source links, and original/proposed comparison.

Exit criterion: all seeded failures and controls receive the expected category/confidence, cited evidence exists in supplied inputs, cluster profiles cannot leak, ambiguous cases remain ambiguous, sensitive fields are redacted, and unsafe repairs are rejected.

### Phase 5 - Product and pitch hardening

1. Verify clear live/model status and confirm all visible text is free of encoding artifacts.
2. Verify loading, timeout, malformed response, invalid input, and unavailable-model states.
3. Run responsive visual checks at approximately 1440x900, 768x1024, and 390x844.
4. Record the two-minute golden-path demo before optional refinements.
5. Update README, `AGENTS.md`, benchmark results, and diary with exact verified claims.

Exit criterion: the demo can be repeated three times without code changes, all visible claims match measured evidence, and a recorded backup exists.

## Validation plan

### Automated checks

- `npm test`
  - Expected: all existing and new tests pass with zero skipped tests.
- `node --check` for every `.js` and `.mjs` file.
  - Expected: zero syntax errors.
- `npm run demo:mock`
  - Expected: iterative planning, Sol handoff generation, and diagnosis flows complete deterministically.
- `npm run demo:live`
  - Expected: planner, critic, and diagnostician responses report AIR model IDs and non-empty content without exposing the key.
- Model benchmark
  - Expected: sanitized results for every attempted model/case and an explicit selected model per role.
- Secret scan
  - Expected: no key-like values in project text files, results, logs, or browser assets.

### API checks

- `GET /api/health`
  - Reports explicit `live` mode and configured role models, never the key.
- `POST /api/generate`
  - Returns a reviewed valid script for five fixture workloads.
  - Rejects undersized, oversized, malformed, and unsafe input.
- `POST /api/intake`
  - Returns missing fields without invented values, preserves confirmed fields, and reaches ready state only after explicit confirmation and deterministic validation.
  - Rejects `10,000,000` CPUs and other out-of-policy/cross-field requests with field-specific correction guidance.
- `POST /api/diagnose`
  - Returns evidence-grounded diagnoses for fixture failures and uncertainty for ambiguous/control cases.
  - Rejects evidence absent from the submitted log/metadata, inapplicable cluster rules, and invalid repair specs.
- Unsupported methods and content types
  - Return clear 4xx responses without stack traces or upstream bodies.

### Visual and manual checks

- Desktop, tablet, and mobile layouts have no overlap, clipping, or horizontal page overflow.
- Keyboard-only navigation reaches tabs, inputs, generation, copy, and download controls.
- Sol handoff commands contain no unresolved values when copy is enabled; dry-run and submission remain separate.
- Status visibly distinguishes MOCK and LIVE.
- The golden-path demo completes in under two minutes excluding temporary AIR service delays.
- Run the live demo three times and record success count plus median end-to-end latency.

## Definition of done

- The website visibly and verifiably calls ASU AIR in live mode.
- At least two product workflows use AIR-hosted models: plan/review and failure diagnosis.
- Every model-produced object is parsed and deterministically validated before use.
- No script is generated until every required or conditional input is explicitly supplied or a recommendation is explicitly confirmed.
- Every generated Sol command is produced by deterministic templates, and the app never executes it.
- Generated shell content is never executed or submitted.
- Five workload fixtures plus the expanded failure and control fixtures pass their invariant checks.
- Model identities and latency are shown without exposing credentials.
- All automated tests, syntax checks, API checks, and secret scans pass.
- Desktop and mobile visual checks pass.
- README, benchmark results, and diary contain only verified claims.
- A recorded demo exists as a backup for judging.

## 24-hour execution budget

| Window | Work |
|---|---|
| Hours 0-1 | Credential setup, live preflight, endpoint/model verification |
| Hours 1-3 | AIR client hardening and role-model benchmark |
| Hours 3-8 | Guided intake, validation, live planning, and malformed-output recovery |
| Hours 8-12 | Failure diagnosis, evidence validation, and repair flow |
| Hours 12-15 | Sol handoff commands, UI integration, download and comparison |
| Hours 15-18 | Automated tests, Sol dry-run, live fixtures, security and secret checks |
| Hours 18-20 | Visual QA and three repeated golden-path runs |
| Hours 20-22 | Record demo, README, benchmark summary, architecture visual |
| Hours 22-24 | Pitch rehearsal, submission verification, contingency buffer |

## What must not change

- Do not weaken the rule that generated scripts are never executed.
- Do not expose the API key to browser code, API responses, logs, fixtures, or screenshots.
- Do not remove mock mode; keep it for deterministic tests and offline rehearsal.
- Do not present mock output as AIR output.
- Do not remove existing `/api/health` or `/api/generate` behavior without a compatibility path.
- Do not add cluster credentials, SSH access, or real job submission.
- Do not let AIR recommendations bypass explicit user confirmation or deterministic limits.
- Do not emit a real submission command until the script and handoff fields validate; never execute that command in the application.
- Do not claim exact ASU scheduler policy without an authoritative source.
- Do not add unrelated AI features or a framework migration during this implementation.

## Expected outputs

- Updated working website and AIR client in the existing codebase.
- Explicit mock and live run commands.
- Three-role AIR agent harness with deterministic gates.
- Planning and failure-diagnosis interfaces.
- Versioned benchmark fixtures and sanitized live model results.
- Expanded automated test suite and API smoke tests.
- Updated `AGENTS.md` and `README.md`.
- New implementation diary entry.
- Recorded golden-path demo produced by the team after live validation.

## Risks and fallback rules

- **No valid key or unreachable AIR endpoint:** stop at Phase 0; do not claim live completion.
- **Primary model unavailable:** benchmark the documented comparison candidate; do not change prompts and models simultaneously without recording it.
- **Large critic latency:** select the fastest candidate meeting defect-detection thresholds or make critic review an explicit second action in the UI.
- **Malformed model JSON:** allow one bounded repair attempt, then return a safe actionable error.
- **Rate limiting:** respect 429 responses, retry once with delay, and avoid parallel benchmark bursts.
- **Diagnosis hallucination:** reject evidence not literally present in the supplied log and show deterministic findings separately.
- **Missing or unrealistic resource requests:** keep unknowns as `null`, ask focused questions, require confirmation of recommendations, and reject values outside deterministic policy or plausibility rules without silent clamping.
- **Unsafe terminal handoff:** use fixed command templates, strict token validation, separate dry-run from submission, and never accept model-authored shell strings.
- **Policy drift or cross-cluster misinformation:** use dated, source-linked cluster profiles; never infer user entitlement; fail to `inconclusive` when cluster scope or current policy is uncertain.
- **Overstated validation:** describe synthetic results as fixture coverage and proposed changes as documentation-validated, not cluster-proven.
- **UI time pressure:** preserve the current interface and prioritize correct live status, output, and error handling over visual expansion.
- **AIR outage during judging:** use the prerecorded live demonstration and clearly disclose the current service issue; never relabel mock output as live.

## Approval gate

Implementation begins only after the user approves this plan. The first implementation action is Phase 0, which requires an active AIR credential in the user's own terminal without sharing it in prompts or repository files.

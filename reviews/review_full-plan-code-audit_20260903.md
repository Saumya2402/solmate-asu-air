# Full Plan And Code Audit

## Verdict

**Compliance: PARTIAL. Release status: BLOCKED.** The implementation demonstrates a real AIR-backed vertical slice, but it does not satisfy the approved plan's definition of done. Two critical safety/privacy defects and several high-severity correctness gaps remain. Roughly half of the phase tasks are fully satisfied; Phase 5 and key portions of Phases 2, 3B, and 4 are incomplete.

This was a review-only session. Application code was not changed.

## Findings

### Critical

1. **Unvalidated `account` allows generated Slurm directive injection.** `validateJobSpec()` never validates or rejects `spec.account`, while `renderSlurmScript()` inserts it directly into a `#SBATCH` line (`src/job_spec.mjs:40`, `src/job_spec.mjs:153`). A probe using `account: "research\n#SBATCH --wrap=touch_/tmp/pwned"` returned `valid: true` and rendered the injected directive. The browser does not expose this field, but `/api/generate` preserves arbitrary extra properties through `buildReadySpec()` (`src/intake.mjs:84-94`, `src/server.mjs:43-48`). This violates the controlled-renderer and unsafe-input rejection requirements. **Required fix:** define an allowlisted schema, reject unknown properties, validate `account` with a dedicated safe identifier rule, and add renderer/API regression tests.

2. **Diagnosis redaction is bypassed by unredacted deterministic findings and metadata.** `AgentHarness.diagnose()` builds findings from the raw log before redaction, then sends those findings and raw metadata to AIR beside the redacted log (`src/agent_harness.mjs:153-161`). Each finding retains the original evidence line (`src/diagnosis.mjs:21-27`). The probe showed that an email, username path, job ID, account, and hostname remained present in `deterministicFindings` even though the visible log was redacted. The redactor itself only covers emails, 6+ digit IDs, and the first user component of three path roots (`src/diagnosis.mjs:11-18`). This breaks the explicit plan requirement to redact usernames, account/project names, job IDs, hostnames, and sensitive paths before AIR. **Required fix:** redact the complete outbound object, including findings and metadata, preserve a reversible line map only in local memory for post-response validation, expand detectors, and test the exact serialized AIR request.

### High

3. **Unsupported partition/QoS pairs pass deterministic validation.** Partition and QoS are checked only for safe characters (`src/job_spec.mjs:59-60`, `src/job_spec.mjs:85`); `applyProfileLimits()` applies caps to a few recognized profiles but never rejects unknown pairs (`src/job_spec.mjs:111-124`). A `sol/general/general` probe returned `valid: true`. ASU's current documentation identifies `general/private` for non-owner use and `general/grp_*` for owners, while `public/public` is the common public profile. The knowledge file has only three partial Sol profiles, no Phoenix profiles, and `sol-class` omits its required `public` partition (`knowledge/asu_rc_rules.json`). **Required fix:** make the dated knowledge profile the single validation source, reject unsupported pairs, represent entitlement-dependent profiles explicitly, and block or clearly defer account-specific readiness with `myaccounts`/`myfairshare` guidance. Source: https://docs.rc.asu.edu/partitions-and-qos/

4. **Old browser drafts override newer verified AIR facts and recommendations indefinitely.** `renderIntake()` resets the form, fills new extracted facts, then overwrites them from `state.formDraft` (`public/app.js:74-87`). The map is cleared only on a completely empty reset (`public/app.js:181-190`), and recommendations fill only blank inputs (`public/app.js:101-104`). Therefore an old manual job name, path, resource, or invalid scheduler pair can defeat a later correction from AIR. This directly explains the reported stale and disappearing-value behavior. **Required fix:** track per-field source/version/dirty state, let newer explicit transcript facts supersede older drafts, and clear or rebase drafts after successful analysis.

5. **The independent resource critic cannot reject completion-advisor fields.** A rejected recommendation is still retained whenever its field came from `completionRecommendations` (`src/agent_harness.mjs:118-127`). If critic parsing fails, those recommendations are still returned while the UI-facing message says they were "withheld" (`src/agent_harness.mjs:130-132`). The verification layer is therefore partly cosmetic and its status text is false. **Required fix:** apply critic decisions uniformly, fail closed or label unreviewed recommendations honestly, and test rejected completion, scheduler, executable, and path suggestions.

6. **Recommendation confirmation and provenance are client-asserted, not server-verifiable.** `/api/generate` accepts an arbitrary list of `confirmedRecommendationFields` and labels those fields confirmed without linking them to a prior recommendation/value (`src/server.mjs:43-48`, `src/intake.mjs:84-94`). In the browser, checking a recommendation and then editing its value leaves the checkbox checked, so the edited value is mislabeled `air_recommended_user_confirmed` (`public/app.js:126-129`, `public/app.js:230-247`). **Required fix:** use a server-signed or server-held recommendation snapshot, bind confirmation to field plus exact value, invalidate confirmation on edit, and reject unknown confirmation fields.

7. **The planned diagnosis workflow is only partly exposed and automatic repair is unreachable from the UI.** The browser sends only four of seven supported metadata fields and never sends `originalSpec` (`public/app.js:317-325`, `src/server.mjs:115-117`). It renders no missing-evidence prompts, alternatives, rule source links, deterministic findings, repair result, or original/proposed comparison (`public/app.js:331-340`). Thus the repair branch at `src/agent_harness.mjs:162-165` cannot be exercised through the product. Rules also lack trigger/exclusion detail and are all cluster-neutral. **Required fix:** implement the complete evidence form and result contract, retain the generated spec locally, expose safe repair comparison, and add Sol/Phoenix leakage/control tests.

8. **Resource validation does not establish a runnable HPC job.** Validation caps total product values but does not cross-check tasks and CPUs against cores per node, GPUs against node/partition availability, memory against selected node type, duplicate output/error paths, or Phoenix heterogeneity (`src/job_spec.mjs:40-98`). ASU documents 128-core Sol standard nodes, 48-core Sol GPU nodes, and materially different Phoenix hardware. The recorded OpenFOAM script also renders `srun pimpleFoam` without establishing modules, case decomposition, or required solver arguments, yet is labeled validation-passed. **Required fix:** distinguish syntax-valid from environment/runnable status, add dated hardware-aware cross-field checks, and require explicit environment/application readiness or a clearly labeled profiling template. Source: https://docs.rc.asu.edu/supercomputer-hardware/

### Medium

9. **Sol handoff safety metadata is ignored by the UI.** The builder marks submission as requiring acknowledgement, but every step receives an immediately enabled Copy button (`src/terminal_handoff.mjs:19-28`, `public/app.js:300-313`). `<jobid>` commands remain copyable despite the plan's unresolved-placeholder block. There is no portal/already-uploaded path or `myjobs`/account discovery step, and no recorded `sbatch --test-only` outcome. **Required fix:** enforce acknowledgement in UI state, disable unresolved commands, offer upload/portal branches, and record a human-controlled dry run.

10. **AIR orchestration is unnecessarily expensive and has a stuck-button race.** Each intake pause can launch five concurrent AIR calls and then a sixth critic call (`src/agent_harness.mjs:50-62`, `src/agent_harness.mjs:116-129`), all defaulting to the same model. Browser sequencing prevents stale rendering but does not cancel superseded server work. If text is shortened below ten characters while a request is active, `analysisSequence` changes and no later `finally` re-enables the button (`public/app.js:35-46`, `public/app.js:51-70`). **Required fix:** cancel superseded requests end to end, fix busy-state ownership, consolidate roles where measured quality permits, and benchmark latency/cost for the actual seven-role configuration.

11. **Required benchmark and acceptance evidence is incomplete.** `fixtures/workload_cases.json` is not consumed by tests or the benchmark. The benchmark script runs one intake description per candidate, does not exercise failure fixtures, and changes only planner/critic/diagnostician model parameters while the newer extractor/auditor/completion/scheduler roles keep defaults (`scripts/model_benchmark.mjs`). The AirClient suite lacks the planned timeout, 401, malformed-response, and empty-completion cases. There are no three repeated live runs, five live generation cases, recorded demo, visual breakpoint evidence, or Sol `sbatch --test-only` record. **Required fix:** execute the plan's real fixture matrix and save sanitized per-role/per-case evidence.

12. **Error classification can label AIR failures as client errors.** The server uses message keywords to choose 400 versus 500; any malformed model response mentioning `JSON` becomes a 400 (`src/server.mjs:61-63`). That reproduces the misleading invalid-JSON experience and obscures upstream faults. **Required fix:** introduce typed validation, transport, model-output, and internal errors with stable HTTP status and machine-readable codes.

13. **Repository and documentation organization have drifted.** `src/agent_harness.mjs` combines prompts, seven-role orchestration, scientific profiles, scheduler policy, parsing, and diagnosis; scheduler limits are duplicated instead of read from the knowledge file. `.env.example` and README model configuration omit completion, scheduler, and fact-auditor variables (`README.md:63-67`). README's 466 ms point claim is inconsistent with the newer recorded 10-20 second role latencies. The root contains an unexplained empty `-H` file. There is no Git repository, so scope drift and unplanned edits cannot be audited reliably. **Required fix:** split the harness by responsibility, centralize policy data, update claims/configuration, remove accidental artifacts, and initialize version control before further hackathon work.

## Plan Compliance

| Phase | Status | Review result |
|---|---|---|
| Phase 0: live preflight | Done | Sanitized structured AIR evidence exists; current live server health reports all configured AIR roles. |
| Phase 1: client and modes | Partial | Explicit modes, server-side key, retry, and latency exist; four required client failure tests are missing. |
| Phase 2: model evaluation | Partial | One small result artifact exists; it is not the five-workload/five-failure, per-role benchmark in the plan. |
| Phase 3: planning | Partial / blocked | Real AIR extraction, follow-up, deterministic parsing, generation, and download exist; scheduler, confirmation, state, cross-field, and safety defects block completion. |
| Phase 3B: Sol handoff | Partial | Deterministic templates exist; acknowledgement, placeholder blocking, alternative route, account discovery, and Sol validation evidence are absent. |
| Phase 4: diagnosis | Partial / blocked | AIR diagnosis and exact evidence validation exist; outbound redaction is broken and most planned UI/repair/rule features are absent. |
| Phase 5: product/pitch | Not done | No responsive browser evidence, repeat live demo record, recorded backup, or complete failure-state verification exists. |

## Validation Performed

- `npm test`: **55/55 passed**, zero skipped.
- JavaScript syntax: **23 files passed** `node --check`.
- `npm run demo:mock`: **passed**.
- Secret scan: **no API-key-like strings found**.
- Live health at `http://127.0.0.1:4176/api/health`: **healthy, live mode**, seven roles reported.
- New live AIR calls: **not run** because the review shell did not contain `OPENAI_API_KEY`; existing sanitized live evidence was inspected.
- Browser visual/interaction checks: **not run** because no controllable browser was available.
- Account injection probe: **failed safety expectation**; validator accepted and renderer injected a second directive.
- Unsupported `general/general` probe: **failed policy expectation**; validator returned valid.
- Diagnosis privacy probe: **failed redaction expectation**; raw sensitive evidence remained in the outbound findings object.
- Git scope/diff review: **not possible** because the workspace is not a Git repository.

## Positive Controls

- The AIR key stays server-side in the reviewed source, and the secret scan is clean.
- Static serving has traversal protection and a restrictive same-origin CSP (`src/server.mjs:84-103`).
- User-controlled text is rendered with `textContent`, reducing browser XSS risk.
- Shell arguments and modules are quoted or constrained, and generated content is not executed by the application.
- Exact diagnosis evidence validation, allowlisted repair fields, mock determinism, LF download, and stale-response rendering guards are meaningful strengths.

## Required Fix Order

1. Block account/directive injection and reject unknown scheduler pairs.
2. Redact the entire diagnosis payload before AIR and add outbound-payload tests.
3. Repair form state precedence and server-bound recommendation confirmation.
4. Make critic decisions effective and status text truthful.
5. Complete hardware/application cross-field validation and diagnosis UI contracts.
6. Enforce handoff acknowledgement and unresolved-placeholder blocking.
7. Run the full fixture benchmark, browser checks, Sol dry run, and three-repeat live demo.
8. Reconcile README/configuration claims and establish Git history.

## Final Assessment

The project is a credible hackathon prototype with genuine AIR usage, but it is currently stronger as a demonstration of the concept than as a trustworthy HPC concierge. The next work session should be a narrowly scoped safety-and-state remediation pass before adding presentation polish or more agents.

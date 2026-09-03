# SolMate: ASU Compute Concierge

SolMate is a Spark Challenge prototype that uses ASU AIR-hosted models to interpret scientific workflows, detect software-specific execution concerns, review a deterministically rendered Slurm script, and diagnose supplied failure evidence. It never executes or submits generated commands.

## AIR attribution

All language-model inference demonstrated by SolMate runs through ASU AIR-hosted models. AIR performs workload interpretation, typo review, safe completion suggestions, scheduler-profile selection, scientific planning, independent critique, script explanation, and failure diagnosis. Deterministic Node.js code validates AIR evidence and recommendations before rendering any Slurm content.

## Architecture

~~~text
Browser
  -> local Node API
     -> AIR fact extractor + independent fact auditor -> verbatim-evidence facts
     -> AIR typo reviewer -> evidence-bound correction suggestions
     -> AIR planner + completion and scheduler advisors -> validated intake object
     -> conversational follow-up -> revised evidence and recommendations
     -> AIR resource critic -> approved or controlled profiling values
     -> deterministic completeness and policy gates
     -> controlled Slurm renderer
     -> AIR critic -> validated review object
     -> AIR Slurm explainer -> exact-line teaching notes
     -> deterministic Sol command templates
     -> AIR diagnostician -> exact evidence validation
~~~

The AIR fact extractor, independent fact auditor, typo reviewer, planner, completion advisor, and scheduler advisor run concurrently. AIR determines what the user's language means; deterministic intake code verifies that each returned quote exists, names the correct field category, and supports the returned value. Evidence-backed facts from earlier turns are revalidated against the accumulated transcript and retained when a later AIR response is partial. Newer verified facts override older ones. The completion advisor proposes editable naming, log paths, execution details, and empty module/argument lists without inventing software. The scheduler advisor can select only an exact pair from the dated profiles in `knowledge/asu_rc_rules.json`; it cannot claim account entitlement. Responsibilities are separated across the files in src: AIR transport, agent orchestration, intake, newcomer guidance, job validation/rendering, terminal handoff, diagnosis, and the HTTP boundary.

## Storage and privacy

The repository is stored locally in the current workspace. This workspace is under a OneDrive-synced directory, so Windows may sync files to the user's ASU Microsoft storage.

SolMate has no database and does not persist workload descriptions, follow-up answers, scripts, or logs. In live mode, prompts are sent from the local Node server to https://openai.rc.asu.edu/v1/chat/completions. The AIR key remains in the server process environment and is never sent to browser code.

## Build and test commands

Requirements: Node.js 20 or newer.

~~~powershell
npm test
npm run demo:mock
npm run start:mock
~~~

Open http://127.0.0.1:4173.

For live AIR, load an active AIR API key into the current terminal without committing it:

~~~powershell
$secureAirKey = Read-Host "Paste the AIR API key" -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureAirKey)
try {
  $env:OPENAI_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
}
$env:OPENAI_BASE_URL = "https://openai.rc.asu.edu/v1"
$env:AIR_MODE = "live"
npm run preflight:live
npm run probe:openfoam:live
npm run demo:live
npm run start:live
~~~

Clear the session key afterward with Remove-Item Env:OPENAI_API_KEY.

There is no model-training command. The project uses hosted AIR inference. Run the model compatibility probe with npm run benchmark:models.

## Measured model choice

The extractor, typo reviewer, completion advisor, and scheduler advisor default to `qwen3-30b-a3b-instruct-2507`. The fact auditor, planner, critic, diagnostician, and script explainer retain `qwen3-coder-30b-a3b-instruct`. The assignments live in `src/model_router.mjs`, and each role remains independently configurable through the corresponding `AIR_*_MODEL` variable shown in `.env.example`.

Recorded compatibility evidence is stored under `results/`. The latest stateful run took approximately 10-20 seconds per extraction/planning role, while earlier point measurements were faster. These are service observations, not latency guarantees. Run `npm run benchmark:models` to create a new sanitized workload-and-failure matrix for the configured candidate models.

Run `npm run benchmark:roles` for the bounded parallel fact-extractor comparison. It races at most three configured AIR candidates per sanitized fixture and records schema validity, validated field recall, and p50/p95 latency without storing prompts or raw model responses.

Run `npm run benchmark:role-suite` for the rapid nine-role AIR screening matrix. It uses an 18-second per-call cutoff and a process-wide concurrency cap of four. Set `AIR_ROLE_SUITE_ROLES=typo_reviewer,scheduler_advisor` to rerun only selected roles. The suite stores check names and aggregate scores, never prompts or raw responses.

## HTTP API

- GET /api/health: mode, role models, rules version, and dated cluster/partition/QoS choices for the intake UI.
- GET /api/demo-status: persistence and execution disclosures.
- POST /api/intake: evidence-backed AIR interpretation, prioritized scientific follow-up, independently reviewed recommendations, conflict detection, and missing fields.
- POST /api/generate: deterministic validation, script rendering, and AIR critique.
- POST /api/handoff: deterministic Sol upload/test/submit command steps.
- POST /api/diagnose: AIR diagnosis with exact log/metadata evidence checks.

## Safety boundaries

- Missing values remain unknown until supplied or explicitly confirmed.
- Natural durations such as `5000 minutes`, `2.5 hours`, or `1 day, 2 hours and 30 minutes` are converted to canonical Slurm walltime before validation; a bare number remains ambiguous and is rejected.
- Every AIR-extracted fact must cite an exact phrase in the user's description; deterministic recognition covers a small set of unambiguous values.
- Recommendations are advisory. Unsupported OpenFOAM estimates can be replaced with bounded profiling profiles selected by AIR and rendered by deterministic code.
- AIR recommendations cannot bypass deterministic validation.
- Recommendation confirmations are signed by the local server and bound to the exact values AIR returned.
- Follow-up answers carry the prior signed scheduler recommendation forward only when it still matches the latest cluster, walltime, and dated profile; ordinary description edits request a fresh recommendation.
- Partition and QoS are dependent selectors populated from the dated profiles in `knowledge/asu_rc_rules.json`; changing the cluster clears incompatible downstream choices.
- Scheduler pairs and per-node limits are validated again on the server; unsupported pairs cannot render.
- Parallel OpenFOAM commands require `-parallel`; users must still verify case decomposition and environment modules.
- Product plausibility ceilings are not represented as ASU policy.
- Account-specific permissions are never inferred.
- Arbitrary pasted scripts receive diagnosis and recommendations, not automatic rewriting.
- Proposed scripts require human review and sbatch --test-only before submission.
- The final submit command remains hidden until the user acknowledges the syntax and Slurm test-only checks.
- That acknowledgement is signed by the local server and bound to the exact handoff values that were reviewed.
- Diagnosis logs, scripts, metadata, and deterministic evidence are redacted as one outbound AIR payload.
- Credentials, Duo responses, SSH keys, and raw upstream error bodies are never collected.

## Newcomer workflow

- AIR detects likely prose and software-name typos, with each original token verified against the supplied description. Technical identifiers are never silently rewritten.
- Recommendations render as compact rows; rationale, assumptions, and tuning advice stay collapsed until requested.
- The reviewed output uses Script, Explain, Check, and Run tabs so only one task is visible at a time.
- Resource math shows total cores, core-hours, memory per task, and GPU-hours before and after generation.
- AIR explanations must quote every meaningful generated script line exactly or the app falls back to deterministic explanations.
- Deterministic environment checks cover the working directory, executable, modules, input script, and OpenFOAM decomposition where applicable.
- The Run tab covers upload/login, test-only validation, submission acknowledgement, monitoring, inspection, cancellation, accounting evidence, and efficiency review.

## Validation snapshot

On 2026-09-03, the local suite passed 83/83 tests, JavaScript syntax checks, the focused fixture/security run, the mock end-to-end demo, and a credential-pattern scan. Live AIR detected `OpenFom` and `simualtion` as corrections and suppressed a false capitalization suggestion for Sol. A separate live generation returned a valid approved script plus 16 exact-line explanations. A live replay of `job called imagev3` produced `jobName=imagev3` even when model extraction was not relied upon. Browser breakpoint QA, three repeated live runs, a recorded backup demo, and a human-controlled Sol `sbatch --test-only` remain manual acceptance tasks; they are not claimed as complete.

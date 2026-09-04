# Architecture And Data Flow

## Design Principle

SolMate separates probabilistic interpretation from deterministic control. AIR handles language, scientific context, explanation, and critique. Application code owns evidence validation, policy gates, state retention, Slurm rendering, and command construction.

## Planning Pipeline

```text
Workload description
  -> AIR fact extractor, fact auditor, typo reviewer, completion advisor,
     scheduler advisor, and planner run with bounded parallelism
  -> quoted evidence is checked against the accumulated transcript
  -> relevant dated ASU RC Docs entries are retrieved
  -> prior verified facts survive partial later responses
  -> recommendations remain editable and require confirmation
  -> deterministic completeness, plausibility, scheduler, and cross-field gates
  -> controlled Slurm renderer
  -> AIR critic and exact-line explainer
  -> deterministic environment checks and human-run Sol commands
```

AIR cannot introduce a scheduler pair outside `knowledge/asu_rc_rules.json`, bypass a failed field check, or directly author the rendered shell script.

## Failure Pipeline

```text
Script + log + scheduler metadata
  -> local redaction and deterministic signal detection
  -> relevant ASU RC Docs rules
  -> AIR diagnostician
  -> exact evidence and triggered-rule validation
  -> confirmed, probable, or inconclusive result
  -> bounded repair or a monitor/support disposition
```

A job ID is used only to construct local evidence commands. It is not included in the AIR diagnosis request. Arbitrary pasted scripts receive advice, not automatic rewriting.

## Runtime Components

- `public/`: browser state, forms, animated feedback, documentation dialogs, and output views.
- `src/server.mjs`: HTTP boundary, body limits, exact-origin CORS, safe error responses, and static assets.
- `src/agent_harness.mjs`: AIR role orchestration and response contracts.
- `src/air_client.mjs`: authenticated AIR transport, timeouts, cancellation, and bounded retry.
- `src/intake.mjs`: evidence retention, normalization, recommendation readiness, and plausibility checks.
- `src/job_spec.mjs`: final job validation and deterministic Slurm rendering.
- `src/diagnosis.mjs`: redaction, deterministic signals, evidence verification, and repair boundaries.
- `src/knowledge.mjs`: retrieval from the dated ASU Research Computing catalog.
- `src/terminal_handoff.mjs`: escaped, human-run upload, test, submit, and monitoring commands.
- `src/model_router.mjs`: independently configurable AIR model assignments.

## Data And Privacy

SolMate has no database. The server does not persist workload descriptions, scripts, logs, follow-up answers, or model responses. Live prompts travel from the Node API to the ASU AIR gateway; the browser never receives the AIR key.

Optional job-outcome feedback is stored in browser local storage as at most 12 sanitized records. It retains workload category, software label, resource numbers, walltime, scheduler pair, and selected outcome. It excludes free text, paths, job names, scripts, logs, notes, credentials, and job IDs. Outcome history is advisory context only and cannot change deterministic policy.

## Deployment

The Node service and browser can run together locally. GitHub Pages can host only the static browser files, so live Pages use requires a separate HTTPS Node API. Exact-origin CORS restricts which browser origins can call that API.

The current public demonstration may use a temporary HTTPS tunnel. That is intentionally described as ephemeral; a durable release should deploy the Node API to ASU-controlled hosting and retain the same server-side credential boundary.

## Trust Boundaries

- User confirmation does not override deterministic validation.
- Model recommendations do not establish account entitlement.
- Dated documentation does not guarantee current queue availability.
- A generated script is a proposal until reviewed and checked with `bash -n` and `sbatch --test-only`.
- SolMate does not collect SSH credentials or execute cluster commands.
- Unsupported diagnosis evidence returns an inconclusive result.

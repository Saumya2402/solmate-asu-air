# Failure Diagnosis Hardening Plan

## Objective

Turn the failure tab into a dependable, ASU AIR-assisted after-hours triage workflow for Sol and Phoenix researchers while keeping deterministic evidence validation authoritative.

## Sources checked

- `AGENTS.md`
- `plans/plan_asu_docs_outcome_learning_20260903.md`
- `diary/20260903_1747_live-docs-acceptance.md`
- Existing diagnosis source, API, UI, fixtures, and tests
- ASU RC Docs pages for SBATCH scripts, job states, job statistics, helpful Slurm commands, partitions and QoS, and getting help

## Scope amendment

The previous documentation-grounding plan established the knowledge layer but did not define a complete failure-evidence workflow. This amendment adds guided command generation, documented failure classes, deterministic triage disposition, and a larger validation matrix.

## Implementation

1. Add a deterministic evidence-collection helper that validates a numeric job ID and returns one-line, copyable commands appropriate to submission, pending/running, or finished jobs. Commands are displayed only and are never executed.
2. Extend the curated ASU RC knowledge with support guidance and documented script-format, account/QoS, execution-permission, and storage-quota failure rules.
3. Extend deterministic diagnosis with metadata corroboration, safe `UNKNOWN` handling, category-specific next actions, and a disposition of `user_action`, `monitor`, `support`, or `resolved`.
4. Add a compact collapsed evidence helper to the failure tab and render the disposition and collection commands with the diagnosis.
5. Expand sanitized fixtures and focused tests across recognized failures, controls, ambiguous evidence, redaction, command safety, API behavior, and UI contracts.
6. Run the full test suite, mock demo, syntax checks, and a sanitized live AIR diagnosis matrix when the live server has the updated code.

## Guardrails

- Do not connect to Sol, request credentials, execute shell commands, or submit/cancel/update jobs.
- Do not send or persist the job ID; it is used only to construct local display commands.
- Do not infer a root cause from an exit code alone.
- Only ASU RC documentation-backed scheduler claims may be presented as cluster guidance.
- AIR output must cite exact supplied log lines or metadata and pass deterministic validation.
- Ambiguous or unsupported evidence must produce an inconclusive result, not an upstream error or fabricated diagnosis.

## Validation

- `npm test`
- `npm run demo:mock`
- `node --check src/diagnosis.mjs`
- `node --check src/failure_evidence.mjs`
- `node --check src/agent_harness.mjs`
- `node --check src/server.mjs`
- `node --check public/app.js`
- `git diff --check`
- Sanitized live AIR cases covering confirmed, probable, and inconclusive outcomes

## Remaining manual check

- Desktop and mobile visual inspection in the running browser.

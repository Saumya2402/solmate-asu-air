# Full Plan Code Audit

## Scope

Performed a strict implementation review against `plans/plan_live_air_compute_concierge_20260902.md`, `AGENTS.md`, the latest diary, current source, tests, fixtures, results, prior reviews, and current ASU RC scheduler/hardware documentation. No application code was changed.

## Key Results

- Found a critical Slurm directive-injection path through the unvalidated `account` property.
- Found a critical diagnosis privacy bypass: raw deterministic evidence and metadata are sent beside the redacted log.
- Proved that unsupported `sol/general/general` passes deterministic validation.
- Confirmed stale browser drafts can override newer AIR facts and suggestions.
- Identified ineffective critic rejection, client-asserted recommendation provenance, incomplete diagnosis/handoff UI contracts, missing cross-field hardware checks, orchestration inefficiency, and incomplete plan evidence.
- Saved the full review at `reviews/review_full-plan-code-audit_20260903.md`.

## Validation

- `npm test`: 55/55 passed.
- `node --check`: 23 JavaScript files passed.
- `npm run demo:mock`: passed.
- Secret scan: no API-key-like strings found.
- Live server health on port 4176: healthy and reports live mode.
- Adversarial account injection, scheduler-pair, and diagnosis-redaction probes reproduced review findings.
- Browser checks were unavailable because no controllable browser was connected.
- New live AIR calls were not run because the review shell had no AIR key; existing sanitized evidence was reviewed.
- Git diff/scope validation was unavailable because the workspace is not a Git repository.

## Decision

Compliance is partial and release is blocked pending the critical safety/privacy repairs. Fix safety and state integrity before adding pitch polish or more agent roles.

# Update Live AIR Plan

## Objective

Update the main implementation plan using the accepted findings from the live AIR critic review.

## Files read

- `AGENTS.md`
- `plans/plan_live_air_compute_concierge_20260902.md`
- `reviews/review_live_air_plan_20260902.md`
- `diary/20260902_2035_live-air-critic-review.md`
- Implementation Plan skill instructions

## Files changed

- Updated `plans/plan_live_air_compute_concierge_20260902.md`
- Added this diary entry

## Changes made

- Recorded successful `qwen3-coder-next` live connectivity and measured critic latency.
- Excluded the AIR-hosted `gpt-oss-120b` model pending diagnosis of its HTTP 400 responses.
- Added decisions accepted and rejected from the AIR critic review.
- Added exact diagnosis evidence matching rules.
- Restricted automatic repair to allowlisted changes on exact app-generated script/spec pairs.
- Added a credential and structured-JSON preflight command to the plan.
- Added per-role latency targets and hard timeouts.
- Time-boxed model benchmarking to 60 minutes and three candidates per role.
- Moved the encoding fix to the first UI edit and corrected its target to `public/app.js`.
- Expanded repair-safety, secret-redaction, filename, provenance, and latency validation.

## Commands and results

- Checked all required plan headings: passed.
- Checked critic-decision, evidence-contract, repair-contract, preflight, and latency markers: passed.
- Scanned the plan for known encoding corruption markers: passed.

## Unresolved issues

- User approval is required before implementation begins.
- Live preflight must confirm that the available user-level AIR credential is active.
- Structured JSON conformance remains the first live implementation test.

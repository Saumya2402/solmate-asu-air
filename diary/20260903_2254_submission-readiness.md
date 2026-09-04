# Submission Readiness Pass

## Objective

Turn the working `continued-development` branch into a clear public release candidate for judges, teammates, and first-time users.

## Cleanup

- Removed the tracked Spark kickoff and workshop decks because they are event-owned references, not SolMate deliverables.
- Removed the duplicate `team_handoff` draft set and its copied implementation plan.
- Preserved plans, diaries, reviews, fixtures, knowledge, tests, and sanitized results as the engineering audit trail.
- Reduced the tracked submission by approximately 29.6 MB plus redundant text.

## Documentation

- Rewrote `README.md` around the live prototype, capabilities, local mock use, live AIR use, demo flow, architecture, commands, deployment, evidence, limits, and repository map.
- Added `docs/DEMO_GUIDE.md` with a live-rehearsed workload, 90-second walkthrough, failure demo, guardrail moment, and recovery plan.
- Added `docs/ARCHITECTURE.md` with planning and diagnosis boundaries, runtime ownership, privacy, deployment, and trust limits.
- Added `docs/VALIDATION.md` with reproducible checks, accuracy contracts, current evidence, and approved claims.
- Added `docs/PITCH.md` with a 25-word submission description, positioning, differentiators, 90-second script, finalist structure, and judge questions.

## Configuration

- Made `AIR_API_KEY` and `AIR_BASE_URL` the preferred live configuration names.
- Kept existing environment compatibility in code so the running demo is not disrupted.
- Updated hosted startup to honor `HOST`, with `127.0.0.1` retained as the local default.
- Added a regression test for the AIR-named missing-key error.

## Validation

- `npm test`: 133/133 passed.
- `npm run demo:mock`: passed.
- `npm run validate:diagnosis` against isolated current mock API: 24/24 passed.
- `npm run build:pages`: passed.
- Source syntax, whitespace, ASCII, public-language, credentials, and relative Markdown link checks passed.
- Public Pages, Pages configuration, local API, and HTTPS API returned HTTP 200; API mode was live.
- Final workload prompt was run through live AIR. It recovered the intended ML type and every required planning field with no missing required values.

## Notes

- A stale server on port 4173 returned HTTP 405 during the first external diagnosis attempt. The current code was started on port 4191, where all 24 cases passed, then that temporary server was stopped.
- The temporary Pages API tunnel remains the primary operational risk. Check `LIVE AIR` immediately before the presentation and retain the local live URL plus a recording as fallbacks.

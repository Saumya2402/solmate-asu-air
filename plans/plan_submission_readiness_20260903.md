# Submission Readiness Plan

## Objective

Prepare the `continued-development` branch as the public SolMate release candidate without changing the frozen `main` backup.

## Scope

1. Remove event-owned binaries and duplicate teammate handoff drafts from the tracked repository.
2. Replace the public documentation path with a concise README plus demo, architecture, validation, and pitch guides.
3. Make AIR-named environment variables the preferred live configuration while retaining silent compatibility with existing local sessions.
4. Preserve implementation plans, diaries, reviews, fixtures, and sanitized result files as auditable engineering evidence.
5. Run the full automated suite, mock demo, Pages build, syntax checks, credential scan, link checks, and a live health check.
6. Record an implementation review, commit the release candidate, push `continued-development`, deploy Pages, and verify the public site.

## Non-goals

- Do not merge or rewrite `main`.
- Do not add credentials, raw prompts, raw model responses, or private cluster data.
- Do not claim autonomous submission, universal diagnosis, account entitlement, or guaranteed job success.
- Do not stop the running local AIR service or its HTTPS tunnel.

## Acceptance

- A first-time evaluator can find the live demo, local setup, demo script, architecture, AIR role map, safety boundaries, validation evidence, and pitch language from the README.
- The preferred setup uses `AIR_API_KEY` and `AIR_BASE_URL`.
- No tracked event decks, duplicate handoff package, credentials, or third-party-model marketing language remain.
- All tests and release checks pass, and GitHub Pages reports live AIR connectivity after deployment.

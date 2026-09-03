# Implement SolMate

## Objective

Implement the approved guided planning, Sol handoff, and failure-forensics plan using ASU AIR-hosted inference and deterministic safety gates.

## Files changed

- Updated `AGENTS.md`, `README.md`, `.env.example`, `package.json`, and the active implementation plan.
- Hardened `src/air_client.mjs` and replaced the agent harness and mock gateway contracts.
- Expanded `src/job_spec.mjs` with complete validation, Sol QoS checks, controlled rendering, exact-script comparison, and allowlisted repair.
- Added `src/intake.mjs`, `src/terminal_handoff.mjs`, and `src/diagnosis.mjs`.
- Reworked `src/server.mjs` into a testable server factory with four workflow endpoints and security headers.
- Rebuilt the operational UI in `public/index.html`, `public/app.js`, and `public/styles.css`.
- Added preflight, server launcher, benchmark, and full demo scripts.
- Added dated ASU rules, workload/failure fixtures, sanitized model evidence, and expanded tests.

## Architecture decisions

- AIR performs interpretation, recommendation, critique, and diagnosis.
- Deterministic modules own completeness, resource limits, policy checks, script rendering, evidence matching, repair authorization, redaction, and terminal commands.
- Unknown values remain unfilled; recommended values require user confirmation.
- The app stores no prompts/logs and never receives Sol credentials or executes generated commands.
- Automatic repair requires a confirmed diagnosis, an exact app-generated script/spec pair, and an allowlisted structured patch.

## Commands run

- `node --check` across JavaScript and MJS sources.
- `npm test` repeatedly during implementation.
- `npm run demo:mock`.
- `npm run preflight:live` with the user-level key loaded without printing it.
- `npm run demo:live` against selected AIR candidates.
- HTTP smoke tests against mock and live server modes.

## AIR results

- `qwen3-coder-next`: structured preflight passed in 1,143 ms; richer intake timed out at 45 seconds.
- `north-mini-code`: structured preflight passed in 939 ms; bounded intake returned empty assistant content.
- `qwen3-coder-30b-a3b-instruct`: complete planner/critic/diagnostician run passed in 6,951/2,928/8,864 ms.
- A later explicit-facts intake passed in 8,710 ms and a vague training intake returned four editable recommendations in 5,587 ms.
- Sanitized evidence is stored in `results/results_air_model_benchmark_20260902_2210.json`.

## Validation results

- 32 automated tests pass with zero failures or skips.
- Mock three-role demo passes.
- Live AIR structured preflight and full three-role demo pass with `qwen3-coder-30b-a3b-instruct`.
- HTTP health, intake, generation, handoff, diagnosis, content-type, and static-page checks pass.
- JSON parsing for all knowledge and fixture files passes.
- Source syntax, secret, and encoding scans pass.
- The current mock server is available at `http://127.0.0.1:4174` because port 4173 was already occupied.

## Remaining issues

- Browser-based screenshot and responsive visual QA could not run because no browser connection was available in this session.
- `sbatch --test-only` requires the user to connect to Sol through VPN and has not been executed by the application.
- The active AIR credential should pass live preflight before judging.
- No real cluster job was submitted, by design.

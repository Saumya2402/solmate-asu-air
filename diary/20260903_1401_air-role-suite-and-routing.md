# AIR Role Suite and Routing

## Objective

Run a bounded benchmark across the remaining AIR roles, apply only measured model assignments, and leave the live tool ready for user retesting.

## Files Read

- `AGENTS.md`
- `plans/plan_parallel_air_role_routing_20260903.md`
- `diary/20260903_1338_time-normalization-and-role-benchmark.md`
- `src/agent_harness.mjs`
- `src/air_client.mjs`
- `src/intake.mjs`
- `src/diagnosis.mjs`
- `src/newcomer_guidance.mjs`
- `knowledge/asu_rc_rules.json`

## Files Changed

- `src/agent_harness.mjs`
- `src/model_router.mjs`
- `scripts/role_suite_benchmark.mjs`
- `tests/test_agent_harness.mjs`
- `tests/test_model_router.mjs`
- `package.json`
- `.env.example`
- `README.md`
- `plans/plan_parallel_air_role_routing_20260903.md`
- `results/results_air_role_suite_20260903_205632.json`

## Commands Run

- `npm run benchmark:role-suite`
- `npm test`
- `node --check` across all JavaScript files
- `npm run demo:mock`
- Live `GET /api/health`
- Two sanitized live `POST /api/intake` replays

## Results

- The nine-role suite completed 30 calls in 85.0 seconds with concurrency four and an 18-second cutoff.
- Qwen 3 Instruct passed the fast typo, scheduler, and completion fixtures and retained its prior extractor lead.
- Qwen Coder remained the proven default for planning, fact audit, shared criticism, diagnosis, and explanation.
- Live extraction recovered the job name and all supplied numeric/path facts, normalized 5000 minutes to `83:20:00`, and selected Sol `public/public` when Sol was explicit.
- A live invented-module recommendation was found and blocked deterministically.
- The live application was restarted at `http://127.0.0.1:4176` with the measured role assignments.

## Validation

- Final full test suite: 92/92 passed.
- Focused harness suite after the completion guard: 25/25 passed.
- Syntax check: 36 JavaScript files passed.
- Mock demo: passed.
- Secret-pattern scan: no key-shaped strings found outside excluded local secret files.

## Remaining Issues

- The planner still dominates live latency and reached 32.8 seconds in the final replay; progressive Wave 1/Wave 2 delivery is not implemented yet.
- No resource-critic candidate passed every rapid-suite check.
- The suite is a rapid screening matrix, not a statistically strong multi-run evaluation.
- This workspace has no Git metadata, so repository diff/status checks are unavailable.

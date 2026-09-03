# Time Normalization and Role Benchmark

## Report

The follow-up phrase `total training time is around 5000 minutes` reached the Walltime field as the invalid raw value `5000`, causing generation to stop on the canonical-format validator. The approved parallel AIR routing plan also required its first role-specific benchmark.

## Root Cause

- AIR fact validation required canonical walltime but did not derive that canonical value from otherwise valid quoted duration evidence.
- The deterministic intake fallback recognized hours only.
- Direct Walltime form values were validated without a shared natural-duration normalization step.
- The existing benchmark exercised every role through one model rather than comparing candidates on one role under intended concurrency.

## Fix

- Added one deterministic duration parser for canonical time, days, hours, minutes, seconds, decimals, combined durations, and latest-correction precedence.
- Canonicalized AIR walltime evidence independently of the model's returned formatting.
- Added a deterministic live-harness fallback so an omitted or raw AIR walltime still uses exact transcript evidence.
- Normalized direct duration entries before ready-spec validation while keeping bare numbers ambiguous.
- Added a bounded parallel fact-extractor benchmark with sanitized fixtures, strict evidence validation, latency summaries, and collision-resistant result names.

## Validation

- `npm test`: 89/89 passed with zero skipped.
- Focused intake and harness tests: 44/44 passed.
- Live AIR intake returned `83:20:00`, cited `5000 minutes`, and removed Walltime from the missing-field list.
- Two retained role benchmark artifacts compare Qwen, GLM, Llama, and Gemma candidates.
- `qwen3-30b-a3b-instruct-2507` led the tested extractor candidates with 100 percent schema validity and 95.65 percent field recall in both retained runs.
- The runtime model assignment was not changed.

## Files Changed

- `src/intake.mjs`
- `src/agent_harness.mjs`
- `scripts/role_model_benchmark.mjs`
- `tests/test_intake.mjs`
- `tests/test_agent_harness.mjs`
- `package.json`
- `README.md`
- `plans/plan_parallel_air_role_routing_20260903.md`
- `results/results_air_role_benchmark_20260903_2035.json`
- `results/results_air_role_benchmark_20260903_203653.json`
- `results/results_time_normalization_and_role_benchmark_20260903.json`

## Commands Run

- `node --check src/intake.mjs`
- `node --check src/agent_harness.mjs`
- `node --check scripts/role_model_benchmark.mjs`
- `node --test tests/test_intake.mjs tests/test_agent_harness.mjs`
- `npm test`
- `npm run benchmark:roles`
- Live `POST /api/intake` with a sanitized 5000-minute fixture

## Remaining Work

- Expand the benchmark fixture count before changing the production extractor model.
- Benchmark workflow classification, scheduler advice, scientific planning, risk challenge, code criticism, and diagnosis separately.
- Implement routing, consensus, and progressive response modules only after role winners are measured.

# Parallel AIR Role Routing Plan

## Objective

Reduce SolMate's perceived and end-to-end AIR latency while improving extraction, recommendation, review, and diagnosis accuracy through a measured, role-specific parallel agent graph with deterministic merge gates.

## Sources checked

- `AGENTS.md`
- `plans/plan_live_air_compute_concierge_20260902.md`
- `diary/20260903_1307_followup-scheduler-recommendations.md`
- `src/agent_harness.mjs`
- `src/air_client.mjs`
- `scripts/model_benchmark.mjs`
- `.env.example`
- `results/results_air_model_benchmark_20260902_2210.json`
- `results/results_remediation_validation_20260903.json`
- `results/results_newcomer_features_20260903.json`
- Live `GET https://openai.rc.asu.edu/v1/models` response on 2026-09-03
- ASU RC LLM API documentation: `https://docs.rc.asu.edu/ai/api/`
- Qwen model card: `https://huggingface.co/Qwen/Qwen3-235B-A22B-Instruct-2507`

## Current evidence

- The current intake starts extractor, planner, fact auditor, typo reviewer, completion advisor, and scheduler advisor concurrently, but all default to `qwen3-coder-30b-a3b-instruct`.
- The planner currently sees the raw transcript before verified extraction is complete, so concurrency saves time at the cost of duplicated interpretation and possible disagreement.
- The resource critic runs after every recommendation and can extend the critical path or return malformed JSON.
- `qwen3-coder-30b-a3b-instruct` is the only candidate that passed the existing full planner/critic/diagnostician compatibility probe.
- Measured Qwen Coder 30B calls vary substantially: planning has ranged from about 7 to 26 seconds, while critic and diagnosis calls have sometimes completed in about 3 seconds.
- `qwen3-coder-next` passed a small structured preflight but timed out on the earlier full intake.
- `north-mini-code` returned empty content during the earlier bounded intake.
- The AIR-hosted `gpt-oss-120b` model returned HTTP 400 in prior probes and remains excluded pending compatibility diagnosis.
- Later Qwen Coder critic calls have produced schema-invalid or internally inconsistent reviews, so one model should not be treated as an independent consensus.
- AIR currently exposes multiple candidate families, including Qwen, GLM, Llama, Gemma, Devstral, MiniMax, and coding-specific models.

## Assumptions / unknowns

- Generous token availability does not imply unlimited concurrent throughput, fixed latency, or exemption from HTTP 429 rate limiting.
- Multiple API keys must not be used to bypass provider limits. One server-side key is sufficient for normal parallel requests and is easier to secure and audit.
- AIR deployment performance can differ from public model-card results; every role assignment requires an AIR endpoint benchmark.
- Model names suggest likely specialization but do not prove JSON adherence, scientific accuracy, or latency on AIR.
- Thinking models may be slower and may emit reasoning wrappers that complicate strict JSON parsing. They should remain outside the default interactive path until measured.
- The app can show progressive results without weakening completeness, confirmation, or deterministic validation requirements.
- Accuracy means fixture correctness, exact evidence validity, unsupported-claim rate, and successful deterministic validation, not subjective eloquence.

## Scope

### Target agent graph

#### Wave 0: deterministic preflight, target under 20 ms

- Normalize the transcript and recover signed prior state.
- Extract unambiguous job-name phrases, numeric forms, and explicit paths using existing deterministic rules.
- Select applicable dated Sol/Phoenix profiles.
- Reject unsafe magnitudes and malformed input before spending AIR calls.

#### Wave 1: diverse fast interpretation, hard deadline determined by benchmark

Run with `Promise.allSettled` and independent abort timers:

1. Primary fact extractor: every explicit field plus exact evidence quote.
2. Independent fact auditor from a different model family: omissions, singular quantities, corrections, MPI semantics, and latest-value precedence.
3. Typo/software recognizer: correction candidates only.
4. Workflow classifier: workload type, software, and the next highest-information question.

Merge immediately after the minimum valid quorum is available. A fact is accepted only when its quote exists in the transcript and deterministic type/value checks pass. Model voting never overrides exact evidence.

#### Wave 2: independent advice from one validated fact packet

After Wave 1 merge, run these concurrently:

1. Scientific planner: resource profile or a targeted follow-up question.
2. Scheduler advisor: choose only from the supplied exact profile list.
3. Completion advisor: safe job/log conventions and executable structure.
4. Risk challenger from a different model family: independently identify unsupported assumptions, conflicts, and measurements needed.

The risk challenger should not review prose from the planner. Both receive the same validated facts and policies, reducing anchoring and allowing deterministic comparison.

#### Wave 3: deterministic merge and first response

- Intersect or reconcile planner and challenger claims by field.
- Accept scheduler values only as an exact dated profile pair.
- Convert disagreements into a question or conservative profiling recommendation.
- Sign every surviving recommendation.
- Return the usable intake result without waiting for optional deep analysis.

#### Wave 4: asynchronous enrichment

Run only when relevant and update the UI progressively:

- Deep resource review for high-cost, distributed, GPU, or contradictory workloads.
- Script critic and script explainer concurrently after deterministic script rendering.
- Deep diagnosis only when deterministic findings are ambiguous or multiple causes remain.
- Thinking models only behind a user-visible `Deep review` action or automatic high-risk trigger.

### Provisional model portfolio to benchmark

These are candidates, not final assignments:

| Role | Primary candidate | Diverse comparison | Current fallback |
|---|---|---|---|
| Fact extractor | `glm-5-3-flash` | `qwen3-30b-a3b-instruct-2507` | `qwen3-coder-30b-a3b-instruct` |
| Fact auditor | `llama4-scout-17b` | `gemma4-31b-it` | `qwen3-coder-30b-a3b-instruct` |
| Typo/software recognition | `gemma4-31b-it` | `glm-5-3-flash` | `qwen3-coder-30b-a3b-instruct` |
| Workflow classification | `qwen3-30b-a3b-instruct-2507` | `glm-5-3-flash` | `qwen3-coder-30b-a3b-instruct` |
| Scientific planner | `qwen3-235b-a22b-instruct-2507` | `glm-5-3` | `qwen3-coder-30b-a3b-instruct` |
| Scheduler advisor | `qwen3-30b-a3b-instruct-2507` | `glm-5-3-flash` | `qwen3-coder-30b-a3b-instruct` |
| Completion advisor | `qwen3-coder-30b-a3b-instruct` | `qwen3-30b-a3b-instruct-2507` | deterministic conventions |
| Risk challenger | `glm-5-3` | `qwen3-235b-a22b-instruct-2507` | conservative withholding |
| Slurm/code critic | `devstral2-123b` | `qwen3-coder-next` | `qwen3-coder-30b-a3b-instruct` |
| Failure diagnostician | `qwen3-235b-a22b-instruct-2507` | `glm-5-3` | `qwen3-coder-30b-a3b-instruct` |
| Script explainer | `qwen3-coder-30b-a3b-instruct` | `glm-5-3-flash` | deterministic explanation |
| Optional deep review | `qwen3-235b-a22b-thinking-2507` | `qwen3-30b-a3b-thinking-2507` | no deep review |

No candidate becomes the default from its name or size. The winner for each role must meet the role's measured quality threshold and latency budget.

### Routing rules

- General/simple request: fast Wave 1 plus small Wave 2 models.
- Explicit complete request: skip unnecessary completion and follow-up agents.
- Missing scientific scale: ask one question before running the large planner.
- GPU, multi-node, high-memory, or contradictory request: run the large planner and diverse risk challenger.
- Known deterministic scheduler choice: AIR explains/recommends, but code validates and can render options immediately.
- Recognizable failure with corroborating metadata: use a fast diagnostician; invoke deep diagnosis only for ambiguity.
- Model timeout or invalid schema: keep other valid agent outputs; never erase the complete result set.
- Repeated request with unchanged signed facts: cache sanitized role outputs by transcript hash and rules version for the browser session only.

### Latency strategy

- Use one shared request deadline plus shorter per-agent deadlines.
- Do not retry every failed optional model. Retry only required roles once with the validated fallback.
- Use hedged fallback calls only after a measured delay and only for a required role, then cancel the loser.
- Return progressive status events when Wave 1, Wave 2, validation, and optional review finish.
- Use the existing deterministic renderer immediately after validation; script explanation and critique must not delay display.
- Cap active AIR calls per user request and queue surplus optional calls to avoid a self-inflicted 429 burst.

## Out of scope

- Generating many API keys to evade rate or concurrency controls.
- Calling every available AIR model on every request.
- Training or fine-tuning models during the hackathon.
- Letting a model execute Slurm, shell, SSH, or cluster commands.
- Replacing deterministic policy, evidence, schema, token, or shell-safety checks with model consensus.
- Claiming a model is best from public benchmarks without AIR endpoint evidence.

## Implementation steps

1. Extend `scripts/model_benchmark.mjs` into a role-specific benchmark that tests each candidate only on its intended schema and fixture set.
2. Record p50, p95, timeout rate, empty-response rate, schema pass rate, fixture accuracy, exact-evidence rate, unsupported-claim rate, and estimated critical-path latency.
3. Select the fastest model meeting each role's quality floor; retain Qwen Coder 30B as fallback until another model passes.
4. Add `src/model_router.mjs` for role assignments, risk routing, deadlines, fallback order, and concurrency caps.
5. Add `src/agent_graph.mjs` for Wave 0-4 orchestration using `Promise.allSettled`, abort propagation, and partial-result isolation.
6. Add `src/consensus.mjs` for evidence-backed fact merge, independent recommendation comparison, disagreement handling, and provenance.
7. Refactor `AgentHarness.intake()` to consume the graph without changing its validated response contract.
8. Split the current monolithic resource critic into an independent Wave 2 challenger and an optional post-response deep review.
9. Keep `/api/intake` compatible and add `/api/intake/stream` using server-sent events for progressive phase/model status and partial validated results.
10. Update `public/app.js` to render phase completion without duplicating recommendations or enabling generation before the final signed state.
11. Run the selected models through five workload fixtures, five failure fixtures, malformed-output cases, and three live golden-path repetitions.
12. Update `.env.example`, README, benchmark artifacts, and diary only after measured assignments are selected.

## Exact files likely to change

- `src/agent_harness.mjs`
- `src/air_client.mjs`
- `src/server.mjs`
- `src/model_router.mjs` (new)
- `src/agent_graph.mjs` (new)
- `src/consensus.mjs` (new)
- `public/app.js`
- `public/index.html`
- `.env.example`
- `scripts/model_benchmark.mjs`
- `fixtures/workload_cases.json`
- `fixtures/failure_cases.json`
- `tests/test_agent_harness.mjs`
- `tests/test_air_client.mjs`
- `tests/test_server.mjs`
- `tests/test_intake.mjs`
- `tests/test_diagnosis.mjs`
- `tests/test_ui_contract.mjs`
- `README.md`

## Validation plan

### Benchmark gates

- Fast extraction roles: at least 98 percent schema pass, 100 percent evidence validity, at least 95 percent fixture-field recall, p95 within the selected interactive budget.
- Planner: 100 percent schema pass after at most one bounded repair, no invented explicit facts, and all resource recommendations accompanied by assumptions and measurement advice.
- Scheduler: 100 percent exact supported-pair validity and zero entitlement claims.
- Risk challenger: catch every seeded contradiction with no critical false policy claims.
- Diagnostician: expected category on every seeded case, exact evidence validation, and no unsafe repair.
- A larger model wins only when its measured quality improvement justifies its added critical-path latency.

### Automated commands

- `npm test`
- `node --check` for all JavaScript and ES modules
- `npm run demo:mock`
- Role-specific live benchmark with sanitized fixtures
- Three sequential live golden-path runs
- Secret-pattern scan

### Concurrency and failure cases

- One optional agent times out while required agents succeed.
- Primary extractor fails and fallback succeeds.
- Two extractors disagree on a quoted value.
- Planner and challenger disagree on GPU or memory.
- AIR returns HTTP 429 under a synthetic concurrency cap test.
- Client disconnect aborts outstanding work.
- A stale streamed event cannot replace a newer intake result.
- Optional review cannot erase valid scheduler recommendations.

### Expected measured outcome

- First meaningful interpretation appears as soon as Wave 1 validates.
- The signed recommendation result is faster than the current all-Qwen critical path at p50 and p95.
- Optional explanation/review does not block script display.
- Accuracy is equal to or better than the current fixture baseline with fewer schema-invalid critical failures.

## What must not change

- AIR remains the only application inference provider.
- API keys remain server-side and absent from logs, responses, browser code, and artifacts.
- Generated Slurm and shell commands are never executed by the app.
- Deterministic evidence, scheduler, plausibility, confirmation, rendering, and repair gates remain authoritative.
- Mock mode and existing HTTP endpoints remain available.
- No partial streamed result may be labeled ready or enable generation before final validation and signing.

## Expected outputs

- `plans/plan_parallel_air_role_routing_20260903.md`
- Role benchmark artifact under `results/`
- Measured model assignment table in README
- New routing, graph, and consensus modules
- Progressive intake endpoint and UI
- Expanded concurrency, timeout, disagreement, and streaming tests
- Timestamped implementation diary entry

## Risks

- Too much fan-out can increase 429s and worsen latency; enforce per-request and process-wide concurrency caps.
- Larger models can dominate the critical path; route them only to high-risk cases or asynchronous review.
- Cross-model disagreement can confuse users; turn unresolved disagreement into one focused question.
- Streaming adds stale-event and cancellation complexity; bind every event to a request sequence.
- Public model descriptions may not match AIR deployment behavior; benchmark on the actual endpoint.
- A 24-hour build can be consumed by exhaustive benchmarking; benchmark no more than two new candidates plus the fallback per role and stop once a candidate clears the gate.

## Approval gate

Do not implement the graph or change default model assignments until the user approves this plan. The first implementation task is the role-specific benchmark, not the routing refactor.

## Initial benchmark evidence - 2026-09-03

- Implemented a bounded fact-extractor benchmark that runs three candidate models concurrently per sanitized fixture.
- `qwen3-30b-a3b-instruct-2507` produced schema-valid output in all six retained cases across two runs, achieved 95.65 percent validated field recall in each run, and had retained-run p95 latencies of about 1.5 and 6.5 seconds.
- Its recurring miss was the `as job of13` phrase. Wave 0 already recognizes that exact job-name pattern deterministically, so this is complementary rather than silently accepted model failure.
- `qwen3-coder-30b-a3b-instruct` achieved 91.30 percent field recall at about 3.5-3.6 seconds in the retained comparison.
- `glm-5-3-flash` timed out in one case and achieved 56.52 percent aggregate field recall in the retained comparison; it is rejected as the primary extractor for now.
- `llama4-scout-17b` achieved 69.57 percent field recall and repeatedly missed job name, cluster, or path fields.
- `gemma4-31b-it` achieved 82.61 percent field recall and repeatedly missed job names.
- The evidence supports `qwen3-30b-a3b-instruct-2507` as the leading Wave 1 extractor candidate, but the runtime default remains unchanged until the routing implementation and a larger repeat set pass.
- Artifacts: `results/results_air_role_benchmark_20260903_2035.json` and `results/results_air_role_benchmark_20260903_203653.json`.

## Rapid role-suite evidence - 2026-09-03

- Ran 30 AIR calls across nine roles with a global concurrency cap of four, no retries, and an 18-second interactive cutoff. The complete pass took 85.0 seconds.
- `qwen3-30b-a3b-instruct-2507` passed typo review in 0.89 seconds, scheduler selection in 0.44 seconds, and completion advice in 1.75 seconds. Together with the earlier extractor evidence, these four roles now use it by default.
- `qwen3-coder-30b-a3b-instruct` remained the only passing scientific planner and script explainer, and it was the only diagnostician to produce schema-valid results for both seeded failures. These accuracy-sensitive roles remain on the existing model.
- `devstral2-123b` caught the seeded Slurm CPU mismatch in 8.47 seconds, but the shared production critic also reviews scientific recommendations. One isolated code-critic pass is insufficient to replace that shared default.
- `qwen3-235b-a22b-instruct-2507`, `glm-5-3`, `qwen3-coder-next`, `qwen35-27b`, and the Devstral explanation call repeatedly exceeded the interactive cutoff in tested roles.
- No resource-critic candidate cleared every seeded check. Production therefore retains Qwen Coder with deterministic withholding and profiling gates rather than treating a benchmark loss as permission to accept unsupported advice.
- A live routed replay correctly extracted `imagev3`, `/scratch/demo/images`, 8 CPUs, one GPU, 64 GB, 1000 epochs, and converted 5000 minutes to `83:20:00`. It selected the supported Sol `public/public` pair. The slowest planner call was 32.8 seconds, confirming that progressive delivery remains the next latency priority.
- The live replay exposed an invented `pytorch` module suggestion. Completion validation now accepts only an empty module recommendation when the user did not explicitly provide modules.
- Artifact: `results/results_air_role_suite_20260903_205632.json`.

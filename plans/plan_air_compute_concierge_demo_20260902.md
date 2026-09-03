# AIR Compute Concierge Demo Plan

## Objective

Create a small working demo that uses ASU AIR models through an agentic harness to turn a workload description into a reviewed, deterministically validated Slurm script.

## Sources checked

- `ASU AIR Spark Kick Off Slides (in progress).pptx`
- `Spark Challenge Prep Workshop Deck.pdf`
- `reviews/review_hackathon-idea-options_20260902.md`
- ASU RC LLM API documentation and VS Code BYOK documentation
- No existing `AGENTS.md`, application code, tests, plans, or diary entries were present.

## Assumptions / unknowns

- The AIR endpoint remains `https://openai.rc.asu.edu/v1/chat/completions`.
- AIR-hosted model IDs currently available include `qwen3-coder-next`, `devstral2-123b`, and `gpt-oss-120b`.
- The API supports ordinary Chat Completions requests; strict JSON response-format support is not assumed.
- No AIR API credential is available to the current automation process, so live validation may require the user to run one command in a terminal where an active key is set.
- Exact Sol partitions, limits, and module names are not assumed. Demo policies will be clearly labeled examples.

## Scope

- Dependency-free Node.js service and static browser UI.
- AIR client with timeout, one retry for transient failures, and safe errors.
- Configurable planner and critic agent roles using separate AIR-hosted models.
- JSON extraction, schema-like deterministic validation, and controlled Slurm rendering.
- Mock mode for reliable local demonstration and tests.
- Live mode using `OPENAI_API_KEY` and optional model environment variables.
- Sample workload and visible validation/review results.
- `AGENTS.md`, README, environment example, tests, and diary entry.

## Out of scope

- Submitting or monitoring real cluster jobs.
- Claiming exact ASU partition/module policy without authoritative machine-readable data.
- Executing generated shell code.
- Authentication, persistence, multi-user hosting, embeddings, or RAG.
- Calling every available AIR model. Roles remain configurable so models can be benchmarked intentionally.
- VS Code BYOK configuration, which is optional for application runtime.

## Implementation steps

1. Add repository instructions, package metadata, ignore rules, and environment example.
2. Implement AIR API client and model-role configuration.
3. Implement structured job-spec parsing, validation, and Slurm rendering.
4. Implement planner/critic orchestration with live and mock gateways.
5. Add HTTP API and static UI for the vertical-slice workflow.
6. Add unit and integration tests plus mock/live demo scripts.
7. Run tests, run the mock demo, launch the UI, and smoke-test its API.
8. Attempt a live AIR demo only if a key is available without exposing it.
9. Record results and unresolved items in a new diary entry.

## Validation plan

- `npm test`: parsing, validation, rendering, and harness integration.
- `npm run demo:mock`: complete agentic flow without credentials.
- Start server and request `/api/health` and `/api/generate` in mock mode.
- `npm run demo:live`: required final live check when `OPENAI_API_KEY` is available.
- Confirm no secret-like values are present in tracked project files.

## Expected outputs

- `AGENTS.md`
- `README.md`
- `.gitignore`
- `.env.example`
- `package.json`
- `src/air_client.mjs`
- `src/job_spec.mjs`
- `src/agent_harness.mjs`
- `src/mock_gateway.mjs`
- `src/server.mjs`
- `public/index.html`
- `public/styles.css`
- `public/app.js`
- `scripts/demo_run.mjs`
- `tests/test_job_spec.mjs`
- `tests/test_agent_harness.mjs`
- `diary/20260902_<time>_air-compute-concierge-demo.md`

## Risks

- AIR models may wrap JSON in prose or code fences; extraction must be defensive.
- Large critic models may be slow; role models must be replaceable through environment variables.
- Mock success does not prove live API compatibility; live preflight remains mandatory.
- Generated scripts are examples until validated against current ASU RC scheduler documentation.

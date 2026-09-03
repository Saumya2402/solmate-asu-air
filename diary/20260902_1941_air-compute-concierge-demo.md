# AIR Compute Concierge Demo

## Objective

Create a working vertical slice with an AIR-compatible planner/critic harness, deterministic Slurm validation and rendering, a browser UI, tests, and project operating instructions.

## Files read

- `ASU AIR Spark Kick Off Slides (in progress).pptx`
- `Spark Challenge Prep Workshop Deck.pdf`
- `reviews/review_hackathon-idea-options_20260902.md`
- ASU RC LLM API and VS Code BYOK documentation

## Files changed

- `AGENTS.md`
- `.gitignore`
- `.env.example`
- `package.json`
- `README.md`
- `plans/plan_air_compute_concierge_demo_20260902.md`
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
- This diary entry

## Commands and results

- `npm test`: passed 8/8 tests after correcting `.mjs` test discovery.
- `npm run demo:mock`: passed; planner, validator, renderer, and critic completed.
- Started `npm start` with `AIR_MODE=mock` on `http://127.0.0.1:4173`.
- HTTP smoke test of `/api/health` and `/api/generate`: passed.
- `node --check` over JavaScript and MJS files: passed.
- Secret-pattern scan over project text files: passed.
- Browser screenshot validation: not run; no connected browser was available.
- `npm run demo:live`: not run; `OPENAI_API_KEY` was not available to this process.

## Unresolved issues

- Rotate the previously exposed key, set it in the current terminal, and run the live AIR demo.
- Visually inspect desktop and mobile layouts in a browser.
- Verify any real partition, module, and resource-limit claims against current ASU RC documentation before presenting them as policy.
- Add failure-log diagnosis only after the live planner/critic flow is verified.

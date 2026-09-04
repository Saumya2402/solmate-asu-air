# ASU RC Docs Grounding and Outcome Learning

## Objective

Implement the mentor-requested ASU RC Docs knowledge layer, outcome feedback loop, contextual beginner tools, and plain-language scheduler controls.

## Scope decision

- Added a curated, dated documentation catalog instead of a runtime crawler.
- Implemented outcome-informed recommendations, not model training or reinforcement learning.
- Browser feedback contains only an allowlisted resource/outcome profile and never stores raw descriptions, scripts, paths, logs, job names, notes, or credentials.
- Documentation and local outcomes remain advisory and cannot bypass deterministic validation.

## Files changed

- `plans/plan_asu_docs_outcome_learning_20260903.md`
- `knowledge/asu_rc_rules.json`
- `src/knowledge.mjs`
- `src/outcome_feedback.mjs`
- `src/agent_harness.mjs`
- `src/newcomer_guidance.mjs`
- `src/server.mjs`
- `public/index.html`
- `public/app.js`
- `public/styles.css`
- `tests/test_knowledge.mjs`
- `tests/test_outcome_feedback.mjs`
- `tests/test_newcomer_guidance.mjs`
- `tests/test_server.mjs`
- `tests/test_ui_contract.mjs`
- `README.md`

## Implementation notes

- Deterministic retrieval selects up to four relevant, validated `docs.rc.asu.edu` entries for intake, generation, or diagnosis.
- AIR planner, completion, scheduler, resource critic, script critic, explainer, and diagnostician inputs now receive the selected documentation where relevant.
- Intake, generation, and diagnosis responses expose the selected sources for direct UI links.
- Reviewed jobs now suggest ASU commands including `myjobs`, `seff`, `myaccounts`, `myquota`, and `module spider` based on the job context.
- Python jobs receive the ASU-specific warning that pip belongs inside an activated mamba environment.
- Partition and QoS controls now read `Hardware queue (partition)` and `Run policy (QoS)` and show short option meanings from the knowledge file.
- The Run view records one of four outcomes. At most 12 sanitized profiles are stored in browser local storage and included as unverified advisory context in later AIR planning.
- Client and server both sanitize outcome records. Unknown properties are removed before transmission and again at the HTTP boundary.

## Commands run

- JavaScript syntax checks for all changed modules and browser code
- `npm test`
- `npm run demo:mock`
- `git diff --check`
- Secret-pattern scan for unmasked `sk-` values
- Local `GET /api/health` check on port 4178

## Results

- Initial suite: 101 passed, 1 expected rules-version assertion failed.
- Updated suite: 108 passed, 0 failed.
- Mock intake, generation, handoff, and diagnosis demo passed.
- All syntax checks passed.
- `git diff --check` passed.
- Secret-pattern scan found no matches.
- Health endpoint returned rules version `2026-09-03`, nine scheduler profiles, and both beginner glossary definitions.

## Remaining work

- A live AIR replay was not run because `OPENAI_API_KEY` was not available to this process.
- The browser connection was unavailable, so desktop/mobile viewport inspection remains manual.
- The documentation catalog is intentionally curated, not a complete mirror of every ASU RC Docs page. New workflows should add reviewed entries rather than let AIR browse arbitrary pages at runtime.

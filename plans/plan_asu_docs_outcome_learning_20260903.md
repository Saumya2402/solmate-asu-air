# ASU RC Docs Grounding and Outcome Learning Plan

## Objective

Make ASU Research Computing documentation the authoritative knowledge layer for SolMate, add a privacy-preserving outcome feedback loop, and teach first-time Slurm users with contextual tools and plain-language scheduler terminology.

## Sources checked

- `AGENTS.md`
- `plans/plan_parallel_air_role_routing_20260903.md`
- `diary/20260903_1650_accepted_suggestion_state.md`
- `knowledge/asu_rc_rules.json`
- `src/knowledge.mjs`
- `src/agent_harness.mjs`
- `src/newcomer_guidance.mjs`
- `src/server.mjs`
- `public/index.html`
- `public/app.js`
- `public/styles.css`
- Existing server, harness, newcomer, and UI contract tests
- ASU RC Docs: `https://docs.rc.asu.edu/`
- ASU RC Partitions and QoS: `https://docs.rc.asu.edu/partitions-and-qos/`
- ASU RC Helpful Slurm Commands: `https://docs.rc.asu.edu/helpful-slurm-commands/`
- ASU RC Job Statistics: `https://docs.rc.asu.edu/job-statistics/`
- ASU RC Available Software: `https://docs.rc.asu.edu/available-software/`
- ASU RC Python example: `https://docs.rc.asu.edu/python-example/`
- ASU RC Getting Started with AI: `https://docs.rc.asu.edu/ai/getting-started/`

## Assumptions / unknowns

- The 24-hour prototype should use a curated, versioned documentation snapshot rather than scrape the full documentation site during user requests.
- Documentation excerpts are treated as policy/context; AIR interpretation cannot introduce an uncited ASU-specific claim.
- User feedback is outcome context, not model-weight training or reinforcement learning.
- Feedback can be retained in browser local storage, but raw descriptions, scripts, paths, logs, job names, and credentials must not be stored.
- Feedback quality is user reported and therefore advisory; it cannot override deterministic scheduler or safety validation.
- The documentation site can change after the checked date, so every surfaced item must link to the original page.

## Scope

- Extend the dated knowledge file with a compact ASU RC documentation catalog, scheduler glossary, and user-facing option descriptions.
- Add deterministic retrieval that selects a small relevant documentation packet from workload, specification, or failure evidence.
- Supply the retrieved packet to AIR planning, completion, scheduler, critique, explanation, and diagnosis roles where relevant.
- Return the exact retrieved source titles and URLs for browser display.
- Add contextual ASU tool guidance to reviewed jobs, including monitoring, accounting, quota, module discovery, and Python environment guidance when applicable.
- Replace unexplained `Partition` and `QoS` labels/options with concise beginner-facing meanings sourced from the knowledge file.
- Add a compact generated-job outcome control. Store only sanitized outcome records in browser local storage and include a bounded history in later intake calls.
- Tell users when prior local outcomes informed a request without claiming that AIR was retrained.

## Out of scope

- Crawling or indexing every ASU RC Docs page at runtime.
- Vector databases, embeddings, external search services, or new dependencies.
- Fine-tuning, model-weight updates, online reinforcement learning, or automatic reward optimization.
- Persisting research descriptions, scripts, logs, paths, job names, cluster credentials, or API keys.
- Allowing feedback or AIR output to bypass deterministic validation.
- Automatically executing any suggested tool or Slurm command.

## Implementation steps

1. Extend `knowledge/asu_rc_rules.json` with checked documentation entries, glossary text, and scheduler option descriptions.
2. Add deterministic retrieval and public-source projection helpers in `src/knowledge.mjs`.
3. Thread retrieved documentation and sanitized prior outcomes through `src/server.mjs` and `src/agent_harness.mjs`.
4. Include retrieved citations in intake, generation, and diagnosis responses.
5. Add `buildToolGuidance` in `src/newcomer_guidance.mjs` and return its output with generated guidance.
6. Add compact UI sections for documentation grounding, contextual ASU tools, scheduler term help, and run outcomes.
7. Store only bounded sanitized outcome records in browser local storage and send them with future intake requests.
8. Update README architecture, privacy, API, and newcomer workflow descriptions.
9. Add focused knowledge, guidance, server, harness, and UI contract tests.
10. Record commands, results, and remaining manual checks in a timestamped diary entry.

## Validation plan

- `npm test`
- `node --check src/knowledge.mjs`
- `node --check src/newcomer_guidance.mjs`
- `node --check src/agent_harness.mjs`
- `node --check src/server.mjs`
- `node --check public/app.js`
- `npm run demo:mock`
- `git diff --check`
- Verify that retrieved source URLs are restricted to `https://docs.rc.asu.edu/`.
- Verify feedback limits, allowed outcomes, field allowlist, and omission of free text and sensitive identifiers.
- Verify Python guidance never recommends bare `pip` outside an activated mamba environment.
- Verify documentation context cannot create unsupported partition/QoS pairs.

## Expected outputs

- Updated `knowledge/asu_rc_rules.json`
- Updated `src/knowledge.mjs`
- Updated `src/agent_harness.mjs`
- Updated `src/newcomer_guidance.mjs`
- Updated `src/server.mjs`
- Updated `public/index.html`
- Updated `public/app.js`
- Updated `public/styles.css`
- Updated tests and `README.md`
- `diary/20260903_<time>_asu-docs-outcome-learning.md`

## Risks

- Stale copied claims could mislead users; keep the catalog small, dated, linked, and deterministically selected.
- Sending too much documentation can increase AIR latency; cap retrieval to a few concise entries.
- User-reported outcomes can be noisy; label them as local history and never treat them as policy or verified causality.
- Local storage can surprise users; disclose it beside the outcome control and store no raw research content.
- Additional teaching UI can recreate vertical crowding; use terse option labels and collapsed or compact controls.

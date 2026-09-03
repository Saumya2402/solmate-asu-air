# Strengthen AIR Scientific Intake

## Objective

Fix stale planner fields and make AIR perform visible, evidence-backed scientific workflow interpretation instead of only feeding a generic requirements form.

## Files changed

- `src/intake.mjs`: expanded the normalized intake schema, exact evidence handling, simulation classification, and unambiguous OpenFOAM/resource recognition.
- `src/agent_harness.mjs`: added the scientific-computing prompt contract, passed extraction evidence through validation, added OpenFOAM workflow questions, and blocked the ambiguous `general sol cluster` partition inference.
- `src/mock_gateway.mjs`: updated deterministic demo responses to the new semantic intake contract.
- `public/index.html`, `public/app.js`, `public/styles.css`: added debounced analysis, stale-state clearing, workflow summaries, software detection, conflicts, and domain questions.
- `tests/test_agent_harness.mjs`, `tests/test_intake.mjs`: added regression coverage for the exact OpenFOAM report.
- `scripts/openfoam_probe.mjs`, `package.json`: added a reproducible live AIR probe.
- `README.md`: documented the richer intake and probe command.

## Commands run

- `npm test`
- `npm run demo:mock`
- `node --check` across `src`, `public`, `scripts`, and `tests`
- `npm run probe:openfoam:live` with the user-level key loaded into the process without printing it

## Results

- 34 tests passed with zero failures or skips.
- Mock intake, critic, and diagnosis demo passed.
- Final syntax check passed for all 22 JavaScript and MJS files, and the key-pattern scan found no project files containing a likely API key.
- Live AIR used `qwen3-coder-30b-a3b-instruct` and detected OpenFOAM, simulation intent, Sol, `openfoam_v13_naca0012`, 1 CPU, 1 GPU, 32 GB, and two hours.
- Live AIR supplied exact evidence quotes, flagged GPU compatibility, and produced solver, case-directory, MPI, mesh-size, and partition-ambiguity questions.
- The first live run took 13,338 ms. The post-guardrail rerun took 466 ms. These are individual observations, not latency guarantees.
- The model attempted to infer a `general` partition from ambiguous language. A deterministic guard now removes that value and asks the user to clarify it.
- A fresh live server started at `http://127.0.0.1:4176`; health reports live mode and the updated static page is served.
- An HTTP intake call through that server returned OpenFOAM, simulation, the correct job name, four domain questions, one conflict, and no assumed partition in 13,251 ms.

## Remaining issues

- Browser screenshot and responsive visual QA remain unavailable because no browser connection is present.
- A human-operated `sbatch --test-only` on Sol remains outstanding.
- Confirm the active AIR credential through live preflight before judging.

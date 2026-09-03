# Conversational AIR Resource Advisor

## Objective

Move guided intake beyond field checking by adding iterative AIR questions, evidence-informed resource recommendations, independent AIR criticism, and bounded profiling profiles. Fix quoted job names such as `name the job "OF13"`.

## Files changed

- `src/intake.mjs`: recognizes quoted and conversational job names and normalizes advisor fields.
- `src/agent_harness.mjs`: strengthened the planner contract, added a resource-critic role, withheld premature OpenFOAM sizing, and added controlled profiling profiles.
- `src/mock_gateway.mjs`: added deterministic planner and resource-critic fixtures.
- `public/index.html`, `public/app.js`, `public/styles.css`: added the AIR question-and-answer interaction, recommendation basis, assumptions, tuning advice, and critic status.
- `tests/test_intake.mjs`, `tests/test_agent_harness.mjs`: added quoted-name, recommendation-readiness, critic rejection, and bounded replacement tests.
- `scripts/openfoam_probe.mjs`, `README.md`: made live prompts configurable and documented the expanded flow.

## Commands run

- `npm test`
- `npm run probe:openfoam:live` with an incomplete quoted-name prompt.
- `npm run probe:openfoam:live` after supplying `simpleFoam`, two million mesh cells, MPI, and profiling intent.

## Results

- 38 automated tests pass with zero failures or skips.
- Live planner correctly extracted `OF13` from `Name the job "OF13"`.
- With no solver or mesh scale, recommendations are withheld and AIR asks one combined high-information question.
- With `simpleFoam` and two million cells, the live planner proposed values and the live resource critic reviewed each one.
- The critic caught the incorrect transient-memory assumption, selected `openfoam_medium`, and deterministic code replaced memory with a 16 GB profiling value plus a MaxRSS tuning step.
- The successful reviewed live run took about 16 seconds end to end: planner 11,323 ms plus the critic call.
- Final validation: 38 tests pass, 22 JavaScript/MJS files pass syntax checks, the mock demo passes, and the key-pattern scan is clean.
- The restarted live HTTP endpoint on port 4176 extracted `OF13`, returned the combined solver/mesh question, and correctly withheld resource values until that question is answered.

## Remaining issues

- Profiling profiles are product guardrails, not ASU policy or guaranteed optimal allocations; this must remain visible in the pitch.
- Historical `sacct` or `seff` feedback is not yet connected to a future-run recommendation loop.
- Browser screenshot and responsive visual QA remain unavailable because no browser connection is present.
- Human-operated `sbatch --test-only` on Sol remains outstanding.

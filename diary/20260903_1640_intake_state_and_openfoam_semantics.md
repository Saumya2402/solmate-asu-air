# Intake State and OpenFOAM Semantics

## Objective

Correct repeated intake omissions and value loss reported from the guided planning UI, using the exact supplied OpenFOAM transcript as a regression case.

## Root causes

- Port `4176` was running mock mode, whose fixed 12 ms role metadata looked like a live AIR response.
- The deterministic path recognizer did not understand `use the file in /scratch/...` phrasing.
- A total CPU count for an OpenFOAM parallel run was stored as CPUs per task instead of MPI ranks.
- Derived CPU/rank facts did not retain evidence, allowing a later partial model response to remove them.
- Case-insensitive solver recognition preserved `Pimplefoam` instead of proposing the case-sensitive `pimpleFoam` executable.
- Recommendation confirmations reset after each follow-up even when field and value were unchanged.
- The resource critic was required to review non-resource fields such as job name and output paths. A schema mismatch then discarded nearly every recommendation.

## Changes

- Added a prominent mock-mode notice stating that local fixtures are active and AIR is not being called.
- Re-applied validated explicit facts from the complete accumulated transcript on every intake turn.
- Added contextual working-directory extraction for arbitrary absolute paths following file/case location language.
- Interpreted `16 CPUs for a parallel run` in an OpenFOAM request as 16 MPI ranks and one CPU per task, with a visible interpretation note.
- Generalized total-CPU and explicit-MPI-rank division while preserving explicit `CPUs per task` language.
- Added canonical OpenFOAM solver suggestions and a confirmable `Pimplefoam -> pimpleFoam` correction.
- Added one-node profiling and `-parallel` suggestions for confirmed multi-rank OpenFOAM intent, while protecting serial cases.
- Preserved unchanged form values and recommendation confirmations across follow-ups.
- Carried forward signed stable completion suggestions when an optional AIR role omits them on an appended follow-up.
- Restricted the independent resource critic to resource fields. Validated naming, paths, environment placeholders, executable, command arguments, and scheduler profiles no longer disappear after a resource-review failure.

## Validation

- Exact HTTP replay produced `/scratch/asurite/sparky`, `cpus=1`, `tasks=16`, `memoryGb=32`, executable suggestion `pimpleFoam`, argument `-parallel`, and node suggestion `1`.
- Follow-up regression preserved all those facts and added `walltime=02:00:00`.
- Serial OpenFOAM regression confirmed that `-parallel` is not added.
- Total CPU regression confirmed 16 total CPUs with 8 MPI ranks becomes 2 CPUs per task.
- `npm test`: 101 passed, 0 failed.
- JavaScript syntax checks and `git diff --check` passed.
- The running local server reports mock mode and serves the explicit mock warning.
- Browser automation was unavailable, so the UI was verified through its HTTP output and contract tests rather than a rendered screenshot.

## Remaining work

- Restart on a separate port in live mode from a terminal containing `OPENAI_API_KEY`, then replay the exact transcript against AIR.
- Compare live role outputs with the validated merged result; any AIR omission should now be retained or rejected without deleting accepted state.

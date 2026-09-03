# Stateful AIR Intake Repair

## Objective

Investigate and fix the repeated loss or corruption of Sol, CPU, GPU, MPI, job-name, and working-directory facts during follow-up analysis and AIR failures.

## Work completed

- Traced destructive replacement across `AgentHarness.intake`, `/api/intake`, `renderIntake`, and the description input handler.
- Added evidence-backed prior-fact transport and server-side revalidation/merge semantics.
- Preserved the last good form on pending and failed AIR calls and preserved deliberate form edits across successful re-renders.
- Strengthened AIR instructions for singular resources, standalone paths, general Sol wording, job/path separation, and MPI tasks.
- Added an independent parallel AIR fact auditor after a live primary extractor omitted `a CPU` and `a GPU`.
- Added semantic quote validation for numeric values, walltime, arrays, joined job-name rejection, and standalone Linux paths.
- Ran an independent AIR source critic and adjudicated its findings against source and tests.
- Updated README architecture and saved sanitized live evidence.

## Commands and results

- `npm test`: 53 tests passed.
- `npm run demo:mock`: passed.
- `npm run review:state:live`: schema-valid AIR critic result; 89,601 ms.
- `npm run probe:openfoam:live` with the sanitized reported transcript: all expected facts recovered; primary extractor 10,000 ms, fact auditor 11,492 ms, planner 20,044 ms.
- Live server restarted at `http://127.0.0.1:4176`.

## Limits

- No browser was available for automated click-through verification.
- No data is saved to a cloud database. Workload text exists in browser memory and is sent to ASU AIR for inference; the API key remains server-side.

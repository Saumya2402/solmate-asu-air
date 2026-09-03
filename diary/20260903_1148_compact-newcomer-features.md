# Compact Newcomer Features

## Scope

Implemented the user-approved newcomer addendum: typo correction, script teaching, profiling guidance, resource arithmetic, environment readiness, mistake checks, next-step commands, and lifecycle controls. Reworked the tall recommendation-card interface into compact rows and task tabs.

## Implementation

- Added a focused AIR typo reviewer and deterministic correction validation. Safe language/software corrections inform interpretation; identifiers require confirmation and are never silently changed.
- Added an AIR Slurm explainer whose output must cover and quote every meaningful generated script line exactly. Deterministic explanations remain available when AIR explanation fails.
- Added `src/newcomer_guidance.mjs` for resource metrics, first-run measurements, controlled readiness checks, and common beginner warnings.
- Added inspect and cancel lifecycle commands gated by a numeric job ID.
- Replaced expanded recommendation blocks with one-line rows and collapsed `Why` details.
- Added Script, Explain, Check, and Run tabs in the reviewed-output column.
- Updated model configuration, benchmark assignment, README, approved plan addendum, tests, and sanitized results.

## Validation

- 81/81 tests passed with zero skipped.
- 32 JavaScript files passed syntax checks.
- Mock end-to-end demo and credential scan passed.
- Live AIR typo reviewer detected two intended mistakes in synthetic input, suppressed a false Sol capitalization correction, classified the workload as OpenFOAM/simulation, and preserved the exact job name.
- Live AIR generation returned an approved valid script, 16 exact-line explanations, correct resource arithmetic, five readiness checks, and one beginner warning.
- The live site was restarted at `http://127.0.0.1:4176`.

## Remaining

No controllable browser was connected, so desktop/tablet/mobile screenshots were not inspected. The team should perform that visual pass before recording. No generated command or Slurm script was executed; `sbatch --test-only` remains human-controlled on Sol.

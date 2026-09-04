# Readiness Message Consistency

## Problem

The guided intake showed contradictory blockers after AIR analysis. Blank modules were described as required even though generation normalized them to an empty list, argument recommendations with multiple lines could fail confirmation comparison, and scheduler rationale could repeat an AIR-authored limit that disagreed with the validated Sol profile.

## Changes

- Made modules and command arguments optional at intake while preserving AIR argument suggestions when workload evidence supports them.
- Normalized omitted module and argument values to empty arrays before final validation.
- Replaced the stale analysis-based readiness sentence with one browser calculation based on current form values and current recommendation confirmations.
- Reused the array-aware recommendation matcher during generation, including newline-separated command arguments.
- Kept generation errors in the generation status area instead of duplicating them beside workload analysis.
- Replaced scheduler-advisor prose with a deterministic explanation derived from the exact validated scheduler profile and its configured walltime limit.
- Clarified that an unknown software label means no specific application or framework was named; it does not prevent executable configuration.

## Scope Decision

The initial plan kept arguments required. Review showed that many valid executables need no arguments, while Python script paths can still be offered as explicit AIR recommendations. Arguments were therefore made optional with the same normalization rule as modules.

## Validation

- `node --check public/app.js`
- `node --check src/intake.mjs`
- `node --check src/agent_harness.mjs`
- `npm test`: 123/123 passed
- Added regressions proving omitted modules and arguments generate as empty arrays, false AIR scheduler-limit prose is replaced by the validated seven-day public profile limit, and browser readiness uses current form state.

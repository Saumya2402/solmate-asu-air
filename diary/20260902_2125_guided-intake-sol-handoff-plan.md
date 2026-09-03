# Guided Intake and Sol Handoff Plan Update

## Objective

Update the implementation plan to require complete user-confirmed resources, deterministic limit enforcement, AIR recommendations, and a safe user-operated Sol submission handoff.

## Sources checked

- `AGENTS.md`
- `plans/plan_live_air_compute_concierge_20260902.md`
- `diary/20260902_2104_failure-forensics-plan.md`
- Implementation Plan skill instructions
- ASU RC new-user, file-transfer, SBATCH, partitions/QoS, Slurm command, and AI Slurm-generator documentation

## Files changed

- Updated `plans/plan_live_air_compute_concierge_20260902.md`
- Added this diary entry

## Decisions

- Missing scheduler and workload fields remain `null`; AIR recommendations require explicit user confirmation.
- Epochs are conditionally required for ML training and remain application arguments rather than scheduler resources.
- Deterministic validation, not AIR, controls readiness and rejects unrealistic or policy-invalid values.
- Cluster/QoS limits come from dated official profiles; account-specific unknowns produce discovery commands instead of guesses.
- Sol commands are built from fixed templates and executed only by the user.
- The handoff separates upload, login, syntax validation, `sbatch --test-only`, real submission, monitoring, and diagnostic collection.
- A human-operated Sol dry run becomes planned validation because the user reports having access.

## Verification planned

- Tests for missing fields, recommendation confirmation, extreme CPU requests, class-QoS limits, GPU/partition mismatch, conditional epochs, and repeated correction.
- Tests for command injection, unresolved placeholders, filename/path handling, LF output, and separation of test versus real submission.
- Manual VPN/Sol access check and sanitized `sbatch --test-only` result during implementation.

## Unresolved issues

- The user's exact Sol account/QoS entitlements have not been inspected.
- Application plausibility ceilings require review against current Sol inventory before coding.
- A real debug-job submission remains optional and must be explicitly authorized by the team.
- Implementation still requires approval under the main plan's approval gate.

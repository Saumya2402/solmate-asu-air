# Failure Forensics Plan Update

## Objective

Assess Research Computing Failure Forensics for Sol and Phoenix, run an AIR critic, and update the approved implementation plan with defensible accuracy boundaries.

## Files read

- `AGENTS.md`
- `plans/plan_live_air_compute_concierge_20260902.md`
- `diary/20260902_2039_update-live-air-plan.md`
- Implementation Plan skill instructions

## Sources checked

- ASU RC Voyager account, AIR getting-started, job states, SBATCH, job statistics, partitions/QoS, available software, web portal, and Slurm script generator documentation
- Live AIR critic using `qwen3-coder-next`

## Files changed

- Updated `plans/plan_live_air_compute_concierge_20260902.md`
- Added this diary entry

## Decisions

- Keep failure forensics in scope because ASU publishes matching Slurm and failed-job diagnosis skills.
- Require explicit Sol/Phoenix/unknown scope and versioned cluster profiles.
- Use confirmed, probable, and inconclusive outcomes instead of unconditional root-cause claims.
- Require corroborating Slurm/job-usage metadata for high-confidence OOM, timeout, and resource diagnoses.
- Treat pending, maintenance, node, and administrator conditions separately from user script errors.
- Never infer account-specific QoS access or cross-apply cluster rules.
- Preserve diagnosis-only behavior for arbitrary scripts and suppress repairs for inconclusive/infrastructure cases.
- Describe synthetic fixtures as regression coverage, not real-world accuracy evidence.

## Commands and results

- Live AIR critic: completed with `qwen3-coder-next` in 51,337 ms using 1,051 tokens.
- Sol/Phoenix portal HTTP probes: no response from the current process; this is not proof of account ineligibility.
- Official account documentation: LLM-only access does not grant HPC access; sponsored HPC access and VPN are required.

## Unresolved issues

- Direct Sol/Phoenix execution is not currently available from this environment.
- User account sponsorship, VPN state, and current cluster entitlement remain unverified.
- Real-cluster validation and any production accuracy estimate remain outside the MVP unless access is obtained.
- Implementation still requires user approval under the main plan's approval gate.

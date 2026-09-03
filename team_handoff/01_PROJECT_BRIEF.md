# Project Brief

## Objective

Build a pitch-ready, working web application in 24 hours that reduces the friction and risk of preparing and troubleshooting Slurm jobs on ASU Research Computing systems while demonstrating meaningful real-time use of ASU AIR-hosted models.

## Problem

Researchers often know the science they want to run but not every scheduler detail needed to run it safely. Missing memory, CPU, GPU, walltime, module, partition, or QoS details can lead to rejected submissions, long waits, wasted allocations, and cryptic failures. Troubleshooting requires translating Slurm states, logs, and usage metadata into an actual next action.

## Target users

- Graduate students submitting their first or fiftieth batch job.
- Researchers moving a local Python, R, simulation, or ML workflow to Sol.
- Research staff helping lab members debug resource and environment failures.
- Instructors supporting class-based HPC access.

## Product workflow

### 1. Guided planning

The user describes a workload. AIR extracts only stated facts, identifies missing details, and recommends values with rationale and uncertainty. Missing values remain empty until the user enters or confirms them.

### 2. Deterministic validation

Code validates types, units, cross-field consistency, cluster/QoS policy, and product plausibility limits. A request for 10,000,000 CPUs is rejected with a field-specific explanation and a realistic next step. AIR explains recommendations; it cannot bypass validation.

### 3. Controlled script generation

Only a complete, validated structured specification is rendered into a Slurm script. The model never supplies raw shell code for direct execution.

### 4. Sol handoff

The site provides separate copyable commands for upload, login, syntax validation, `sbatch --test-only`, submission, monitoring, and collecting diagnostic metadata. The user reviews and runs every command. SolMate never receives Sol credentials or submits jobs.

### 5. Failure forensics

The user supplies a script, log, cluster, and optional `sacct`/`seff` metadata. AIR proposes a diagnosis, while code verifies every cited line and applicable ASU rule. Results are labeled confirmed, probable, or inconclusive.

## Why AIR belongs in the solution

- Natural-language intake and follow-up questions adapt to different workloads.
- Specialized planner, critic, and diagnostician roles can use different AIR-hosted models.
- Research context and pasted logs stay within ASU-hosted infrastructure according to AIR's documented positioning.
- Deterministic code surrounds model inference, making the result inspectable and safer.

## MVP boundary

The MVP generates, validates, explains, and diagnoses. It does not execute shell commands, store credentials, guarantee queue time, infer account entitlements, or promise that a proposed fix will succeed without a cluster test.

## Evidence we should show judges

- A real AIR request with requested/returned model ID and latency.
- An incomplete prompt that triggers targeted follow-up questions.
- An absurd CPU request rejected by deterministic validation.
- A valid script that passes local checks and `sbatch --test-only` on Sol.
- A seeded failure whose diagnosis cites exact supplied evidence.
- A counterexample that remains inconclusive instead of hallucinating certainty.

## Success statement

A researcher should leave with a reviewed script, an understandable submission path, and a defensible diagnosis, without having to become a Slurm expert first.


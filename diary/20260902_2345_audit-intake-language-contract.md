# Audit Intake Language Contract

## Objective

Resolve repeated failures to carry ordinary language and follow-up details into the structured job specification.

## Critical causes

- Exact-evidence filtering was correct for safety, but deterministic fallback grammar was too narrow.
- Extraction selected first mentions rather than the latest conversational value.
- `MPI n=16` was conflated with CPUs even though Slurm distinguishes tasks from CPUs per task.
- Example placeholders looked like stale populated values.
- Final validation did not accept the UI's simulation workload type.

## Files changed

- `src/intake.mjs`: latest-value extraction, article/number-word counts, job-name paraphrases, working paths, MPI tasks, nodes, and simulation-first classification.
- `src/job_spec.mjs`: accepts simulation and validates multi-task simulation arithmetic.
- `public/index.html`, `public/app.js`: exposes nodes/tasks, labels CPU semantics, reads those fields, and removes misleading placeholders.
- `tests/test_intake.mjs`, `tests/test_job_spec.mjs`: exact transcript, correction order, natural counts, and MPI rendering tests.
- `reviews/review_intake-language-contract_20260902.md`: critical implementation review and resolution status.

## Validation

- `npm test`: 45 passed, zero failed or skipped.
- Live `/api/intake` replay with the reported transcript returned `of13`, `/scratch/asurite/sparky`, 1 CPU per task, 1 GPU, 16 MPI tasks, 32 GB, and `02:00:00`.
- The live run used `qwen3-coder-30b-a3b-instruct` and completed in 11,775 ms.
- `nodes` remained required, correctly avoiding an unsupported placement assumption.
- Live server restarted at `http://127.0.0.1:4176`.

## Remaining issues

- Browser automation remains unavailable, so visual field population requires one manual refreshed-page check.
- Open-ended paraphrase coverage should continue to grow from real transcripts.
- Sol `sbatch --test-only` remains a human-operated validation step.

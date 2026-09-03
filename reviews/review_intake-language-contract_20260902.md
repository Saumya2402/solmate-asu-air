# Intake Language Contract Review

## Compliance score

Partial. The implementation uses live AIR and deterministic validation, but the approved iterative-intake behavior is not reliable across ordinary paraphrases and conversational updates.

## Critical findings

1. **High - Common explicit facts are dropped.** `normalizeExplicitFacts` recognizes `name the job X` but not `the job name should be X`; it recognizes numeric CPU counts but not `a CPU`; and it has no working-directory/path parser. Because unverified model fields are intentionally discarded, these gaps directly become missing UI values.
2. **High - MPI rank count is mapped to the wrong concept by AIR.** The UI and recommendation path use a generic `CPUs` field, while Slurm renders it as `--cpus-per-task`. `MPI n=16` means 16 tasks/ranks, not 16 CPUs per task. The form does not expose `nodes` or `tasks`, despite renderer support.
3. **High - Conversational corrections can retain stale values.** Deterministic regexes use the first match in the accumulated description. A later correction such as `actually use 8 CPUs` cannot reliably override an earlier value.
4. **Medium - Placeholder examples look like populated data.** Values such as `image-training`, `/scratch/asurite/project`, `public`, and `python` appear inside missing fields, making failed extraction look like stale or fabricated state.
5. **Medium - OpenFOAM can be misclassified as distributed computing.** Intake normalization checks MPI/distributed labels before simulation/software context, even though MPI is an execution strategy for the simulation rather than its domain.
6. **Medium - Tests cover exact developer-authored phrases, not the reported conversation.** No regression combines `a CPU`, `MPI n=16`, `path is ...`, and `the job name should be ...` across appended follow-up paragraphs.

## Plan comparison

- Evidence-backed AIR extraction: **partial** - exact evidence validation exists, but fallback language coverage is insufficient.
- Iterative follow-up preserving completed fields: **partial** - answers persist, but ordinary phrases and later overrides are dropped.
- Scientific resource semantics: **partial** - critic and profiling logic exist, but MPI tasks and CPUs per task are conflated in the UI.
- Deterministic safe rendering: **done** - scripts remain controlled and are not executed.
- User-visible provenance and clarity: **partial** - AIR status is visible, but example placeholders obscure missing state.

## Required fixes

- Parse latest explicit values for job name, working directory, CPU/GPU counts, memory, walltime, and MPI tasks.
- Support common number words and articles for resource counts.
- Add `nodes` and `tasks` fields and relabel CPU as `CPUs per task`.
- Require nodes when a simulation explicitly requests multiple MPI tasks.
- Replace realistic placeholders with unmistakable missing/example labels.
- Add the exact reported multi-turn transcript and later-correction tests.

## Post-review resolution

- Findings 1-6: **resolved in this work session**.
- The parser now accepts articles and number words, job-name paraphrases, paths, MPI rank syntax, and latest conversational overrides.
- MPI rank count is represented as `tasks`; CPU count is represented as `cpus per task`.
- Simulation is accepted by final validation, and multi-task simulation requires a node decision.
- Realistic placeholders were replaced with unmistakable missing-state labels.
- The exact reported transcript passes both deterministic tests and a live AIR HTTP replay.
- Residual risk: language is open-ended, so future paraphrases require fixture expansion; model fields without exact evidence remain intentionally untrusted.
- Follow-up architecture revision: live fact interpretation now comes from a dedicated AIR extractor running concurrently with the AIR planner. Deterministic phrase extraction remains only in the mock fixture path; live deterministic code is limited to evidence/type/safety verification.

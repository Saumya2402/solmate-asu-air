# SolMate Submission Overview

## Prototype Description

SolMate uses ASU AIR and deterministic safeguards to turn research intent into explainable Slurm jobs, then diagnose failures with evidence and ASU Research Computing guidance.

## Use Case

Researchers often understand the computation they want to run but not every scheduler, resource, or environment detail needed by a shared HPC system. Missing or incorrect CPU, GPU, memory, walltime, partition, QoS, module, and command settings can cause rejected submissions, inefficient requests, or runtime failures that are difficult for newcomers to interpret.

SolMate provides two connected workflows:

1. **Plan a job:** describe a workload in plain language, review AIR-extracted facts and recommendations, resolve missing information, validate the complete request, and generate an explainable Slurm script.
2. **Diagnose a failure:** supply a script, log output, and available scheduler metadata; receive an evidence-checked finding, uncertainty level, next action, and relevant ASU Research Computing guidance.

The user remains responsible for reviewing, testing, and submitting every job. SolMate does not collect Sol credentials or execute cluster commands.

## Use Of ASU AIR

ASU AIR is the language-intelligence layer of the prototype. Specialized AIR roles interpret workload descriptions, audit extracted facts, detect likely typos, suggest missing values, select supported scheduler profiles, critique resource advice, explain generated scripts, and diagnose supplied failure evidence.

Several intake roles run concurrently to reduce waiting time and provide independent checks. Their outputs are treated as proposals rather than authority. Deterministic application code verifies quoted evidence, retains facts across follow-up turns, restricts scheduler choices, validates resource requests, renders the Slurm script, and rejects unsupported diagnosis claims.

This division lets AIR handle varied scientific language while keeping infrastructure-sensitive decisions auditable and bounded.

## Team Collaboration

The project combined four workstreams: research-computing workflow validation, application engineering, interface and interaction design, and presentation preparation. A shared implementation plan defined the product boundary, while timestamped engineering diaries, focused reviews, fixtures, and acceptance results kept parallel work aligned.

The team used realistic workload examples and documented failure patterns to connect domain needs with implementation decisions. Product and interface work focused on making unfamiliar HPC concepts understandable without hiding the underlying Slurm values. Validation work converted repeated failure reports into regression tests so fixes remained stable as the prototype evolved.

## Key Features

- Evidence-backed workload extraction with retained multi-turn state.
- Editable AIR recommendations with rationale, uncertainty, and researcher confirmation.
- Plain-language explanations for partition, QoS, resource math, modules, and common ASU tools.
- Natural-language walltime conversion and visible typo suggestions.
- Dated `docs.rc.asu.edu` grounding with direct source links.
- Deterministic resource, scheduler, completeness, and cross-field validation.
- Controlled Slurm rendering with AIR critique and exact-line explanation.
- Human-run commands for testing, submission, monitoring, and evidence collection.
- Evidence-checked failure diagnosis with confirmed, probable, and inconclusive outcomes.
- Sanitized browser-local outcome feedback that can inform later advice without changing policy.

## Insights

### Interpretation and control need different owners

AIR is valuable because researchers describe software and scientific intent in many ways. Slurm directives, scheduler pairs, shell escaping, and evidence matching require stricter control. The strongest design uses AIR for interpretation and explanation while deterministic code owns final validation and rendering.

### Missing information is part of the answer

A useful HPC assistant should not hide uncertainty. Asking one high-information follow-up question or returning an inconclusive diagnosis is safer than silently inventing a resource value or root cause.

### State consistency determines trust

Researchers quickly lose confidence when a job name, path, or resource disappears after a follow-up. SolMate revalidates accumulated evidence and retains earlier verified facts unless the researcher supplies a newer value.

### Documentation is more useful in context

New researchers may not know which guide to search for or what terms such as partition and QoS mean. SolMate retrieves a small relevant set of ASU Research Computing sources and presents them alongside the decision where they matter.

### Feedback must remain bounded

Reported job outcomes can improve later questions and starting recommendations, but they are not proof of causality. SolMate stores only a small sanitized local history and never allows feedback to override documented scheduler rules or deterministic validation.

## Validation And Boundaries

The release includes 133 automated tests and a 24-case failure-diagnosis acceptance matrix. Coverage includes fact retention, recommendation confirmation, duration conversion, scheduler selection, script safety, failure evidence, security boundaries, GitHub Pages separation, and interface behavior. Sanitized live AIR and benchmark summaries are stored under `results/`.

SolMate does not claim universal workload accuracy, guaranteed job success, automatic knowledge of account permissions, or perfect failure diagnosis. Cluster policy, installed software, queue availability, and user entitlements can change. Generated scripts remain proposals until reviewed and tested on the target cluster.

## Sources

- [ASU AIR API](https://docs.rc.asu.edu/ai/api/)
- [Slurm SBATCH job scripts](https://docs.rc.asu.edu/slurm-sbatch/)
- [Partitions and QoS](https://docs.rc.asu.edu/partitions-and-qos/)
- [Understanding job states](https://docs.rc.asu.edu/jobstates/)
- [Job statistics](https://docs.rc.asu.edu/job-statistics/)
- [Available software](https://docs.rc.asu.edu/available-software/)

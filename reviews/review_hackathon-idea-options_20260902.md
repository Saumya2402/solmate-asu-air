# ASU AIR Spark Challenge Idea Review

Date: 2026-09-02

## Review basis

The kickoff deck defines an open-ended, two-day app challenge requiring teams of 3-5, an original prototype built with AIR-hosted models, a repository with code and README, a pitch deck, and a recorded pitch. Pre-screening emphasizes completion, code quality, and slide quality. Finalist judging emphasizes real-world impact, prototype functionality, innovation, cross-functional collaboration, and pitch quality.

The prep workshop highlights AIR's differentiators: ASU-local data, unmetered token usage, persistent applications, OpenAI-compatible APIs, agentic workflows, multimodal models, embeddings, ASR/TTS, and access to broader compute through Kubernetes.

Important ambiguity: kickoff slides 44-45 refer to a specific "data science tutor" use case, CPU-versus-GPU benchmarks on Sol, a four-minute pitch, and a six-minute presentation slot. These conflict with the earlier open-ended challenge and five-minute pitch instructions. Confirm with staff whether slides 44-45 are active requirements or leftover material before locking scope.

## Ranked ideas

Scores use a 1-5 scale and prioritize impact, a convincing live demo, innovation, two-day feasibility, and clear use of AIR.

| Rank | Concept | Impact | Demo | Novelty | Feasibility | AIR fit | Average |
|---:|---|---:|---:|---:|---:|---:|---:|
| 1 | ASU Compute Concierge | 5 | 5 | 4 | 5 | 5 | 4.8 |
| 2 | AccessLab Multimodal Accessibility Studio | 5 | 5 | 4 | 4 | 5 | 4.6 |
| 3 | Research Reproducibility Auditor | 5 | 4 | 4 | 4 | 5 | 4.4 |
| 4 | Protocol Sentinel | 5 | 4 | 5 | 3 | 5 | 4.4 |
| 5 | Private Course Tutor | 4 | 5 | 2 | 5 | 4 | 4.0 |

### 1. ASU Compute Concierge - recommended

Turn a plain-language research workload into a validated Slurm job script, then diagnose a failed job log and propose a corrected script. The interface explains CPU, GPU, memory, walltime, modules, and partition choices instead of producing unexplained code.

Why it can win: it solves an immediate ASU research problem, is naturally powered by AIR, has a crisp before/after demo, and can be tested deterministically. It is also unusual compared with generic document chatbots.

Two-day MVP:

1. A form or chat captures workload requirements.
2. AIR generates a structured job specification and Slurm script.
3. A deterministic validator catches invalid or risky settings.
4. Users paste a failed Slurm log and receive a diagnosis with cited evidence from the log.
5. The app generates a patch/diff and an exportable script.
6. A test panel shows valid-script rate, diagnosis accuracy on seeded failures, and response time.

Suggested AIR models: `qwen3-coder-next` for generation and debugging, with `qwen3-embedding-8b` for retrieval over a small curated set of ASU RC documentation. Keep resource validation in ordinary code rather than trusting the model.

Scope boundary: do not submit jobs to a real cluster in the hackathon MVP. Generate, validate, explain, and export scripts. A real submission integration is a credible next step.

### 2. AccessLab Multimodal Accessibility Studio

Upload a lecture recording or research presentation and produce a transcript, chapter summary, glossary, image descriptions, accessible notes, and optional spoken summary. This showcases ASR, vision-language analysis, text generation, and TTS in one visible workflow.

Primary risk: multimodel orchestration and file processing can consume the build window. Limit the MVP to one short video or a PDF plus audio.

### 3. Research Reproducibility Auditor

Upload a paper, README, and repository snapshot. The app maps claims to code, identifies missing setup details, proposes reproducibility checks, and produces a prioritized audit with evidence links.

Primary risk: avoid claiming that a project is reproducible without executing it. Clearly separate static findings from verified test results.

### 4. Protocol Sentinel

Compare a lab protocol, experiment notes, and instrument output to detect missing steps, inconsistent units, and deviations. AIR's local-data story is especially strong for unpublished research.

Primary risk: scientific accuracy and domain breadth. Choose one narrow protocol type and use synthetic or approved sample data.

### 5. Private Course Tutor

Create a citation-grounded tutor over course slides, recordings, and assignments, with voice questions and diagram understanding. It is feasible and easy to demonstrate, but likely to face many similar submissions.

Differentiation would require a distinctive feature such as misconception tracking, instructor-controlled source boundaries, or a visual evidence trail.

## Recommended pitch framing

Opening: researchers lose hours translating scientific intent into scheduler syntax and diagnosing opaque failures.

Demo: describe a workload, generate and validate a script, inject a known failure, upload the log, and show the repaired diff.

Evidence: report pass rate across a small test suite of valid and invalid job configurations, seeded-log diagnosis accuracy, and median response time. Do not rely on subjective "looks correct" evaluation.

AIR story: research context and logs remain on ASU systems, the coding model is hosted through AIR, and the product helps users make better use of ASU compute resources.

Closing: the prototype turns cluster access from a syntax problem into a guided, auditable workflow.

## Review status

- Source-document review: done
- Rules and deliverables extraction: done
- Idea comparison against judging criteria: done
- Implementation plan: not done; no concept has been approved yet
- Code or prototype validation: not applicable
- Required decision: confirm the active pitch format and whether the data-science-tutor/GPU benchmark slides apply

Overall status: complete for brainstorming and concept selection; implementation remains intentionally unstarted.

# Live ASU Docs Acceptance

## Objective

Validate the documentation-grounded intake, generation, newcomer guidance, and failure-diagnosis paths against the live ASU AIR gateway.

## Environment

- Local application endpoint: `http://127.0.0.1:4179`
- Application mode: `live`
- AIR gateway: `https://openai.rc.asu.edu/v1`
- Rules version: `2026-09-03`
- Synthetic inputs only; no private research data, prompts, raw responses, or credentials were stored.

## Checks

- Health returned live mode, nine scheduler profiles, scheduler glossary data, and the configured AIR role models.
- Intake recovered the synthetic job name, working directory, CPU, GPU, memory, walltime, and epochs.
- Natural `2 hours` input became canonical `02:00:00`.
- One sanitized local outcome was accepted as advisory context.
- Intake returned four relevant ASU RC Docs sources and proposed only missing completion fields.
- Generation passed deterministic validation, rendered 18 script lines, and received 15 exact-line explanations.
- The generated guidance returned six contextual ASU tools, including mamba-first Python environment guidance.
- The AIR critic retained a review verdict because the synthetic GPU request had no verified accelerator environment.
- Failure diagnosis returned `COMMAND_NOT_FOUND_OR_MODULE`, matched `slurm-command-not-found`, and cited the exact supplied error.
- AIR diagnosis passed deterministic evidence validation.

## AIR models and latency

- Intake extractor: `qwen3-30b-a3b-instruct-2507`, 1475 ms
- Fact auditor: `qwen3-coder-30b-a3b-instruct`, 2739 ms
- Typo reviewer: `qwen3-30b-a3b-instruct-2507`, 1635 ms
- Completion advisor: `qwen3-30b-a3b-instruct-2507`, 9134 ms
- Scheduler advisor: `qwen3-30b-a3b-instruct-2507`, 619 ms
- Planner: `qwen3-coder-30b-a3b-instruct`, 9960 ms
- Generation critic: `qwen3-coder-30b-a3b-instruct`, 3131 ms
- Script explainer: `qwen3-coder-30b-a3b-instruct`, 11285 ms
- Diagnostician: `qwen3-coder-30b-a3b-instruct`, 3196 ms

## Artifact

- `results/results_asu_docs_live_acceptance_20260903.json`

## Remaining work

- Desktop/mobile visual inspection remains manual because the automated browser connection was unavailable.
- Repeat the live golden path during final demo rehearsal and keep a recording as the service fallback.

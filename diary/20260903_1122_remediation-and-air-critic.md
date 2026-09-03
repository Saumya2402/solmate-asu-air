# Remediation And AIR Critic

## Scope

Implemented the safety, correctness, state, diagnosis, handoff, fixture, and documentation remediation identified by `reviews/review_full-plan-code-audit_20260903.md`. Used ASU AIR `qwen3-coder-30b-a3b-instruct` for a live source critic and independently adjudicated every finding before making the final two changes.

## Changes

- Centralized dated scheduler and hardware profiles and enforced exact scheduler pairs, account requirements, per-node resource capacity, job-schema allowlisting, distinct logs, and parallel OpenFOAM arguments.
- Redacted the entire diagnosis payload before AIR and strengthened deterministic rule/category/corroboration validation.
- Bound AIR recommendations to expiring exact-value HMAC snapshots and invalidated edited confirmations in the browser.
- Added expiring exact-value HMAC acknowledgement for Sol handoff commands; the initial API response cannot contain `sbatch` submission.
- Fixed explicit-fact versus browser-draft precedence, request cancellation, loading/error ownership, and stable upstream error classification.
- Completed diagnosis evidence/repair UI contracts, handoff variants, workload/failure fixtures, benchmark/review scripts, and role configuration documentation.

## Critic Decision

The second Qwen critic returned `revise` with seven findings. Manual source/test review rejected five as false positives and accepted two: complete unchanged-recommendation confirmation and server-bound handoff acknowledgement. Both accepted issues were fixed and covered by tests. Full adjudication is saved in `reviews/review_remediation_status_20260903.md`.

A post-fix Qwen pass returned `revise` with eight findings in 48,745 ms. It accepted no new defect after source/test review, was internally inconsistent about stale-draft precedence, and incorrectly called supplied injection and confirmation regressions missing. Its low-severity request for hardware-specific precision is retained as a disclosed boundary because exact node/accelerator availability and entitlement must be verified by the researcher.

## Validation

- `npm test`: 74/74 passed, zero skipped.
- `node --check`: 30 files passed.
- `npm run validate:fixtures`: 10/10 passed.
- `npm run demo:mock`: passed.
- Credential-pattern scan: clean.
- Live AIR preflight: schema-valid Qwen response in 1,403 ms.
- Live AIR golden path: planner 26,208 ms; critic 3,686 ms with approve verdict and valid script; diagnostician 2,807 ms with confirmed evidence-grounded OOM.
- Live handoff API: signed token issued; submit absent before acknowledgement and present after exact-value acknowledgement; two job-ID commands stayed unresolved.
- Live website restarted at `http://127.0.0.1:4176`.

## Remaining

Browser visual checks could not run because no controllable browser was connected. Three-repeat live evidence, recorded demo, complete multi-model benchmark, and human-controlled Sol `sbatch --test-only` remain. The app did not execute any generated Slurm or shell content. The workspace is not a Git repository, so diff-based scope verification remains unavailable.

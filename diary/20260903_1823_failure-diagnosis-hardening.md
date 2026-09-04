# Failure Diagnosis Hardening

## Objective

Make the failure workflow useful for evidence-based, after-hours Sol and Phoenix triage without replacing deterministic validation or Research Computing support.

## Files read

- `AGENTS.md`
- Current implementation plans and latest diary
- Diagnosis, harness, server, UI, knowledge, fixtures, and tests
- ASU RC Docs for SBATCH, job states, job statistics, helpful commands, accounts, partitions/QoS, scratch storage, and support

## Files changed

- Added a scoped plan, deterministic evidence-command builder, reusable diagnosis acceptance runner, focused tests, and a sanitized mock result artifact.
- Expanded documented diagnosis rules, strict AIR evidence/rule validation, inconclusive fallback behavior, triage dispositions, and direct accounting-output recognition.
- Added a compact stage-aware evidence helper and support routing to the failure UI.
- Updated README and sanitized the prior Sol acceptance diary so no real job identifier remains.

## Commands run

- `npm test`
- `npm run demo:mock`
- `npm run validate:diagnosis` against the updated mock server
- JavaScript syntax checks for changed runtime files
- `git diff --check`
- Repository attribution, identifier, and credential-pattern scans

## Results

- Full suite: 121/121 passed.
- Sanitized diagnosis matrix: 24/24 passed in mock mode.
- Mock demo and all syntax/diff checks passed.
- A live baseline exposed unrelated-rule acceptance and HTTP 500 fallthroughs; both now have regression coverage and controlled fallbacks.

## Remaining issue

- The expanded matrix needs a fresh run against the restarted live AIR server because the existing process loaded the backend before these edits.
- Automated browser inspection remains unavailable; desktop and mobile visual review is manual.

# Sol execve Diagnosis Validation

## Objective

Validate the failure-diagnosis workflow against a real, sanitized Sol job record and prevent malformed AIR evidence from taking down a verified diagnosis.

## Real cluster evidence

- `sbatch --test-only` accepted the submitted script.
- The sanitized Sol validation job finished in five seconds with state `FAILED` and exit code `2:0`; its identifier is not retained.
- The error log reported `execve(): bash: No such file or directory` followed by an `srun` exit-code message.
- The failure occurred before the intentionally invalid application command ran. With `--export=NONE`, the relative `bash` executable was unavailable to `srun`; an absolute `/bin/bash` path is the appropriate next controlled test.

## Changes

- Added deterministic recognition for Slurm `execve(): executable: No such file or directory` failures.
- Added the sanitized Sol transcript to the failure fixtures.
- Kept the AIR diagnostician call in the workflow while adding a deterministic fallback when AIR output fails JSON or exact-evidence validation.
- Added an explicit UI status distinguishing validated AIR evidence from a rejected AIR response with verified checks shown.
- Added regression coverage for exact classification and altered AIR evidence.

## Validation

- `node --test tests/test_diagnosis.mjs tests/test_agent_harness.mjs tests/test_server.mjs`: 37 passed.
- `npm test`: 95 passed, 0 failed.
- Exact HTTP replay in mock mode: category `COMMAND_NOT_FOUND_OR_MODULE`, confidence `confirmed`, exact line-one evidence accepted.
- A live replay before the fix reached AIR but returned HTTP 500 because AIR altered the cited evidence text. The regression now covers this response and returns verified deterministic evidence instead.

## Remaining work

- Repeat the exact HTTP replay in live mode after `OPENAI_API_KEY` is set in the restarted server process.
- Run the revised Sol script with `/bin/bash` so the second fixture captures the intended `definitely_not_a_real_command: command not found` failure.

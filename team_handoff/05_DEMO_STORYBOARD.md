# Demo Storyboard

## Demo objective

Prove in under 90 seconds that SolMate uses AIR in real time, refuses unsafe assumptions, produces a controlled Slurm script, and explains a failure using exact evidence.

## Scene 1 - Incomplete workload

Enter: `Train my PyTorch image classifier on Sol.`

Expected result: AIR identifies missing CPU, memory, GPU, walltime, environment, dataset, and epoch details. Recommendations appear separately from confirmed inputs.

## Scene 2 - Human confirmation

Accept or edit one recommendation and fill the remaining required values.

Expected result: the readiness indicator changes only after every required field is explicitly confirmed.

## Scene 3 - Guardrail

Enter `10000000` CPUs.

Expected result: deterministic validation rejects the field, explains that it violates a documented or product plausibility rule, and asks for a corrected value. No script renders.

## Scene 4 - Valid script

Replace the invalid value with an allowed request.

Expected result: show the generated `.slurm` file, resource explanation, AIR model identity, response time, and critic result.

## Scene 5 - Sol handoff

Open the handoff panel.

Expected result: show separate upload, SSH, `bash -n`, `sbatch --test-only`, submission, and monitoring commands. Emphasize that the real submission remains user-operated.

## Scene 6 - Failure forensics

Paste a seeded failure log and metadata.

Expected result: show category, confidence, exact cited line, explanation, and proposed action. Briefly show an ambiguous case returning `inconclusive` if time permits.

## Evidence overlay

Keep these visible or capture them as a final frame:

- `LIVE` mode
- AIR model ID
- latency
- deterministic validation status
- fixture or real dry-run status
- no credentials or sensitive paths

## Backup strategy

Record the full live run before polishing transitions. Keep a deterministic mock recording only for internal rehearsal; never present it as proof of AIR use.


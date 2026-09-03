# Sources and Claims

Checked September 2, 2026. Recheck time-sensitive cluster rules before the final pitch.

## Hackathon requirements from supplied kickoff material

- Teams must use ASU AIR-hosted models.
- Deliverables include a repository, README, prerecorded 90-second pitch, and pitch-deck URL.
- Judging includes real-world impact, prototype functionality, innovation, cross-functional collaboration, and pitch quality.
- Daily individual progress reports are required according to the kickoff deck.
- Finalist timing is inconsistent across supplied slides; confirm whether the active presentation is four or five minutes.

## ASU RC sources

- AIR getting started and available skills: https://docs.rc.asu.edu/ai/getting-started/
- LLM API: https://docs.rc.asu.edu/ai/api/
- Voyager account requirements: https://docs.rc.asu.edu/voyager-request-account/
- SBATCH scripts and submission: https://docs.rc.asu.edu/slurm-sbatch/
- AI Slurm generator tutorial and `sbatch --test-only`: https://docs.rc.asu.edu/tutorials/slurm-script-generator/
- Sol/Phoenix web portals: https://docs.rc.asu.edu/web-portal/
- File transfer and `scp`: https://docs.rc.asu.edu/transferring-to-supercomputer/
- Partitions and QoS: https://docs.rc.asu.edu/partitions-and-qos/
- Job states: https://docs.rc.asu.edu/jobstates/
- Job statistics: https://docs.rc.asu.edu/job-statistics/
- Available software: https://docs.rc.asu.edu/available-software/
- Helpful Slurm commands: https://docs.rc.asu.edu/helpful-slurm-commands/

## Approved claims

- ASU documents Slurm batch-script and failed-job diagnosis as AIR skill use cases.
- SolMate uses AIR-hosted models for planning, critique, and diagnosis in live mode.
- Deterministic application code validates model output before rendering or using it.
- The application does not submit jobs or collect Sol credentials.
- The team has already demonstrated live AIR connectivity with `qwen3-coder-next`.

## Claims requiring evidence before use

- "The proposed script passed `sbatch --test-only`" requires a captured, sanitized Sol result.
- Any response-time claim requires current benchmark output.
- Any accuracy percentage requires a defined test set, scoring method, and result file.
- Any time-saved claim requires measured comparison or a clearly labeled estimate.
- Current partitions, modules, and limits require a dated ASU source or sanitized cluster discovery output.

## Claims to avoid

- Guaranteed fix
- Guaranteed queue time
- Works for every Slurm workload
- Knows the user's account permissions automatically
- Unlimited compute
- Fully autonomous job submission
- Perfect diagnosis


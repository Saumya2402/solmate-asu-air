# 90-Second Pitch Script

Approximate script length: 209 words, or about 90 seconds at 140 words per minute. Trim after rehearsal if the speaker is slower.

## Script

It is 3:07 in the morning. Your research job has failed, and Slurm has offered the comforting explanation: "Invalid feature specification." Very specific. Thank you, Slurm.

We built **SolMate**, an ASU AIR-powered compute concierge that helps researchers prepare and troubleshoot jobs on ASU Research Computing systems.

A researcher starts by describing the workload in plain language. SolMate does not quietly invent the missing details. AIR identifies what is absent, recommends CPU, memory, GPU, walltime, and workload settings with a reason, and asks the researcher to confirm or change each one.

Then deterministic validation takes over. Ask for ten million CPUs and SolMate politely declines before the scheduler has to. Once the request is complete and valid, controlled code generates the Slurm script and provides separate commands to test, submit, and monitor it on Sol. The user remains in control.

When a job fails, the researcher can paste the script, log, and job metadata. SolMate uses an AIR diagnostician, verifies every cited line, and returns a confirmed, probable, or inconclusive diagnosis with the safest next action.

SolMate combines AIR's ability to interpret research intent with guardrails that models cannot override. Researchers spend less time negotiating with scheduler syntax and more time doing the work they came to ASU to do.

# Four-Minute Finalist Script

Approximate length: 520 words. Adapt team names and roles before recording.

## Script

Good morning. We are **[team name]**, and we built **SolMate: ASU Compute Concierge**.

Imagine it is 3:07 in the morning. A graduate student's training job has failed after hours in the queue. The error says, "Invalid feature specification." This is technically information, in the same way that "something happened" is technically a news report.

The student now has to inspect an SBATCH script, partition and QoS rules, modules, memory usage, and scheduler metadata before getting back to the research question that mattered in the first place.

SolMate creates a guarded path from research intent to a safer Slurm submission.

The user begins with a plain-language description such as, "Train my PyTorch image classifier on Sol." An AIR-hosted planner extracts what the user actually said and identifies what is missing. It can recommend CPU, memory, GPU, walltime, environment, and training settings, but it cannot silently accept its own recommendation. The user must confirm or change every missing value.

That distinction matters. Generative models are useful interpreters, but shared computing infrastructure needs deterministic rules. SolMate keeps incomplete values as null, validates types and units, checks cross-field consistency, and applies dated cluster and QoS constraints. If someone requests ten million CPUs, the interface rejects the value and explains what needs to change. It does not quietly round the request down and hope nobody notices.

Once the specification is complete, controlled code renders the Slurm script. The model never hands arbitrary shell text directly to the user as an executable result. SolMate explains the requested resources and calls an independent AIR critic to look for inconsistencies.

Next, SolMate provides a human-controlled Sol handoff. It generates separate commands to upload the script, connect to Sol, check Bash syntax, run `sbatch --test-only`, submit, and monitor the job. Credentials never enter our application, and the final submission remains an explicit user action.

The second workflow is failure forensics. A researcher supplies the script, log, cluster, and available job metadata. An AIR diagnostician proposes a cause, but deterministic code checks every cited line and source rule. The answer is labeled confirmed, probable, or inconclusive. A pending job waiting for resources is not mislabeled as a failure, and an infrastructure problem does not trigger an invented script rewrite.

This is more than a generic chatbot producing SBATCH syntax. AIR performs the work that benefits from language understanding: interpreting workloads, asking contextual questions, explaining recommendations, reviewing plans, and connecting failure evidence. Code performs the work that must be exact: validation, rendering, evidence matching, and terminal command construction.

Our demonstration measures what we can defend: schema-valid AIR responses, deterministic rejection tests, diagnosis results on known fixtures, response latency, and a real Sol dry run when access is available. We do not turn synthetic examples into universal accuracy claims.

SolMate is built around an ASU problem, powered by ASU AIR, and designed to help researchers use ASU compute with more confidence. It turns the cluster from a syntax puzzle into a guided, auditable workflow, so researchers can spend less time debugging submissions and more time advancing their work.


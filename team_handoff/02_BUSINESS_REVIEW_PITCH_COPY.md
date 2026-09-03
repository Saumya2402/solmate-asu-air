# Business Review Pitch Copy

Use this content to populate `Business_Review_Template_Unchanged.pptx`. Preserve the template's visual system. Keep the deck concise and use product screenshots once the UI is stable.

## Slide 1 - SolMate

**Title:** SolMate

**Subtitle:** From research intent to a safer Slurm submission

**Footer:** Powered by ASU AIR

**Visual:** Final product screen showing a validated script and clear LIVE AIR status.

## Slide 2 - Researchers lose time before computation begins

**Primary claim:** The scientific question may be clear while the scheduler request is incomplete.

- Missing CPU, memory, GPU, walltime, partition, QoS, or module details block progress.
- Cryptic Slurm messages send users toward the wrong fix.
- Over-requesting wastes capacity; under-requesting kills jobs.

**Presenter line:** The bottleneck is often not the research code. It is translating that code into a valid, efficient cluster request.

## Slide 3 - SolMate creates a guarded path from intent to execution

**Flow:** Describe workload -> answer missing details -> confirm recommendations -> validate -> generate script -> test on Sol -> diagnose evidence

**Primary claim:** AIR handles interpretation; deterministic code controls readiness and safety.

**Visual:** One horizontal workflow, using a real UI screenshot for the central state when available.

## Slide 4 - The product refuses to guess

**Left example:** "Train my PyTorch model."

**Follow-up prompts:**

- How much memory?
- How many CPUs and GPUs, including zero?
- What walltime and account/QoS apply?
- How are epochs supplied?

**Guardrail example:** `10,000,000 CPUs` -> rejected with an applicable bound or a discovery action.

**Primary claim:** AIR can recommend a value and explain why, but the user must confirm it and code must validate it.

## Slide 5 - Failure forensics stays tied to evidence

**Example input:** Slurm script + error log + job state + `sacct`/`seff` metadata.

**Example output:**

- Confidence: Probable
- Evidence: exact log line and metadata field
- Explanation: likely cause plus alternatives
- Action: recommended change or administrator escalation

**Primary claim:** SolMate can say "inconclusive." That is a safety feature, not a failure.

## Slide 6 - Why this is built for ASU AIR

- Uses live AIR-hosted planner, critic, and diagnostician roles.
- Keeps model roles configurable and benchmarks them for structured accuracy and latency.
- Grounds cluster claims in dated ASU RC rules.
- Helps researchers use ASU compute more effectively.

**Evidence strip:** model ID, response latency, schema validation, seeded-case result.

## Slide 7 - A focused MVP can be demonstrated in 24 hours

**Must ship:**

- Guided intake and confirmation loop
- Deterministic resource validator
- Controlled Slurm renderer
- Sol dry-run handoff
- Evidence-checked failure diagnosis
- Recorded backup demo

**Defer:** autonomous submission, exhaustive Slurm coverage, user accounts, persistent logs, and broad document retrieval.

## Slide 8 - The ask and close

**Title:** Let researchers spend their time on research

**Close:** SolMate turns cluster access from a syntax puzzle into a guided, auditable workflow, powered by ASU AIR and designed for ASU Research Computing.

**Team ask:** Approve the concept, validate the Sol workflow, and help us test it with realistic workloads.

## Speaker-note source block

Add this to slides containing external claims:

```text
[Sources]
- ASU AIR Spark Challenge kickoff deck, supplied by the team.
- https://docs.rc.asu.edu/ai/getting-started/
- https://docs.rc.asu.edu/slurm-sbatch/
- https://docs.rc.asu.edu/partitions-and-qos/
- https://docs.rc.asu.edu/jobstates/
- https://docs.rc.asu.edu/job-statistics/
```


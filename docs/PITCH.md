# SolMate Pitch Kit

## Submission Description: 25 Words

SolMate uses ASU AIR and deterministic safeguards to turn research intent into explainable Slurm jobs, then diagnose failures with evidence and ASU Research Computing guidance.

## One-Line Positioning

From research intent to a safer Slurm submission and a clear next step when it fails.

## Why It Matters

Researchers may understand their science while still losing hours to resource requests, scheduler terminology, software environments, and cryptic failure output. SolMate gives newcomers a guided path and experienced users a faster, auditable first diagnosis.

## Why AIR Is Essential

AIR interprets varied research language, identifies missing scientific context, proposes explainable settings, teaches unfamiliar terms, critiques the resulting plan, and connects failure evidence to likely causes. Deterministic safeguards verify what AIR cites and control every generated script and command.

## Differentiators

- Built around ASU Research Computing workflows and `docs.rc.asu.edu` guidance.
- Multiple specialized AIR roles run concurrently for speed and independent review.
- Evidence-backed state survives follow-up turns instead of disappearing.
- Recommendations are editable, visible, and researcher-confirmed.
- Slurm scripts come from validated structured data, not arbitrary generated shell text.
- Failure findings include exact evidence, uncertainty, alternatives, and an escalation path.
- The user keeps control of testing and submission.

## 90-Second Script

It is 3:07 in the morning. Your research job has failed, and Slurm has offered the comforting explanation: "Invalid feature specification." Very specific. Thank you, Slurm.

We built **SolMate**, an ASU AIR-powered compute concierge for planning and troubleshooting jobs on ASU Research Computing systems.

A researcher describes the workload in plain language. AIR identifies what was supplied, asks only for what is missing, and recommends CPU, GPU, memory, walltime, and scheduler settings with reasons and uncertainty. Beginner terms link directly to relevant ASU guidance.

Then deterministic safeguards take over. Ask for ten million CPUs and SolMate stops before the scheduler has to. Once the request is complete, controlled code renders the Slurm script, AIR reviews and explains it, and SolMate provides separate commands to test, submit, monitor, and inspect the job. The researcher remains in control.

When a job fails, the researcher supplies the script, log, and available metadata. AIR proposes a cause; SolMate verifies every cited line and returns a confirmed, probable, or inconclusive result with the safest next action.

SolMate combines AIR's understanding of research intent with controls the model cannot override, helping researchers spend less time negotiating with scheduler syntax and more time doing research.

## Four-Minute Presentation Structure

1. **Problem:** a valid job can still fail because the batch environment, resources, or scheduler policy differs from the researcher's expectation.
2. **Planning demo:** plain-language workload to evidence-backed fields, contextual questions, ASU sources, and editable recommendations.
3. **Trust layer:** absurd request rejection, dated scheduler profiles, confirmation, and deterministic rendering.
4. **Run handoff:** `bash -n`, `sbatch --test-only`, submission, monitoring, and utilization review remain user-operated.
5. **Failure demo:** exact log evidence, confidence tier, repair, documentation, and support escalation.
6. **Close:** AIR interprets and teaches; deterministic safeguards validate and control.

## Judge Questions

**Is this just a chatbot that writes Slurm scripts?**

No. AIR performs the language and scientific reasoning, while deterministic code owns evidence checks, state, scheduler constraints, readiness, rendering, and command safety.

**Can it guarantee the job will work?**

No. It validates documented constraints and helps the researcher test the proposal. Account access, changing software, queue availability, and application behavior remain external.

**Why not submit automatically?**

Human-controlled submission avoids credential collection and keeps resource decisions visible before shared infrastructure is used.

**How do you measure correctness?**

Each layer has a concrete contract: schema-valid extraction, exact-quote evidence, deterministic rejection tests, supported scheduler pairs, exact-line explanations, and diagnosis fixtures that include inconclusive outcomes.

## Sources

- [ASU AIR API](https://docs.rc.asu.edu/ai/api/)
- [Slurm SBATCH job scripts](https://docs.rc.asu.edu/slurm-sbatch/)
- [Partitions and QoS](https://docs.rc.asu.edu/partitions-and-qos/)
- [Job states](https://docs.rc.asu.edu/jobstates/)
- [Job statistics](https://docs.rc.asu.edu/job-statistics/)
- [Available software](https://docs.rc.asu.edu/available-software/)

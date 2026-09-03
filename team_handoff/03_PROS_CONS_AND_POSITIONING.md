# Pros, Cons, and Positioning

## Strategic strengths

- **Immediate institutional relevance:** The product addresses an ASU Research Computing workflow, and ASU already publishes Slurm generation and failed-job diagnosis guidance.
- **Excellent demo shape:** An incomplete request, a rejected absurd value, a validated script, and an evidence-backed diagnosis create a visible before-and-after story.
- **AIR is essential rather than decorative:** The language model interprets ambiguous research intent, asks contextual questions, explains recommendations, critiques plans, and diagnoses evidence.
- **Deterministic trust layer:** Validation, rendering, evidence matching, and terminal commands are controlled by code.
- **Easy test fixtures:** Known invalid requests and synthetic logs can exercise specific behavior repeatedly.
- **Strong local-data story:** Research logs and context use ASU-hosted inference rather than a public commercial endpoint.
- **Expansion path:** Phoenix profiles, lab templates, policy refreshes, module discovery, and administrator analytics can follow the MVP.

## Weaknesses and risks

- **Cluster policy changes:** Partitions, QoS, modules, and limits can drift.
- **Account-specific access:** Public documentation cannot reveal every user's entitlements.
- **Diagnosis ambiguity:** Exit codes and errors may have multiple causes.
- **Model latency:** A previous long critic call took over two minutes.
- **Trust challenge:** Judges who operate the clusters will notice overconfident or incorrect claims quickly.
- **Scope pressure:** Guided planning, diagnosis, UI polish, Sol testing, and pitching are ambitious for 24 hours.
- **Sensitive inputs:** Scripts and logs may contain usernames, paths, account names, or project details.

## Mitigations

- Date and cite every ASU-specific rule; separate Sol and Phoenix profiles.
- Ask users to run `myaccounts` or `myfairshare` when entitlement is unknown.
- Use confirmed, probable, and inconclusive outcomes.
- Keep slow critics outside the primary synchronous demo if benchmarking supports that choice.
- Never execute generated content or accept raw model-authored shell commands.
- Redact sensitive fields before AIR calls and do not persist raw logs.
- Prioritize one polished vertical slice and record a backup demonstration.

## Marketing position

### Category

An AI-assisted HPC readiness and failure-forensics tool for ASU researchers.

### Differentiator

Generic chatbots can write shell scripts. SolMate asks for what is missing, validates against cluster-aware rules, explains each decision, provides a safe human-run handoff, and refuses unsupported certainty.

### Value proposition

For ASU researchers who need to run computational workloads, SolMate converts workload intent into a reviewed Slurm plan and turns failure evidence into an understandable next action, using ASU AIR-hosted models and deterministic safeguards.

### Message pillars

1. **Complete before compute:** Find missing requirements before the scheduler does.
2. **Explain every request:** Make CPU, GPU, memory, time, and partition decisions understandable.
3. **Evidence before certainty:** Tie diagnoses to exact logs and metadata.
4. **Human-controlled execution:** Generate commands, never seize the terminal.
5. **Built at ASU for ASU compute:** Use AIR to improve access to Research Computing.

## Objection handling

**"Is this just a generic chatbot for Slurm?"**

No. AIR interprets and explains, while deterministic code owns completeness, policy validation, script rendering, evidence verification, and command generation.

**"Can it guarantee a job will run?"**

No, and the product says so. It validates against documented constraints and supports a real Slurm dry run; dynamic availability and account entitlement remain external.

**"Why not submit automatically?"**

Keeping submission human-controlled avoids credential collection and lets researchers review resource and cost implications before using shared infrastructure.

**"How do you know the diagnosis is right?"**

The result includes exact supplied evidence, a confidence tier, alternatives, missing metadata, and deterministic fixture results. Unsupported claims are rejected.

## Naming alternatives

- SolMate - warm, memorable, Sol-specific.
- Compute Concierge - descriptive and expandable to Phoenix.
- Slurm Sherpa - memorable but less ASU-specific and potentially too informal.
- JobSense - compact but generic.

Recommended public form: **SolMate: ASU Compute Concierge**.

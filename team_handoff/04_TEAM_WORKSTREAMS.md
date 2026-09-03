# Team Workstreams

## Shared product truth

Everyone should use the same product claim: SolMate gathers complete requirements, uses AIR for interpretation and recommendations, validates deterministically, renders a controlled Slurm script, guides a human-operated Sol handoff, and diagnoses supplied failure evidence with uncertainty.

## Engineering and AIR

**Own:** API client, intake state machine, job schema, validators, renderer, agent roles, evidence checks, mock/live modes, and tests.

**Deliver:** One stable golden path, model provenance, sanitized benchmark results, and failure states that are safe and understandable.

## UI and product design

**Own:** Guided intake, missing-field prompts, editable recommendations, confirmation state, validation errors, script review, Sol command steps, and diagnosis evidence.

**Design principle:** This is an operational research tool. Favor a compact, scannable workspace over a marketing landing page.

**Critical states:** incomplete, recommendation awaiting confirmation, invalid request, ready, AIR loading, AIR timeout, script generated, dry-run instructions, confirmed/probable/inconclusive diagnosis.

## Business and marketing

**Own:** Persona, problem framing, competitive distinction, impact language, objections, naming, and expansion path.

**Evidence to collect:** Short researcher anecdotes if permitted, estimated time lost stated as qualitative unless measured, and screenshots showing guardrails rather than only successful generation.

## Pitch and presentation

**Own:** Populate the Business Review template, reduce slide copy, add final screenshots, write speaker notes, confirm format, and rehearse transitions.

**Rule:** Every slide needs one claim. Do not turn the deck into technical documentation.

## Video and demo

**Own:** Record a stable 90-second version, capture clean cursor movement, add captions, trim waiting time, and keep an unedited evidence clip of the live AIR model response.

**Required shots:** incomplete request, AIR recommendation, user confirmation, absurd-value rejection, generated script, `sbatch --test-only` result if available, and evidence-backed diagnosis.

## Research Computing validation

**Own:** Confirm Sol access and VPN, inspect account/QoS with approved commands, validate one harmless script using `bash -n` and `sbatch --test-only`, and sanitize all captured output.

**Do not share:** passwords, Duo prompts, API keys, private paths, account identifiers, or raw sensitive logs.

## Suggested 24-hour checkpoints

- Hour 2: live AIR preflight and role-model decision.
- Hour 6: guided intake and invalid-value rejection working.
- Hour 10: script generation and diagnosis vertical slice working.
- Hour 14: UI, download, and Sol handoff integrated.
- Hour 18: tests, Sol dry run, and screenshots complete.
- Hour 20: recorded demo complete.
- Hour 22: deck and scripts locked; final two hours reserved for rehearsal and submission.


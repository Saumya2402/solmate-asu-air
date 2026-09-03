# Live AIR Critic Review of Implementation Plan

Date: 2026-09-02

## Review target

- Plan: `plans/plan_live_air_compute_concierge_20260902.md`
- Review model: `qwen3-coder-next`
- Endpoint: `https://openai.rc.asu.edu/v1/chat/completions`
- Requested and returned model IDs matched.

## Live AIR validation

| Check | Result |
|---|---|
| Minimal preflight | Passed |
| Preflight response | Exact requested text returned |
| Preflight latency | 815 ms |
| Full-plan critic call | Passed |
| Full-plan latency | 145,059 ms |
| Prompt tokens | 4,120 |
| Completion tokens | 1,825 |
| Total tokens | 5,945 |

Two earlier attempts with the AIR-hosted `gpt-oss-120b` model returned HTTP 400 after approximately 43 seconds. Removing the optional output-token parameter did not resolve that model-specific failure. A long PowerShell request to the AIR-hosted `qwen3-coder-next` model also produced a gateway body-parsing error (`model=None`); the same request succeeded through the project's Node `AirClient`, which is the AIR transport the website uses.

## Critic verdict

The AIR model returned `no_go` with seven issues. Independent adjudication changes the overall verdict to **go with required plan changes** because two alleged critical issues contradict the plan and one recommended fallback would weaken hackathon compliance.

## Finding adjudication

| Severity | AIR critic finding | Disposition | Required action |
|---|---|---|---|
| Critical | Live preflight blocks progress without a mock fallback | Rejected | The plan already includes a prerecorded live backup and explicitly forbids presenting mock output as AIR. A mock-only submission would not prove the required AIR integration. Live preflight has now passed, so this gate is satisfied. |
| Critical | Benchmark ordering creates a circular dependency | Rejected | The plan orders live preflight, client hardening, then benchmarking. Initial model defaults are already selected. No circular dependency exists. |
| Critical | Structured JSON behavior is not validated early enough | Partially valid | Add one schema-conformance probe after preflight and before broad feature work. Keep the five-case benchmark and one bounded repair attempt; requiring 100% first-attempt JSON from every candidate is unnecessarily strict. |
| Critical | Diagnosis evidence matching has no exact contract | Valid | Specify normalization, line-number handling, exact/substring matching rules, duplicate lines, empty logs, and multi-line evidence before implementing `src/diagnosis.mjs`. |
| High | Key presence lacks a dedicated preflight check | Partially valid | Live mode already fails clearly in `AirClient`, but add a fast `preflight:live` command so a missing key fails before a long request. Never print the key. |
| High | Repair rendering lacks dedicated safety acceptance tests | Valid | Add explicit repair-safety tests for changed commands, directives, filenames, and shell-quoted arguments. The existing validator and controlled renderer remain the enforcement path. |
| Medium | Encoding fix is scheduled too late | Valid with correction | Fix it during the first UI edit. The artifact is in `public/app.js`, not `public/index.html`; use ASCII separators to comply with project editing rules. |

## Additional validation gaps worth adopting

- Assert that API health and errors never expose credentials or raw upstream bodies.
- Test that fabricated diagnosis evidence is rejected.
- Test download filename sanitization and path traversal resistance.
- Record latency separately for planner, critic, and diagnostician.
- Give the live-mode indicator a stable DOM attribute that can be tested.

## Performance finding

The 145-second full-plan review is too slow for a synchronous pitch workflow. This does not disqualify `qwen3-coder-next` for shorter structured planning prompts, but long critic calls must remain offline or be tested with a faster model. The model benchmark should include end-to-end latency thresholds and stop candidates that exceed the demo budget.

## Plan status

- Phase 0 live connectivity gate: done for `qwen3-coder-next`
- Live structured-output conformance: partial; preflight tested plain text only
- Exact diagnosis evidence contract: not done
- Dedicated live preflight command: not done
- Repair-safety acceptance tests: planned generally, needs explicit cases
- Encoding correction timing/path: changed from plan
- Remaining implementation phases: not started, as expected

## Required plan fixes before implementation

1. Define exact diagnosis evidence matching and its edge-case tests.
2. Add a fast credential/model/JSON conformance command immediately after Phase 0.
3. Add explicit repair-safety and secret-redaction test cases.
4. Move the encoding correction to the first UI change and target `public/app.js`.
5. Add a latency budget per runtime role; keep long critic review off the golden-path demo unless measured performance improves.

## Overall assessment

Compliance score: **mostly complete**.

Validation status: live AIR connectivity passed with `qwen3-coder-next`; the critic review completed successfully. The plan is implementable after the five required amendments above. No application implementation was reviewed or changed in this run.

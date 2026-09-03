# AIR-primary Fact Extraction

## Objective

Ensure names, paths, files, resource counts, and MPI details are interpreted in real time by AIR rather than production regex extraction.

## Architecture change

- A dedicated AIR extractor and the AIR scientific planner now run concurrently.
- The extractor returns typed facts with minimal verbatim user quotes.
- Deterministic code verifies quote presence, field-specific evidence cues, value types, and safety; it does not derive the live value.
- Planner recommendations and critic review remain separate from fact extraction.
- The UI receives model metadata for both extractor and planner roles.

## Files changed

- `src/agent_harness.mjs`: added configurable extractor role, parallel AIR calls, compact retry, AIR-fact merge, and extractor provenance.
- `src/intake.mjs`: added AIR fact schema normalization and evidence/type validation.
- `src/mock_gateway.mjs`: added deterministic mock behavior for the extractor role.
- `tests/test_agent_harness.mjs`, `tests/test_intake.mjs`: updated role-aware gateways and added fabricated-evidence rejection.
- `README.md`: documented AIR-primary extraction and `AIR_EXTRACTOR_MODEL`.

## Validation

- `npm test`: 46 passed, zero failed or skipped.
- Exact reported transcript replayed through live `/api/intake`.
- Live AIR extractor returned `of13`, `/scratch/asurite/sparky`, 1 CPU per task, 1 GPU, 32 GB, two hours, and 16 MPI tasks.
- Verbatim evidence was returned for every accepted field.
- AIR also proposed a node value without node evidence; deterministic field-cue validation rejected it and kept nodes missing.
- Extractor latency was 8,206 ms and planner latency was 18,977 ms in the final replay; they ran concurrently.
- Live site restarted at `http://127.0.0.1:4176`.

## Remaining issues

- AIR latency remains variable and was approximately 19 seconds end to end in the final replay.
- The mock gateway uses deterministic fixture parsing by design; live mode does not use it.
- Browser automation remains unavailable for visual verification.

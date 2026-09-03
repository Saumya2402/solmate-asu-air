# Stateful AIR Intake Review

## Compliance score

Complete for the reported source-level defect. Browser automation remains an explicit validation gap.

## Findings and disposition

1. **Critical, fixed:** `AgentHarness.intake` replaced the complete extracted state with each latest extractor response. Partial AIR output therefore deleted earlier CPU, GPU, MPI, cluster, path, and job-name facts. The API now accepts prior evidence, revalidates every fact against the accumulated transcript, preserves verified omissions, and lets newer verified facts win.
2. **Critical, fixed:** the description input called `resetPlanningOutput()` before AIR succeeded. A timeout or invalid JSON therefore erased the last good form. Pending edits now leave the last good form visible, and stale asynchronous responses remain rejected by `analysisSequence`.
3. **High, fixed:** `renderIntake()` reset the form and populated only the latest AIR object. Server-side state merging now restores all verified facts, while a browser-side draft map restores deliberate user edits after rendering.
4. **High, fixed:** one live AIR extractor omitted colloquial `a CPU` and `a GPU` despite explicit prompting. An independent AIR fact auditor now runs in parallel and supplies complementary facts; all merged facts still require verbatim evidence and deterministic value validation.
5. **High, fixed:** a standalone Linux path was rejected unless its quote also contained the word `path`. The validator now accepts a safe absolute Linux path as evidence for `workingDirectory`; AIR still performs the interpretation and no path is hardcoded.
6. **High, fixed:** numeric facts previously proved only that the quote named a field, not that it supported the returned number. Numeric resources and walltime now have semantic evidence checks. Joined `of13sparky` remains rejected because that value is absent from the quoted text.
7. **Medium, verified:** `general Sol cluster` produces `cluster=sol` but cannot produce `partition=general` without partition-specific evidence. `MPI n=16` remains `tasks=16`, independent of `cpus=1`.

## AIR critic assessment

The independent AIR critic used `qwen3-coder-30b-a3b-instruct` through the ASU AIR OpenAI-compatible endpoint. It returned schema-valid JSON in 89,601 ms with verdict `revise`; the raw result is in `reviews/air_stateful_intake_critic_20260903.json`.

- Its requested tests for Sol wording, joined names/paths, MPI interpretation, standalone paths, partial extraction, and newer-value precedence now exist and pass.
- Its claim that `mergeAirFacts` has the wrong precedence is contradicted by source and regression tests: object spread applies current facts after previous facts.
- Its server race finding is not applicable because intake state is request-local and immutable. Browser responses are sequence-checked before rendering. Requests are not cancelled, so superseded calls may still consume AIR capacity, but they cannot overwrite the UI.

## Plan status

- Guided AIR interpretation and evidence validation: **done**
- Preserve valid fields across correction/retry: **done**
- Reject unsupported scheduler assumptions: **done**
- Independent AIR verification: **done**
- Deterministic mock and live model evidence: **done**
- Interactive browser walkthrough: **partial**, browser control was unavailable in this environment

## Validation

- `npm test`: 53/53 passing
- `npm run demo:mock`: passing
- Live exact-transcript probe: schema valid; all eight reported facts recovered; partition, QoS, and nodes correctly unresolved
- Live `/api/health`: mode `live`; extractor, fact auditor, planner, critic, and diagnostician configured
- Secret scan: no `sk-` key pattern found in project files
- Browser UI automation: not run because no controllable browser was available

## Residual risks

- The browser retains intake state only for the current page session; refresh intentionally loses it because the project has no database.
- The extra AIR fact-auditor call improves recall but consumes additional tokens. It runs concurrently, and the planner remained the critical-path call in the recorded live test.
- AIR output can still vary. Deterministic evidence validation prevents unsupported facts from entering the form, but omissions may still require another user retry.
- Superseded HTTP requests are ignored but not aborted; adding `AbortController` is a post-hackathon efficiency improvement.

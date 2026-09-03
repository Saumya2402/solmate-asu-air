# Fix Follow-up Feedback and JSON Recovery

## Objective

Prevent repeated follow-up submissions, provide immediate visible AIR activity, recover more reliably from malformed model JSON, and ensure the question sequence advances after an answer.

## Files changed

- `public/app.js`: locks the answer controls synchronously, appends each answer once, reports progress, preserves retry state, and returns request success to the interaction handler.
- `public/index.html`, `public/styles.css`: added an accessible follow-up status line and visible busy state.
- `src/job_spec.mjs`: replaced first-brace/last-brace parsing with balanced JSON-object extraction.
- `src/agent_harness.mjs`: added a concise-output instruction, larger JSON-repair budget, compact full planner retry, answered-question filtering, and progressive OpenFOAM follow-ups.
- `src/intake.mjs`, `src/mock_gateway.mjs`: recognize common `*Foam` solver names as OpenFOAM context.
- `tests/test_job_spec.mjs`, `tests/test_agent_harness.mjs`: added multiple-object, truncated-object, malformed-retry, and progressive-question regressions.

## Commands run

- `npm test`
- Live HTTP replay of the exact OpenFOAM plus `pimpleFoam`/500,000-cell text shown in the report.
- Restarted `npm run start:live` on port 4176.
- Checked live health and verified the updated page contains the follow-up status control.

## Results

- 42 tests pass with zero failures or skips.
- The exact reported payload completed through live AIR in 11,696 ms and retained 1 CPU, 1 GPU, 32 GB, and two hours.
- Repeated clicks are blocked before network activity begins; retry does not duplicate the saved answer.
- Existing identical follow-up paragraphs from the earlier UI are collapsed before the next submission.
- Balanced extraction tolerates a valid JSON object followed by extra model output.
- A failed parse and failed repair trigger one fresh compact planner request.
- Solver and mesh questions are removed once answered; a GPU-enabled-build decision becomes the next question for the reported case.
- The updated live site is running at `http://127.0.0.1:4176`.

## Remaining issues

- Browser automation was unavailable, so click behavior is covered by code review and server/test validation rather than a Playwright run.
- AIR latency remains variable; the busy state now makes that wait explicit.
- Human-operated `sbatch --test-only` on Sol remains outstanding.

# Follow-up Scheduler Recommendation Stability

## Report

After the researcher answered an AIR follow-up question, the previously displayed Sol partition and QoS recommendations could disappear.

## Root Cause

- The browser sent verified facts to the next intake request but did not send the prior signed recommendation state.
- Each intake response replaced the recommendation map wholesale.
- A malformed or unavailable resource-critic response cleared every recommendation, including an exact scheduler pair that had already passed deterministic profile validation.

## Fix

- Follow-up submissions now send the prior recommendation token; ordinary description edits do not.
- The server verifies the token signature and expiration before recovering prior values.
- The harness carries only the partition/QoS pair, and only while it still matches the latest cluster, walltime, and dated scheduler profile.
- A critic outage now withholds resource and naming recommendations but retains an exact validated scheduler pair with an explicit review-unavailable message.
- The server issues a fresh signed recommendation token for the updated response.

## Validation

- `npm test`: 85/85 passed with zero skipped.
- Focused harness, server, token-security, and UI contract tests: 41/41 passed.
- Live two-turn AIR replay: first response returned `partition=public` and `qos=public`; the follow-up response retained both and returned a fresh token while reporting its critic as unavailable.
- No raw token, API key, or private research content was recorded.
- Live server restarted at `http://127.0.0.1:4176`.

## Files Changed

- `public/app.js`
- `src/agent_harness.mjs`
- `src/recommendation_token.mjs`
- `src/server.mjs`
- `tests/test_agent_harness.mjs`
- `tests/test_security_regressions.mjs`
- `tests/test_server.mjs`
- `tests/test_ui_contract.mjs`
- `README.md`
- `results/results_followup_scheduler_recommendations_20260903.json`

## Remaining Risk

AIR can still return a valid critic decision that rejects a scheduler recommendation. In that case the recommendation is intentionally removed. Changing cluster or exceeding the profile walltime also invalidates the carried pair by design.

# Accepted Suggestion State

## Objective

Make the planning and reviewed-output columns represent one consistent workflow state after successful validation and generation.

## Problem

- Confirmed AIR suggestions remained displayed as editable pending suggestions after the reviewed script appeared.
- The pre-generation missing-field message could remain visible after successful generation.
- Editing a requirement after generation left the previous reviewed script visible even though it no longer matched the form.

## Changes

- Successful generation now collapses the suggestion list into one compact accepted summary.
- The summary reports how many AIR recommendations were confirmed and included using server-validated provenance.
- The missing-field message and confirmation subtitle switch to validated wording only after the server returns a reviewed script.
- Editing any specification field invalidates and hides the stale reviewed output, restores suggestion controls, and asks for generation again.
- Editing the workload description likewise restores the advisory state while AIR reinterprets it.

## Validation

- Added UI contract coverage for accepted recommendation provenance, collapsed controls, and stale-output invalidation.
- `npm test`: 102 passed, 0 failed.
- `node --check public/app.js` passed.
- `git diff --check` passed.

## Remaining work

- Visually confirm the transition in the user's live AIR browser session after a hard refresh.

# Readiness Message Consistency Plan

## Objective

Remove contradictory generation blockers and prevent unverified AIR scheduler-limit prose from reaching the UI.

## Findings

- Intake marked `modules` missing, while browser submission normalized a blank module field to an empty array and the server accepted it.
- The browser reported only unconfirmed suggestions after generation failed, while the standing missing-fields notice remained visible and implied a second blocker.
- An exact `public/public` profile was selected, but AIR's free-text rationale incorrectly described the four-hour `htc` limit.

## Changes

1. Treat modules as an optional explicit list and normalize omission to `[]` before final validation.
2. Treat arguments as optional and normalize omission to `[]`; AIR may still recommend a script path or application arguments when supported by the workload.
3. Derive partition/QoS rationale from the validated scheduler profile and its configured walltime limit; never display AIR-authored policy numbers.
4. Present one actionable preflight message that combines unconfirmed recommendations and genuinely missing fields.
5. Add focused regression tests and rerun the full suite and mock demo.

## Guardrails

- Continue requiring confirmation or an edit for every displayed AIR recommendation.
- Do not infer module names or account entitlement.
- Do not weaken server-side job-spec validation.

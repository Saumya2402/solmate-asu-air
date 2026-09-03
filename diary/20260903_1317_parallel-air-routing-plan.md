# Parallel AIR Routing Plan

## Objective

Plan a faster and more accurate role-specific multi-model architecture using the AIR models currently exposed to the user's account.

## Work Completed

- Read the active plan, latest diary, current harness, benchmark script, role configuration, and recorded live evidence.
- Refreshed the AIR model list without printing or storing the API key.
- Identified that the existing intake already runs six calls concurrently but sends all roles to one model and gives the planner unverified raw input.
- Designed a staged parallel graph with diverse fast extraction, validated shared facts, independent planning/challenge, deterministic merge, and asynchronous deep review.
- Defined provisional model candidates and explicit benchmark gates rather than declaring untested models as defaults.
- Recorded rate-limit, key-management, cancellation, disagreement, and streaming constraints.

## Files Created

- `plans/plan_parallel_air_role_routing_20260903.md`
- `diary/20260903_1317_parallel-air-routing-plan.md`

## Validation

- Confirmed the candidate IDs through the live AIR `/v1/models` endpoint.
- Cross-checked the proposed fallback against the existing sanitized benchmark artifact.
- No application code or runtime model assignment was changed.

## Remaining Work

Implementation requires user approval. The first task is a bounded role-specific AIR benchmark using sanitized fixtures.

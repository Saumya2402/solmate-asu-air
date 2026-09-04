# Validation Evidence

## Reproduce The Release Checks

```powershell
npm ci
npm test
npm run demo:mock
npm run build:pages
```

The HTTP diagnosis matrix needs a running API. Start mock mode in one terminal:

```powershell
npm run start:mock
```

Then run the matrix in a second terminal:

```powershell
npm run validate:diagnosis
```

For a live AIR check, load `AIR_API_KEY`, set `AIR_MODE=live`, then run:

```powershell
npm run preflight:live
npm run demo:live
```

## Current Evidence

- 133 automated tests cover planning, retained facts, recommendation confirmation, scheduler choices, Slurm rendering, diagnosis, repair limits, HTTP security, and UI contracts.
- A 24-case mock diagnosis matrix is stored in `results/results_diagnosis_mock_acceptance_20260903.json` without raw logs.
- Sanitized live planning, generation, documentation retrieval, and diagnosis evidence is stored in `results/results_asu_docs_live_acceptance_20260903.json`.
- AIR role and compatibility benchmark summaries live under `results/`; prompts and raw model responses are intentionally excluded.
- The built-in command-not-found demonstration traverses the production diagnosis route and evidence checks.
- The application checks exact-origin CORS, request body limits, cancellation, transient retries, confirmation tokens, shell escaping, secret redaction, and unsupported-evidence fallbacks.

## Accuracy Strategy

SolMate does not claim one universal accuracy percentage. Different layers have different measurable contracts:

- AIR extraction is scored on schema validity and recall of explicitly supplied fields.
- Recommendations are checked for allowed fields, supported scheduler profiles, and researcher confirmation.
- Scripts are generated only from deterministic validated structures.
- Explanations must cite exact rendered lines.
- Diagnoses must cite exact supplied evidence and only use documentation rules whose deterministic triggers are present.
- Ambiguous or unsupported cases must remain inconclusive.

## Known Limits

- Public documentation cannot determine a researcher's account entitlement or current queue availability.
- Software modules and cluster policies can change after the dated knowledge snapshot.
- Resource recommendations are starting points; researchers should inspect utilization with `seff`, `myjobs`, and related ASU tools.
- The Pages frontend depends on a separately running API. A temporary tunnel can expire.
- No automated tool can guarantee that arbitrary research software will run correctly.
- The expanded diagnosis matrix has deterministic coverage, but broad live AIR replay should be repeated when time and service capacity allow.

## Approved Claims

- SolMate uses ASU AIR-hosted models for live interpretation, critique, explanation, and diagnosis.
- Deterministic code validates model output before rendering or acting on it.
- The application does not submit jobs or collect Sol credentials.
- The documented demo is synthetic and exercises the same application path as supplied evidence.

Avoid claims such as "guaranteed fix," "perfect diagnosis," "works for every workload," "knows account permissions," or "autonomously submits jobs."

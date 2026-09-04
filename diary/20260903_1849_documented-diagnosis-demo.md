# Documented Diagnosis Demo

## Objective

Create a short, repeatable failure-forensics demonstration based on ASU Research Computing guidance. The case must use a valid rendered Slurm script and fail at application startup rather than because of malformed scheduler directives.

## Scenario

- Cluster: Sol
- Workload: Python CNN training
- Scheduler result: accepted and started
- Runtime evidence: `python: command not found`
- Accounting evidence: `FAILED`, exit code `127:0`, two-second elapsed time
- Expected diagnosis: `COMMAND_NOT_FOUND_OR_MODULE`

ASU's Slurm script documentation maps exit code 127 to command not found. ASU's software documentation states that modules are not loaded by default, and the Python environment guide documents loading `mamba/latest` and activating the intended environment inside the batch workflow.

## Implementation

- Added a synthetic demo builder that renders its script through the normal controlled Slurm renderer.
- Added a read-only API route for retrieving the labeled demo inputs.
- Added a compact **Load documented demo** control to the failure tab.
- The control populates the script, exact stderr, and scheduler metadata, then waits for the user to click **Diagnose with AIR**. It does not precompute or bypass the diagnosis.
- Loading the demo clears stale metadata and any previous diagnosis result.
- Added failure-category retrieval terms so a Python environment failure surfaces the relevant ASU software and mamba pages instead of only generic scheduler pages.
- The public demo payload does not expose the expected diagnosis category.
- Updated the team storyboard and finalist script to use the same exit-127 narrative.

## Validation

- JavaScript syntax checks passed.
- Full test suite passed 124/124.
- The demo API returned the expected category with confirmed confidence, accepted AIR evidence, four documentation sources, and two redactions.
- The 24-case mock diagnosis acceptance matrix passed 24/24 against the fresh server.
- Browser screenshot verification was unavailable in this session; static UI contracts and live HTTP behavior were verified.

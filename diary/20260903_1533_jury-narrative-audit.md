# Jury Narrative Audit

## Objective

Make every jury-visible explanation consistent with the project's exclusive use of ASU AIR-hosted models for application inference and model-assisted product behavior.

## Scope

- Audited tracked Markdown, JSON, configuration, browser text, scripts, and code comments for external development-tool attribution.
- Preserved references to ASU's Sol and Phoenix HPC clusters because they describe the product's supported computing environments.
- Preserved required AIR gateway URLs and environment-variable names where they are operationally necessary.

## Changes

- Added a concise AIR attribution section to the main README.
- Reframed the teammate FAQ around a generic chatbot comparison and AIR's specialized role.
- Labeled benchmarked model IDs as AIR-hosted throughout plans and review notes.
- Replaced provider labels with `ASU AIR gateway` in generated evidence and the scripts that create it.
- Removed obsolete credential-incident wording from historical plans and diaries.
- Removed the unchanged external slide template from the tracked jury repository while leaving the local file untouched.

## Validation

- Strict narrative scan found no external development-assistant attribution.
- The only matching `sol-high` substring is the legitimate scheduler profile ID `sol-highmem-public`.
- No product code behavior or AIR endpoint configuration was changed.

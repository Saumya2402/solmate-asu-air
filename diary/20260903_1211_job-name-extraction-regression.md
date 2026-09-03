# Job Name Extraction Regression

## Report

The phrase `job called imagev3` was not recognized by the live intake, leaving the Job name field empty even though path, memory, epochs, and workload type were extracted.

## Root Cause

The accepted language covered `name the job`, `job name should be`, `call it`, and `as job`, but not `job called`. More importantly, the conservative deterministic parser existed only in helper/mock paths; the live harness relied on AIR-returned facts and did not merge a deterministic job-name result.

## Fix

- Added a shared last-mention-wins job-name extractor to the live harness.
- Added `job called`, `job named`, `job should be called`, `call this job`, `use X as the job name`, and existing phrase variants.
- Preserved an exact source quote as extraction evidence.
- Prevented sentence punctuation and the word `name` from becoming part of the identifier.
- Updated planner and fact-extractor prompts as a secondary model aid.
- Added a bounded resource-critic schema retry because the screenshot also exposed an invalid critic response.

## Validation

- 83/83 tests passed with zero skipped.
- A regression test forces AIR fact extraction to omit the name; deterministic intake still returns `imagev3` with evidence `job called imagev3`.
- A live replay of the reported sentence returned `jobName=imagev3`, working directory `/scratch/asurite/sparkyimages`, 64 GB memory, 1000 epochs, and ML training classification.
- The live missing-field list no longer contains `jobName`.
- The resource critic remained unavailable after its bounded retry and conservatively withheld its recommendations. This is separate from job-name extraction and is not represented as fixed.
- The refreshed live site is running at `http://127.0.0.1:4176`.

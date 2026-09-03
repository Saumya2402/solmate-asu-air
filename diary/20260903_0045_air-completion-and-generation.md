# AIR Completion And Generation Repair

## Reported failures

- Job name had to be entered again.
- Output and error paths had to be manually invented.
- Partition and QoS were not selected.
- A total request of 16 CPUs for MPI n=16 became 16 CPUs per task.
- Validate and generate appeared not to work.

## Changes

- Added an AIR completion advisor for editable job name, log paths, executable, modules, args, nodes, and GPU disposition.
- Added a focused AIR scheduler advisor restricted to exact dated Sol partition/QoS profiles.
- Preserved deterministically safe completion suggestions if optional critic JSON is unavailable.
- Added MPI CPU reconciliation for the explicit N-total-CPUs because MPI-n=N construction.
- Added in-place progress, success, and error feedback beside the generation button.
- Added a one-click confirmation control while keeping every suggested field editable.
- Updated the missing-field message to distinguish genuinely unresolved fields from AIR-prefilled suggestions.

## Validation

- `npm test`: 55/55 passing.
- `npm run demo:mock`: passing.
- Live AIR intake produced all required values or suggestions with no unresolved fields.
- Live `/api/generate` returned `reviewed`, deterministic validation passed, and the script contained the expected job name, CPU-per-task, MPI tasks, and output directives.
- Live server restarted at `http://127.0.0.1:4176`.

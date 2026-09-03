# Scheduler Option Selects

## Report

Partition and QoS were editable text inputs. New users had no way to discover the supported values, and typoed or mismatched values could reach validation before being rejected.

## Fix

- Exposed the dated scheduler profiles through `GET /api/health` without exposing credentials or claiming user entitlement.
- Replaced Partition and QoS text inputs with dependent selects.
- Filtered partitions by cluster and QoS choices by the exact cluster/partition pair.
- Cleared incompatible downstream choices when a parent selection changes.
- Marked account-required QoS choices and made the account field required only for those profiles.
- Kept the existing server-side exact-pair and resource validation as the authority.

## Validation

- `npm test`: 84/84 passed with zero skipped.
- `node --check`: 25 JavaScript and ES module files passed.
- Secret scan: clean.
- Live `GET /api/health` returned nine scheduler pairs: six for Sol and three for Phoenix.
- The live server was restarted at `http://127.0.0.1:4176`.
- Browser screenshot validation was not available because no browser connection was exposed to this session. UI structure and behavior are covered by DOM contract tests.

## Files Changed

- `src/server.mjs`
- `public/index.html`
- `public/app.js`
- `tests/test_server.mjs`
- `tests/test_ui_contract.mjs`
- `README.md`
- `results/results_scheduler_options_20260903.json`

## Remaining Risk

The profile list is dated configuration, not an account entitlement lookup. A user must still verify current access and account-specific policy on the cluster.

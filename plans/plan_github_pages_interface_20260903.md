# GitHub Pages Interface Plan

## Objective

Publish a polished, responsive SolMate browser interface while keeping AIR credentials and inference on the server.

## Scope

1. Preserve the tested planning and failure-diagnosis workflows.
2. Improve the operational hierarchy, progress feedback, responsive layout, loading states, and accessibility without adding a frontend framework dependency.
3. Build relative static assets that work under a GitHub Pages project path.
4. Read a public API base URL from generated deployment configuration; never expose the AIR credential to browser code.
5. Permit cross-origin API requests only from explicitly configured HTTPS origins.
6. Deploy the static artifact from the `continued-development` branch with GitHub Actions.

## Acceptance

- Full Node test suite passes.
- The static Pages artifact builds with and without an API endpoint.
- Local page, CSS, configuration, and health endpoints return successfully.
- A disconnected Pages build clearly reports that AIR is offline and disables AIR actions.
- The deterministic mock demo and diagnosis acceptance matrix pass against a fresh server.

## Boundary

GitHub Pages cannot run the Node service. A complete public deployment therefore requires a separately hosted HTTPS SolMate API configured with the exact Pages origin. The AIR key remains only in that service environment.

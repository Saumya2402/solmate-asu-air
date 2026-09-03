# Spark Agent Instructions

## Mission

Build a reliable ASU AIR-powered prototype for the Spark Challenge. Prefer a small, tested vertical slice over broad unfinished functionality.

## Required workflow

1. Read the latest file in `plans/` and the latest entry in `diary/` before changing code.
2. Keep changes inside the approved plan. Record scope changes explicitly.
3. Use only models served by the ASU Research Computing AIR gateway for application inference.
4. Keep model roles configurable. Do not assume the largest model is best for every role.
5. Validate model output with deterministic code before rendering or using it.
6. Never execute generated Slurm or shell content from the application.
7. Run `npm test` and the smallest relevant demo after changes.
8. Create one new timestamped diary entry for each work session.
9. Record sanitized live AIR evidence for demo claims: requested/returned model, latency, schema result, and fixture result.
10. Keep model benchmark artifacts free of prompts containing private research data.

## Secrets

- Never put API keys in source code, prompts, screenshots, logs, or committed configuration.
- Read the AIR key from `OPENAI_API_KEY` on the server only.
- Keep `.env` and VS Code `chatLanguageModels.json` out of the repository.
- Rotate a key immediately if it is exposed.

## Project conventions

- Node.js ES modules; avoid dependencies unless they remove substantial risk.
- Application code belongs in `src/`, browser assets in `public/`, scripts in `scripts/`, and tests in `tests/`.
- API errors must be useful without including secrets or full upstream response bodies.
- ASU-specific scheduler claims require a cited ASU RC source or must be labeled as demo assumptions.

## Definition of done

- The mock demo is deterministic and works without credentials.
- The live demo calls `https://openai.rc.asu.edu/v1/chat/completions` with an available model ID.
- Generated job specifications are parsed, validated, and rendered by controlled code.
- Tests cover happy paths and rejected unsafe values.
- README and diary accurately describe what was and was not verified.

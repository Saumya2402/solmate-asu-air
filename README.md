# SolMate: ASU Compute Concierge

SolMate turns a plain-language research workload into a reviewed Slurm job plan, then helps diagnose failed jobs from exact evidence. Language understanding comes from ASU AI Research Platform (AIR) hosted models; deterministic code controls validation, script rendering, evidence checks, and terminal commands.

[Open the live prototype](https://saumya2402.github.io/solmate-asu-air/) | [View the pitch deck](docs/pitch/SolMate_Pitch_Deck.pdf) | [Read the submission overview](docs/SUBMISSION.md) | [Follow the product walkthrough](docs/WALKTHROUGH.md)

> The GitHub Pages interface needs the separately hosted SolMate API. If the temporary demo API is offline, run the project locally with the instructions below. AIR credentials are never stored in GitHub Pages or browser code.

## What It Does

- Interprets workload descriptions and retains only facts supported by the user's words.
- Runs independent AIR roles in parallel for extraction, typo review, completion, scheduler guidance, planning, critique, explanation, and diagnosis.
- Asks focused follow-up questions and offers editable recommendations with rationale and uncertainty.
- Explains beginner terms such as hardware queue (partition) and run policy (QoS).
- Grounds ASU-specific guidance in a dated catalog of `docs.rc.asu.edu` sources.
- Converts natural durations such as `5000 minutes` into canonical Slurm time.
- Validates resource limits, scheduler pairs, required fields, and cross-field consistency before generation.
- Renders Slurm scripts from validated structured data rather than model-authored shell text.
- Produces copyable, human-controlled commands for upload, test-only validation, submission, monitoring, and evidence collection.
- Diagnoses supplied scripts, logs, and metadata as confirmed, probable, or inconclusive, with exact evidence and relevant ASU guides.
- Stores optional sanitized outcome feedback only in the user's browser; it does not train or modify an AIR model.

SolMate never logs into Sol, executes generated commands, submits jobs, infers account permissions, or guarantees that a job will run.

## Try It Locally

Requirements: Node.js 20 or newer.

```powershell
git clone https://github.com/Saumya2402/solmate-asu-air.git
cd solmate-asu-air
git switch continued-development
npm ci
npm test
npm run start:mock
```

Open `http://127.0.0.1:4173`. Mock mode exercises the complete interface deterministically without an AIR key and is intended for development and rehearsal, not proof of live AIR inference.

## Run With AIR

Create an API key in Voyager, then load it into the current PowerShell session without writing it to a file:

```powershell
$secureAirKey = Read-Host "Paste the AIR API key" -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureAirKey)
try {
  $env:AIR_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
}
$env:AIR_BASE_URL = "https://openai.rc.asu.edu/v1"
$env:AIR_MODE = "live"
npm run preflight:live
npm run start:live
```

Open `http://127.0.0.1:4173` and confirm the header shows `LIVE AIR`. Remove the session key when finished:

```powershell
Remove-Item Env:AIR_API_KEY
```

There is no training command. SolMate uses hosted AIR inference.

## Product Walkthrough

1. Open **Plan a job** and paste the complete workload from [docs/WALKTHROUGH.md](docs/WALKTHROUGH.md).
2. Point out live model provenance, cited ASU guidance, editable recommendations, and deterministic readiness checks.
3. Generate the script, then show **Explain**, **Check**, and **Run**.
4. Open **Diagnose a failure**, choose **Load documented demo**, and run the diagnosis.
5. Show the exact `python: command not found` evidence, confidence tier, corrective action, and ASU documentation.

## How It Works

```text
Browser -> SolMate Node API -> parallel AIR roles
        -> evidence validation + dated ASU RC knowledge
        -> deterministic readiness and scheduler gates
        -> controlled Slurm renderer + AIR review
        -> human-run Sol commands

Failure evidence -> deterministic signals + AIR diagnosis
                 -> evidence/source verification
                 -> confirmed, probable, or inconclusive next action
```

The browser never receives the AIR key. Raw workloads and failure evidence are not persisted by the server. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for component boundaries, data flow, privacy, and deployment details.

## Commands

| Command | Purpose |
| --- | --- |
| `npm test` | Run the complete automated suite |
| `npm run demo:mock` | Exercise plan and generation without AIR |
| `npm run start:mock` | Start the deterministic local demo |
| `npm run preflight:live` | Verify AIR connectivity and configured models |
| `npm run start:live` | Start the local API with AIR inference |
| `npm run demo:live` | Run a live command-line acceptance flow |
| `npm run validate:diagnosis` | Run the diagnosis fixture matrix against a running API |
| `npm run benchmark:models` | Compare configured AIR model compatibility |
| `npm run benchmark:roles` | Benchmark parallel fact extraction |
| `npm run benchmark:role-suite` | Screen the nine AIR roles |
| `npm run build:pages` | Build the static GitHub Pages artifact |

## Deployment

GitHub Pages serves only the static interface. Live inference requires a separately hosted HTTPS Node API with these server-side variables:

```text
AIR_API_KEY=<server secret>
AIR_BASE_URL=https://openai.rc.asu.edu/v1
AIR_MODE=live
AIR_ALLOWED_ORIGINS=https://saumya2402.github.io
HOST=0.0.0.0
```

Set the non-secret repository variable `SOLMATE_API_BASE_URL` to the HTTPS API origin, configure Pages to use GitHub Actions, and manually run `.github/workflows/deploy-pages.yml`. A temporary tunnel is suitable for a judged demo but not production hosting.

## Evidence And Limits

The current release has 133 automated tests plus sanitized live and mock acceptance artifacts. The evidence covers intake state retention, recommendation confirmation, duration normalization, scheduler selection, script safety, role routing, failure diagnosis, CORS, GitHub Pages separation, and interface contracts. It does not establish universal workload accuracy or guarantee account-specific access.

See [docs/VALIDATION.md](docs/VALIDATION.md) for reproducible checks and current limitations. Historical `plans/`, `diary/`, `reviews/`, and `results/` are retained as the engineering audit trail.

## Repository Map

```text
public/       Browser interface and interaction design
src/          AIR orchestration, validation, rendering, and HTTP boundary
knowledge/    Dated ASU Research Computing rules and source links
fixtures/     Sanitized workload and failure acceptance cases
tests/        Automated behavioral, safety, security, and UI checks
scripts/      Local server, demos, benchmarks, and Pages build
docs/         Submission responses, product walkthrough, architecture, and validation
results/      Sanitized benchmark and acceptance summaries
plans/        Approved implementation plans
diary/        Timestamped implementation record
reviews/      Independent implementation and critic reviews
```

## Documentation

- [Submission overview and written responses](docs/SUBMISSION.md)
- [Pitch deck](docs/pitch/SolMate_Pitch_Deck.pdf)
- [Product walkthrough](docs/WALKTHROUGH.md)
- [Architecture and data flow](docs/ARCHITECTURE.md)
- [Validation evidence and limits](docs/VALIDATION.md)
- [ASU AIR API](https://docs.rc.asu.edu/ai/api/)
- [ASU Slurm job scripts](https://docs.rc.asu.edu/slurm-sbatch/)
- [ASU partitions and QoS](https://docs.rc.asu.edu/partitions-and-qos/)
- [ASU job statistics](https://docs.rc.asu.edu/job-statistics/)

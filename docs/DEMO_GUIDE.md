# SolMate Demo Guide

## Before Presenting

1. Open the [GitHub Pages prototype](https://saumya2402.github.io/solmate-asu-air/).
2. Confirm the header shows `LIVE AIR`, not `AIR OFFLINE` or `DEMO MODE`.
3. Keep a local live instance ready at `http://127.0.0.1:4173` as the reliable fallback.
4. Never expose an API key, username, account, private path, or raw research data on screen.

## Planning Input

This prompt is intentionally complete so the demo emphasizes interpretation and validation rather than a long interview:

```text
Train a PyTorch model on Sol with 1 GPU, 4 CPUs, 32 GB of memory, 2 hours, and 10 epochs. Name the job cnn-demo. The working directory is /scratch/asurite/solmate-demo. The executable is python and the argument is train.py. The partition is public and the QoS is public. No modules are needed. The output path is %x_%j.out and the error path is %x_%j.err.
```

Replace `asurite` only when actually testing the generated paths on Sol.

## 90-Second Product Walkthrough

1. Paste the planning input and select **Analyze with AIR**.
2. Show the progress indicator, model name, AIR interpretation, cited ASU RC guides, and recommendations.
3. Confirm recommendations if any remain. Briefly show plain-language scheduler labels and resource math.
4. Select **Validate and generate**. Show the script, exact-line explanation, environment checks, and human-controlled run steps.
5. Switch to **Diagnose a failure** and select **Load documented demo**.
6. Select **Diagnose with AIR**. Show the evidence line, `127:0` exit code, diagnosis confidence, recommended repair, and linked ASU guidance.
7. Close with: "AIR interprets the research context; deterministic safeguards decide what is safe to render and what the evidence actually supports."

## What The Failure Demo Proves

The built-in case represents a valid Slurm job that starts in a clean batch environment but cannot find Python. Its supplied evidence includes `python: command not found`, a failed state, and exit code `127:0`. It follows the same diagnosis and evidence-verification path as researcher-supplied input.

It is a synthetic, documented acceptance case. Do not describe it as a live Sol job or as universal diagnosis accuracy.

## Optional Guardrail Moment

Before generation, enter `10000000` for CPUs. SolMate should reject it with a field-specific validation message and render no script. Restore the accepted value before continuing.

## Recovery Plan

- **Pages says AIR OFFLINE:** switch to the local live URL. The temporary public API tunnel may have expired.
- **AIR request times out:** retry once, then use the recorded demo. Do not call mock output live inference.
- **A recommendation is uncertain:** leave it visible and explain that SolMate requires researcher confirmation.
- **The diagnosis is inconclusive:** celebrate the behavior. Refusing an unsupported cause is an intentional safety result.

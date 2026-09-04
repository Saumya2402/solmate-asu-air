# Product Walkthrough

This walkthrough exercises the two complete SolMate workflows without using private research data.

## Plan A Job

Paste this workload into **Plan a job**:

```text
Train a PyTorch model on Sol with 1 GPU, 4 CPUs, 32 GB of memory, 2 hours, and 10 epochs. Name the job cnn-demo. The working directory is /scratch/asurite/solmate-demo. The executable is python and the argument is train.py. The partition is public and the QoS is public. No modules are needed. The output path is %x_%j.out and the error path is %x_%j.err.
```

Replace `asurite` with the appropriate ASU identifier only when testing paths on Sol.

Select **Analyze with AIR**. The result shows the active AIR model, interpreted workflow, extracted facts, relevant ASU Research Computing sources, and any editable recommendations. Review and confirm recommendations before selecting **Validate and generate**.

The reviewed output contains four views:

- **Script:** the deterministically rendered Slurm script.
- **Explain:** AIR teaching notes tied to exact script lines.
- **Check:** environment and resource checks to complete before submission.
- **Run:** human-controlled commands for syntax checks, `sbatch --test-only`, submission, monitoring, and utilization review.

## Diagnose A Failure

Open **Diagnose a failure** and select **Load documented demo**. The supplied synthetic case represents a valid Slurm job that starts in a clean batch environment but cannot find Python. Its evidence includes `python: command not found`, a failed scheduler state, and exit code `127:0`.

Select **Diagnose with AIR**. SolMate returns:

- the diagnosis category and confidence tier;
- exact supporting log or metadata evidence;
- deterministic evidence-validation status;
- bounded corrective actions and alternatives;
- relevant ASU Research Computing guides; and
- a researcher, monitoring, resolved, or support disposition.

The documented case follows the same diagnosis and evidence-verification path as researcher-supplied input. It is synthetic and is not presented as a live Sol job or universal accuracy result.

## Safety Check

To observe deterministic validation, enter `10000000` for CPUs before generation. SolMate rejects the request with a field-specific message and renders no script. Restore an appropriate value to continue.

const PHASES = new Set(["submission", "pending", "running", "finished"]);

export function buildFailureEvidenceGuide({ jobId = "", phase = "finished" } = {}) {
  if (!PHASES.has(phase)) throw new Error("phase must be submission, pending, running, or finished.");
  const normalizedJobId = String(jobId || "").trim();
  if (phase !== "submission" && !/^\d{1,20}$/.test(normalizedJobId)) throw new Error("Job ID must contain only digits.");

  const docs = {
    jobs: "https://docs.rc.asu.edu/helpful-slurm-commands/",
    stats: "https://docs.rc.asu.edu/job-statistics/",
    scripts: "https://docs.rc.asu.edu/slurm-sbatch/",
  };
  if (phase === "submission") return {
    phase,
    commands: [
      { id: "inspect", label: "Inspect the first lines", command: "head -n 20 your-script.sbatch", source: docs.scripts },
      { id: "test", label: "Validate without submitting", command: "sbatch --test-only your-script.sbatch", source: docs.scripts },
      { id: "accounts", label: "List available accounts and policies", command: "myaccounts", source: docs.jobs },
    ],
    notice: "Replace your-script.sbatch with the real filename. These commands inspect or validate; they do not submit a job.",
  };

  const commands = [{ id: "queue", label: "Current queue state", command: "myjobs", source: docs.jobs }];
  if (phase === "pending") commands.push({ id: "pending", label: "Pending reason and start estimate", command: `thisjob ${normalizedJobId}`, source: docs.jobs });
  if (phase === "finished") {
    commands.push({ id: "efficiency", label: "Completed-job efficiency", command: `seff ${normalizedJobId}`, source: docs.stats });
    commands.push({ id: "accounting", label: "State and allocation evidence", command: `sacct --jobs=${normalizedJobId} --format=JobID,JobName%28,State,ExitCode,Elapsed,ReqMem,MaxRSS,AllocTRES%40 --parsable2`, source: docs.stats });
  }
  return {
    phase,
    commands,
    notice: phase === "running"
      ? "Use myjobs for current state. ASU notes that seff and sacct resource statistics are not reliable while a job is running."
      : "Paste the relevant command output and the earliest error lines below. The job ID is used only by the local command builder; it is not stored or sent to AIR.",
  };
}

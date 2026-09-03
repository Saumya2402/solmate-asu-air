const ASURITE = /^[a-z][a-z0-9]{2,31}$/i;
const FILE = /^(?!-)[A-Za-z0-9][A-Za-z0-9._-]{0,79}\.slurm$/;
const LOCAL_PATH = /^(?!.*[\r\n\0;&|`$<>"'])[^\r\n\0]{1,240}$/;
const REMOTE_PATH = /^\/(?:home|scratch)\/[A-Za-z0-9._/-]{1,220}$/;

export function buildSolHandoff({ asurite, localPath = "", remoteDirectory, filename, transferMode = "upload", jobId = "", acknowledged = false }) {
  const errors = [];
  if (!ASURITE.test(asurite || "")) errors.push("ASURITE must contain only letters and numbers.");
  if (!FILE.test(filename || "")) errors.push("filename must be a safe .slurm filename.");
  if (!["upload", "present", "portal"].includes(transferMode)) errors.push("transferMode must be upload, present, or portal.");
  if (transferMode === "upload" && !LOCAL_PATH.test(localPath || "")) errors.push("localPath is missing or contains unsafe shell characters.");
  if (jobId && !/^\d{1,20}$/.test(jobId)) errors.push("jobId must contain only digits.");
  if (!REMOTE_PATH.test(remoteDirectory || "") || /\.\./.test(remoteDirectory || "")) {
    errors.push("remoteDirectory must be an absolute /home or /scratch path without traversal.");
  }
  if (errors.length) return { valid: false, errors, steps: [] };
  const remoteFile = `${remoteDirectory.replace(/\/$/, "")}/${filename}`;
  const transferSteps = transferMode === "upload"
    ? [{ id: "upload", label: "Upload from your local terminal", command: `scp "${localPath}" ${asurite}@sol.asu.edu:${remoteFile}` }]
    : transferMode === "portal"
      ? [{ id: "portal", kind: "link", label: "Open the Sol web portal and upload the script", command: "https://sol.asu.edu" }]
      : [];
  const resolvedJobId = jobId || "<jobid>";
  return {
    valid: true,
    errors: [],
    submissionRequired: true,
    acknowledged: acknowledged === true,
    steps: [
      ...transferSteps,
      { id: "login", label: "Connect to Sol", command: `ssh ${asurite}@sol.asu.edu` },
      { id: "navigate", label: "Open the working directory", command: `cd ${remoteDirectory}` },
      { id: "accounts", label: "Check available accounts and QoS", command: "myaccounts" },
      { id: "fairshare", label: "Check fairshare context", command: "myfairshare" },
      { id: "syntax", label: "Check Bash syntax", command: `bash -n ${filename}` },
      { id: "dry-run", label: "Ask Slurm to validate without queueing", command: `sbatch --test-only ${filename}` },
      ...(acknowledged === true ? [{ id: "submit", label: "Submit after review", command: `sbatch ${filename}`, requiresAcknowledgement: true }] : []),
      { id: "monitor", label: "Monitor jobs", command: "myjobs" },
      { id: "inspect", label: "Inspect one job", command: `scontrol show job ${resolvedJobId}`, unresolved: !jobId },
      { id: "cancel", label: "Cancel this job", command: `scancel ${resolvedJobId}`, unresolved: !jobId, destructive: true },
      { id: "summary", label: "Collect completed-job evidence", command: `sacct -j ${resolvedJobId} --format=JobID,State,ExitCode,Elapsed,MaxRSS,ReqMem,AllocTRES`, unresolved: !jobId },
      { id: "efficiency", label: "Review efficiency", command: `seff ${resolvedJobId}`, unresolved: !jobId },
    ],
  };
}

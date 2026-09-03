export const completeSpec = {
  cluster: "sol", workloadType: "ml_training", jobName: "image-training",
  workingDirectory: "/scratch/demo/project", cpus: 8, gpus: 1, memoryGb: 32,
  walltime: "02:00:00", partition: "public", qos: "public",
  outputPath: "slurm.%j.out", errorPath: "slurm.%j.err", modules: ["python", "cuda"],
  executable: "python", args: ["train.py", "--epochs", "10"], epochs: 10,
  rationale: "A small single-GPU training run provides a measurable starting point."
};

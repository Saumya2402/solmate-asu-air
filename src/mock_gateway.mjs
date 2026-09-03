import { normalizeExplicitFacts } from "./intake.mjs";
import { deterministicScriptExplanations } from "./newcomer_guidance.mjs";

export class MockGateway {
  async chat({ model, messages }) {
    const system = messages.find((message) => message.role === "system")?.content || "";
    const prompt = messages.at(-1)?.content || "";
    const metadata = { model, latencyMs: 12, usage: { prompt_tokens: 120, completion_tokens: 80, total_tokens: 200 } };

    if (system.includes("real-time workload fact extractor")) {
      const workloadType = /open\s*foam|(?:simple|pimple|ico|rho|inter|buoyant)[A-Za-z]*Foam/i.test(prompt) ? "simulation" : /train|pytorch|epoch/i.test(prompt) ? "ml_training" : "general";
      const extracted = normalizeExplicitFacts(prompt, {}, workloadType);
      const facts = Object.entries(extracted)
        .filter(([field, value]) => field !== "workloadType" && value !== undefined)
        .map(([field, value]) => ({ field, value, quote: prompt }));
      return { ...metadata, content: JSON.stringify({ facts }) };
    }
    if (system.includes("typo reviewer")) {
      const corrections = [
        ...correction(prompt, /\bOpenFom\b/i, "OpenFOAM", "software"),
        ...correction(prompt, /\bsimualtion\b/i, "simulation", "language"),
        ...correction(prompt, /\bPytroch\b/i, "PyTorch", "software"),
      ];
      return { ...metadata, content: JSON.stringify({ corrections }) };
    }
    if (system.includes("specification completion advisor")) {
      const input = JSON.parse(prompt);
      const description = input.description || "";
      const cluster = /\bphoenix\b/i.test(description) ? "phoenix" : /\bsol\b/i.test(description) ? "sol" : null;
      const explicitName = description.match(/\b(?:job\s+name\s+(?:should\s+be|is|=|:)|name\s+(?:the\s+)?job(?:\s+as)?|as\s+(?:the\s+)?job)\s+["']?([A-Za-z0-9][A-Za-z0-9._-]{0,63})/i)?.[1];
      const jobName = /open\s*foam|[A-Za-z]+Foam/i.test(description) ? "openfoam-job" : "research-job";
      const profile = input.supportedSchedulerProfiles?.find((item) => item.cluster === cluster && item.partition === "public" && item.qos === "public");
      const parallelOpenFoam = /open\s*foam|[A-Za-z]+Foam/i.test(description) && /mpi|ranks?|tasks?|n\s*=\s*[2-9]/i.test(description);
      const recommendation = (field, value, rationale, tuningAdvice) => ({ field, value, rationale, uncertainty: "low", assumptions: ["This is an editable starting value."], tuningAdvice });
      const recommendations = [
        ...(!explicitName ? [recommendation("jobName", jobName, "AIR derived a safe descriptive label from the detected workload.", "Rename it if your project uses another naming convention.")] : []),
        recommendation("outputPath", "%x.%j.out", "Slurm substitutions keep output associated with the job name and job ID.", "Verify the filename after the first submission."),
        recommendation("errorPath", "%x.%j.err", "Slurm substitutions keep errors associated with the job name and job ID.", "Verify the filename after the first submission."),
        ...(/\b(?:simple|pimple|ico|rho|inter|buoyant)[A-Za-z]*Foam\b/i.test(description) ? [recommendation("executable", description.match(/\b(?:simple|pimple|ico|rho|inter|buoyant)[A-Za-z]*Foam\b/i)[0], "The named OpenFOAM solver is the intended application executable.", "Verify that the executable is available in the loaded environment.")] : []),
        recommendation("modules", [], "No environment module was stated, so AIR will not invent one.", "Add the verified OpenFOAM module if the executable is not already available."),
        recommendation("args", parallelOpenFoam ? ["-parallel"] : [], parallelOpenFoam ? "Parallel OpenFOAM requires the solver's -parallel argument after case decomposition." : "No additional command arguments were stated in the workload.", "Add case-specific arguments if the solver requires them."),
        ...(/open\s*foam|[A-Za-z]+Foam/i.test(description) ? [recommendation("gpus", 0, "Standard OpenFOAM profiling uses CPU and MPI unless a GPU build is verified.", "Change this only for a verified GPU-enabled solver.")] : []),
        ...(/\bmpi\b/i.test(description) ? [recommendation("nodes", 1, "A one-node MPI profiling run avoids assuming multi-node scaling efficiency.", "Measure scaling before increasing the node count.")] : []),
        ...(profile ? [
          recommendation("partition", profile.partition, "This exact Sol profile is present in the supplied scheduler rules.", "Confirm availability for your account before submission."),
          recommendation("qos", profile.qos, "This QoS is paired with the selected partition in the supplied scheduler rules.", "Confirm entitlement with the account tools before submission."),
        ] : []),
      ];
      return { ...metadata, content: JSON.stringify({ recommendations }) };
    }
    if (system.includes("scheduler-profile selector")) {
      const input = JSON.parse(prompt);
      const profile = input.supportedSchedulerProfiles?.find((item) => item.cluster === "sol" && item.partition === "public" && item.qos === "public");
      return { ...metadata, content: JSON.stringify(profile ? { partition: profile.partition, qos: profile.qos, reason: "The documented public profile supports this general Sol workload." } : { partition: null, qos: null, reason: "No supplied profile applies." }) };
    }
    if (system.includes("scientific-computing planner") || system.includes("HPC intake assistant")) {
      const ml = /train|pytorch|epoch/i.test(prompt);
      const openfoam = /open\s*foam/i.test(prompt) || /\b(?:simple|pimple|ico|rho|inter|buoyant)[A-Za-z]*Foam\b/i.test(prompt);
      const simulation = openfoam || /\bsimulation\b|\bcfd\b/i.test(prompt);
      const distributed = /\bmpi\b|\branks?\b|\bmultiple nodes\b|\bacross\s+\w+\s+nodes\b/i.test(prompt);
      const jobName = prompt.match(/\b(?:name\s+(?:the\s+)?job(?:\s+as)?|as\s+(?:the\s+)?job)\s+["']?([A-Za-z0-9][A-Za-z0-9._-]{0,63})["']?/i)?.[1] || null;
      const corrections = [
        ...correction(prompt, /\bOpenFom\b/i, "OpenFOAM", "software"),
        ...correction(prompt, /\bsimualtion\b/i, "simulation", "language"),
        ...correction(prompt, /\bPytroch\b/i, "PyTorch", "software"),
      ];
      return { ...metadata, content: JSON.stringify({
        workloadType: simulation ? "simulation" : ml ? "ml_training" : distributed ? "distributed" : "general",
        software: openfoam ? "OpenFOAM" : ml ? "PyTorch" : null,
        workflowSummary: openfoam ? "Run an OpenFOAM CFD simulation on the selected ASU cluster." : ml ? "Train a PyTorch model using a scheduled accelerator job." : "Run a general research-computing workload.",
        recommendationBasis: openfoam ? "Solver, mesh scale, and parallel strategy determine useful CPU and memory sizing." : "A small profiling allocation provides measurements for the next request.",
        corrections,
        nextQuestion: openfoam ? "Which OpenFOAM solver and approximately how many mesh cells will this case use?" : "What input size and executable should this workload use?",
        extracted: { workloadType: simulation ? "simulation" : ml ? "ml_training" : distributed ? "distributed" : "general", cluster: /phoenix/i.test(prompt) ? "phoenix" : /sol/i.test(prompt) ? "sol" : null, jobName },
        extractedEvidence: jobName ? [{ field: "jobName", quote: prompt.match(/\b(?:name\s+(?:the\s+)?job(?:\s+as)?|as\s+(?:the\s+)?job)\s+[A-Za-z0-9][A-Za-z0-9._-]{0,63}/i)?.[0] }] : [],
        missingFields: ["cpus", "gpus", "memoryGb", "walltime", "partition", "qos"],
        recommendations: [
          { field: "cpus", value: ml ? 8 : 4, rationale: "A small profiling allocation is a practical starting point for this workload.", uncertainty: "medium", assumptions: ["The first run is intended for profiling."], tuningAdvice: "Compare elapsed time and CPU efficiency before increasing cores." },
          { field: "memoryGb", value: ml ? 32 : 16, rationale: "This is a conservative starting point that should be refined using measured usage.", uncertainty: "high", assumptions: ["Input scale is not yet known."], tuningAdvice: "Use MaxRSS from sacct or seff to resize memory with headroom." },
          { field: "gpus", value: ml ? 1 : 0, rationale: ml ? "One accelerator is a modest training baseline." : "The description does not establish a GPU requirement.", uncertainty: "medium", assumptions: ["The software supports the selected accelerator path."], tuningAdvice: "Inspect accelerator utilization before requesting additional GPUs." }
        ],
        domainQuestions: openfoam ? ["Which OpenFOAM solver and case directory should run?", "Should the case run serially or with MPI?", "What is the mesh or cell count?"] : [],
        detectedConflicts: openfoam && /\b[1-9]\d*\s*gpus?\b/i.test(prompt) ? [{ field: "gpus", severity: "warning", message: "Confirm that this OpenFOAM solver and build support GPU execution; standard workflows commonly use CPU/MPI resources." }] : []
      }) };
    }
    if (system.includes("Slurm diagnostician")) {
      const input = JSON.parse(prompt);
      const finding = input.deterministicFindings[0];
      const fallbackLine = input.log.split("\n").findIndex((line) => line.trim()) + 1;
      return { ...metadata, content: JSON.stringify({
        category: finding?.category || "UNKNOWN",
        confidence: finding?.confidence || "inconclusive",
        ruleId: finding?.ruleId || null,
        evidence: finding?.evidence || [{ lineNumber: fallbackLine, text: input.log.split("\n")[fallbackLine - 1].trim() }],
        explanation: finding?.explanation || "The supplied evidence does not identify a unique documented cause.",
        alternatives: finding ? [] : ["Application-specific failure"],
        missingEvidence: finding ? [] : ["Slurm state and sacct output"],
        recommendations: finding ? ["Review the cited evidence and applicable ASU guidance before changing the script."] : ["Collect sacct and seff output."],
        patch: null
      }) };
    }
    if (system.includes("resource-recommendation critic") || system.includes("job-recommendation critic")) {
      const input = JSON.parse(prompt);
      return { ...metadata, content: JSON.stringify({
        verdict: "approve",
        reviews: input.recommendations.map((item) => ({ field: item.field, decision: "approve", reason: "The recommendation is explicitly framed as a measured starting point with visible assumptions." })),
        findings: ["Each accepted value remains advisory and must be confirmed by the researcher."],
        profilingProfile: "none"
      }) };
    }
    if (system.includes("valid JSON object preserving")) return { ...metadata, content: prompt };
    if (system.includes("Slurm teacher")) {
      const { script } = JSON.parse(prompt);
      return { ...metadata, content: JSON.stringify({ explanations: deterministicScriptExplanations(script) }) };
    }
    return { ...metadata, content: JSON.stringify({
      verdict: "review",
      findings: [{ message: "The specification passes deterministic validation.", basis: "validation", source: null }],
      recommendations: [{ message: "Run sbatch --test-only before submission.", basis: "validation", source: null }]
    }) };
  }
}

function correction(text, pattern, suggested, category) {
  const original = text.match(pattern)?.[0];
  return original ? [{ original, suggested, category, confidence: "high", requiresConfirmation: false }] : [];
}

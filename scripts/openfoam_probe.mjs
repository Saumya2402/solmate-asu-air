import { AirClient } from "../src/air_client.mjs";
import { AgentHarness } from "../src/agent_harness.mjs";
import { asuRules } from "../src/knowledge.mjs";

const prompt = process.env.SOLMATE_PROBE_PROMPT
  || "I want to run an OpenFoam simulation with 32gb memory, 1cpu, 1gpu for 2 hours, on the general sol cluster. name the job openfoam_v13_naca0012";
const harness = new AgentHarness({ gateway: new AirClient({ retries: 0 }), schedulerProfiles: asuRules.profiles });
const result = await harness.intake(prompt);

console.log(JSON.stringify({
  agent: result.agent,
  agents: result.agents,
  analysis: result.analysis,
}, null, 2));

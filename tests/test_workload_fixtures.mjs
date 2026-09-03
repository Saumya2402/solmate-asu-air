import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { AgentHarness } from "../src/agent_harness.mjs";
import { asuRules } from "../src/knowledge.mjs";
import { MockGateway } from "../src/mock_gateway.mjs";
import { validateJobSpec } from "../src/job_spec.mjs";

const cases = JSON.parse(await readFile(new URL("../fixtures/workload_cases.json", import.meta.url), "utf8"));

test("all complete workload fixtures pass deterministic generation validation", () => {
  const complete = cases.filter((item) => item.spec);
  assert.ok(complete.length >= 5);
  for (const item of complete) assert.equal(validateJobSpec(item.spec, { requireComplete: true }).valid, true, item.id);
});

test("all workload fixtures traverse deterministic mock intake", async () => {
  const harness = new AgentHarness({ gateway: new MockGateway(), schedulerProfiles: asuRules.profiles });
  for (const item of cases) {
    const result = await harness.intake(item.description);
    assert.equal(result.analysis.workloadType, item.expectedType, item.id);
    assert.equal(result.analysis.extracted.cluster, item.expectedCluster, item.id);
    if (item.expectsMissingFields) assert.ok(result.analysis.missingFields.length > 0, item.id);
  }
});

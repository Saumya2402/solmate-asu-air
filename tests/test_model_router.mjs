import assert from "node:assert/strict";
import test from "node:test";
import { configuredRoleModel, DEFAULT_ROLE_MODELS } from "../src/model_router.mjs";

test("fast AIR roles use the measured Qwen instruct default", () => {
  for (const role of ["extractor", "typo", "completion", "scheduler"]) {
    assert.equal(DEFAULT_ROLE_MODELS[role], "qwen3-30b-a3b-instruct-2507");
  }
});

test("unproven roles retain Qwen Coder and every role remains configurable", () => {
  assert.equal(DEFAULT_ROLE_MODELS.planner, "qwen3-coder-30b-a3b-instruct");
  assert.equal(configuredRoleModel("planner", { AIR_PLANNER_MODEL: "custom-air-model" }), "custom-air-model");
  assert.equal(configuredRoleModel("planner", {}), DEFAULT_ROLE_MODELS.planner);
  assert.throws(() => configuredRoleModel("unknown", {}), /Unknown AIR role/);
});

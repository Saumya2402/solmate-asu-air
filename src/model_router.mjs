const CURRENT_FALLBACK = "qwen3-coder-30b-a3b-instruct";

export const DEFAULT_ROLE_MODELS = Object.freeze({
  extractor: "qwen3-30b-a3b-instruct-2507",
  factAuditor: CURRENT_FALLBACK,
  typo: "qwen3-30b-a3b-instruct-2507",
  completion: "qwen3-30b-a3b-instruct-2507",
  scheduler: "qwen3-30b-a3b-instruct-2507",
  planner: CURRENT_FALLBACK,
  critic: CURRENT_FALLBACK,
  diagnostician: CURRENT_FALLBACK,
  explainer: CURRENT_FALLBACK,
});

const ENVIRONMENT_KEYS = Object.freeze({
  extractor: "AIR_EXTRACTOR_MODEL",
  factAuditor: "AIR_FACT_AUDITOR_MODEL",
  typo: "AIR_TYPO_MODEL",
  completion: "AIR_COMPLETION_MODEL",
  scheduler: "AIR_SCHEDULER_MODEL",
  planner: "AIR_PLANNER_MODEL",
  critic: "AIR_CRITIC_MODEL",
  diagnostician: "AIR_DIAGNOSTICIAN_MODEL",
  explainer: "AIR_EXPLAINER_MODEL",
});

export function configuredRoleModel(role, environment = process.env) {
  if (!(role in DEFAULT_ROLE_MODELS)) throw new Error(`Unknown AIR role: ${role}`);
  const configured = environment?.[ENVIRONMENT_KEYS[role]];
  return typeof configured === "string" && configured.trim() ? configured.trim() : DEFAULT_ROLE_MODELS[role];
}

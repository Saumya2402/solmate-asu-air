import { readFileSync } from "node:fs";

export const asuRules = Object.freeze(JSON.parse(
  readFileSync(new URL("../knowledge/asu_rc_rules.json", import.meta.url), "utf8"),
));

export function schedulerProfileFor(spec) {
  return asuRules.profiles.find((profile) => profile.cluster === spec.cluster
    && profile.partition === spec.partition
    && profile.qos === spec.qos) || null;
}

export function hardwareProfileFor(spec) {
  const cluster = asuRules.hardware?.[spec.cluster];
  if (!cluster) return null;
  if (spec.partition === "highmem") return cluster.highMemory || null;
  if (Number.isInteger(spec.gpus) && spec.gpus > 0) return cluster.gpu || null;
  return cluster.standard || null;
}

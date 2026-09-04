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

export function retrieveDocumentation({ text = "", spec = {}, kind = "intake", limit = 4 } = {}) {
  const documents = Array.isArray(asuRules.documents) ? asuRules.documents : [];
  const query = `${text} ${Object.values(spec || {}).flat().join(" ")}`.toLowerCase();
  const tokens = new Set(query.match(/[a-z0-9_-]+/g) || []);
  const defaults = {
    intake: ["partitions-and-qos", "slurm-sbatch"],
    generation: ["slurm-sbatch", "helpful-slurm-commands", "job-statistics"],
    diagnosis: ["job-states", "job-statistics", "helpful-slurm-commands"],
  }[kind] || [];
  const defaultRank = new Map(defaults.map((id, index) => [id, defaults.length - index]));
  return documents
    .map((document) => {
      assertDocumentationEntry(document);
      const topicScore = document.topics.reduce((score, topic) => score + (query.includes(topic.toLowerCase()) || tokens.has(topic.toLowerCase()) ? 3 : 0), 0);
      return { document, score: topicScore + (defaultRank.get(document.id) || 0) };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.document.id.localeCompare(right.document.id))
    .slice(0, Math.max(1, Math.min(6, Number(limit) || 4)))
    .map(({ document }) => ({ id: document.id, title: document.title, url: document.url, summary: document.summary }));
}

export function documentationSource(id) {
  const document = (asuRules.documents || []).find((item) => item.id === id);
  if (!document) return null;
  assertDocumentationEntry(document);
  return { id: document.id, title: document.title, url: document.url, summary: document.summary };
}

export function schedulerUiKnowledge() {
  return {
    glossary: asuRules.schedulerGlossary || {},
    optionDescriptions: asuRules.schedulerOptionDescriptions || {},
  };
}

function assertDocumentationEntry(document) {
  if (!document || typeof document.id !== "string" || typeof document.title !== "string" || typeof document.summary !== "string") {
    throw new Error("ASU RC documentation entry is invalid.");
  }
  const url = new URL(document.url);
  if (url.protocol !== "https:" || url.hostname !== "docs.rc.asu.edu") throw new Error("ASU RC documentation URL is not allowed.");
  if (!Array.isArray(document.topics) || !document.topics.every((topic) => typeof topic === "string")) throw new Error("ASU RC documentation topics are invalid.");
}

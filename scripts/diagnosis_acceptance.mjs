import { readFile, writeFile } from "node:fs/promises";

const baseUrl = process.env.DIAGNOSIS_BASE_URL || "http://127.0.0.1:4173";
const outputPath = process.env.DIAGNOSIS_RESULT_PATH || "";
const fixtures = JSON.parse(await readFile(new URL("../fixtures/failure_cases.json", import.meta.url), "utf8"));
const results = [];

for (const fixture of fixtures) {
  const started = Date.now();
  const response = await fetch(`${baseUrl}/api/diagnose`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cluster: fixture.cluster, log: fixture.log, metadata: fixture.metadata }),
  });
  const payload = await response.json();
  const diagnosis = payload.diagnosis || {};
  const categoryPass = fixture.expectedCategory
    ? diagnosis.category === fixture.expectedCategory
    : diagnosis.ruleId == null && diagnosis.confidence !== "confirmed";
  results.push({
    fixture: fixture.id,
    expectedCategory: fixture.expectedCategory || "NO_CONFIRMED_RULE",
    status: response.status,
    category: diagnosis.category || null,
    confidence: diagnosis.confidence || null,
    ruleId: diagnosis.ruleId || null,
    disposition: payload.disposition?.id || null,
    airAccepted: payload.diagnosisValidation?.airAccepted ?? null,
    model: payload.agent?.model || null,
    latencyMs: payload.agent?.latencyMs ?? Date.now() - started,
    pass: response.ok && categoryPass,
  });
}

const artifact = {
  checkedAt: new Date().toISOString(),
  baseUrl,
  rawEvidenceStored: false,
  total: results.length,
  passed: results.filter((item) => item.pass).length,
  results,
};
if (outputPath) await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(JSON.stringify(artifact, null, 2));
if (artifact.passed !== artifact.total) process.exitCode = 1;

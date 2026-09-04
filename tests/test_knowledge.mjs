import test from "node:test";
import assert from "node:assert/strict";
import { retrieveDocumentation, schedulerUiKnowledge } from "../src/knowledge.mjs";

test("documentation retrieval is relevant, bounded, and restricted to ASU RC Docs", () => {
  const sources = retrieveDocumentation({ text: "Python pip training job with memory efficiency", kind: "generation" });
  assert.ok(sources.some((source) => source.id === "python-example"));
  assert.ok(sources.some((source) => source.id === "job-statistics"));
  assert.ok(sources.length <= 4);
  for (const source of sources) assert.equal(new URL(source.url).hostname, "docs.rc.asu.edu");
});

test("scheduler UI knowledge explains unfamiliar terms", () => {
  const ui = schedulerUiKnowledge();
  assert.match(ui.glossary.partition.definition, /hardware/i);
  assert.match(ui.glossary.qos.definition, /time limits|priority/i);
  assert.match(ui.optionDescriptions.partition.htc, /four hours/i);
});

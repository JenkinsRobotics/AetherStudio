import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFindings, addedFindings } from "./shared-widget-baseline.mjs";
test("line movement is allowed but exchanging an old override for a new one is rejected", () => {
  const baseline = parseFindings("studio/src/test.css:12: .old .aui-button\n1 product rule(s)");
  assert.deepEqual(addedFindings(parseFindings("studio/src/test.css:90: .old .aui-button"), baseline), []);
  assert.deepEqual(addedFindings(parseFindings("studio/src/test.css:12: .new .aui-button"), baseline), ["studio/src/test.css: .new .aui-button"]);
});
test("duplicate additions cannot hide behind one baseline entry, and removals pass", () => {
  assert.deepEqual(addedFindings(["old", "old"], ["old"]), ["old"]);
  assert.deepEqual(addedFindings([], ["old"]), []);
});

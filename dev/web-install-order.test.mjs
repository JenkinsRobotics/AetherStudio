import { test } from "node:test";
import assert from "node:assert/strict";
import { installationOrder } from "./web-install-order.mjs";

test("installs consumers before shared dependencies and the nested engine", () => {
  const graph = { engine: [], ui: ["engine"], cad: ["engine", "ui"], map: ["ui"] };
  const order = installationOrder(Object.keys(graph).map(path => ({ path })), pkg => graph[pkg.path]).map(pkg => pkg.path);
  for (const [consumer, dependencies] of Object.entries(graph)) {
    for (const dependency of dependencies) assert.ok(order.indexOf(consumer) < order.indexOf(dependency));
  }
  assert.equal(new Set(order).size, 4);
});

test("a circular local dependency fails instead of producing a misleading install order", () => {
  assert.throws(() => installationOrder([{ path: "ui" }, { path: "app" }], pkg => pkg.path === "ui" ? ["app"] : ["ui"]), /Circular/);
});

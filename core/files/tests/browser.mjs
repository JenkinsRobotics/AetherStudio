// Real Chromium OPFS and Web Locks, two tabs, then a full browser restart.
// Dedicated temporary profile and loopback server; never uses user browser data.
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const directory = fileURLToPath(new URL("../dist/", import.meta.url));
const server = createServer(async (req, res) => {
  if (req.url === "/") {
    res.setHeader("Content-Type", "text/html");
    res.end("<!doctype html><title>Aether file acceptance</title>");
    return;
  }
  if (req.url === "/worker.js") {
    res.setHeader("Content-Type", "text/javascript");
    res.end(await readFile(new URL("./worker-fixture.mjs", import.meta.url)));
    return;
  }
  if (req.url === "/files.js") {
    res.setHeader("Content-Type", "text/javascript");
    res.end(await readFile(join(directory, "index.js")));
    return;
  }
  res.statusCode = 404;
  res.end();
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const profile = await mkdtemp(join(tmpdir(), "aether-browser-files-"));
let context;
async function open() {
  context = await chromium.launchPersistentContext(profile, { headless: true });
  const page = await context.newPage();
  await page.goto(origin);
  await setup(page);
  return page;
}
async function setup(page) {
  await page.evaluate(async () => {
    const { BrowserDocument } = await import("/files.js");
    const root = await navigator.storage.getDirectory();
    const file = await root.getFileHandle("chosen-test-file.aethermap", {
      create: true,
    });
    window.file = file;
    window.root = root;
    window.doc = new BrowserDocument(file, "test-document", {
      locks: navigator.locks,
      crypto,
      recoveryRoot: root,
    });
    window.bytes = (value) => new TextEncoder().encode(value);
  });
}
try {
  const page = await open();
  await page.evaluate(async () => {
    const current = await doc.read();
    const expected = { kind: "content", sha256: current.file.sha256 };
    await doc.save(expected, bytes("initial document"));
    const base = { kind: "content", sha256: (await doc.read()).file.sha256 };
    await doc.stageRecovery("editor-one", base, bytes("unsaved work"));
    window.original = base;
  });
  const second = await context.newPage();
  await second.goto(origin);
  await setup(second);
  const secondState = await second.evaluate(async () => ({
    text: new TextDecoder().decode((await doc.read()).content),
    drafts: (await doc.listRecovery()).drafts.length,
  }));
  assert.deepEqual(secondState, { text: "initial document", drafts: 1 });
  await page.evaluate(() => {
    window.lockHeld = false;
    window.lockPromise = navigator.locks.request(
      "aether-ordinary-files-v1",
      async () => {
        window.lockHeld = true;
        await new Promise((resolve) => {
          window.releaseLock = resolve;
        });
      },
    );
  });
  await page.waitForFunction(() => window.lockHeld);
  const busy = await second.evaluate(async () => {
    try {
      await doc.stageRecovery(
        "editor-two",
        { kind: "missing" },
        bytes("other"),
      );
      return null;
    } catch (error) {
      return error.code;
    }
  });
  assert.equal(busy, "busy");
  await page.evaluate(async () => {
    window.releaseLock();
    await window.lockPromise;
  });
  await second.evaluate(async () => {
    const writer = await file.createWritable();
    await writer.write("external newer document");
    await writer.close();
  });
  const conflict = await page.evaluate(async () => {
    try {
      await doc.save(window.original, bytes("stale overwrite"));
      return null;
    } catch (error) {
      return error.code;
    }
  });
  assert.equal(conflict, "conflict");
  await context.close();
  context = null;
  const reopened = await open();
  const restored = await reopened.evaluate(async () => {
    const candidate = await doc.recovery("editor-one");
    return {
      text: new TextDecoder().decode((await doc.read()).content),
      draft: atob(candidate.draft.content_base64),
      matches: candidate.base_matches_current_file,
      count: (await doc.listRecovery()).drafts.length,
    };
  });
  assert.deepEqual(restored, {
    text: "external newer document",
    draft: "unsaved work",
    matches: false,
    count: 1,
  });
  const recovered = await reopened.evaluate(async () => {
    const candidate = await doc.recovery("editor-one");
    // Explicit user choice to restore over the current content, not automatic.
    const expected = {
      kind: "content",
      sha256: (await doc.read()).file.sha256,
    };
    await doc.save(expected, bytes(atob(candidate.draft.content_base64)));
    const acknowledged = (await doc.recovery("editor-one"))
      .content_matches_current_file;
    await doc.discardRecovery("editor-one", candidate.draft.content);
    return {
      acknowledged,
      count: (await doc.listRecovery()).drafts.length,
      text: new TextDecoder().decode((await doc.read()).content),
    };
  });
  assert.deepEqual(recovered, {
    acknowledged: true,
    count: 0,
    text: "unsaved work",
  });
  const workerResult = await reopened.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const worker = new Worker("/worker.js", { type: "module" });
        const timeout = setTimeout(() => {
          worker.terminate();
          reject(new Error("File worker timed out"));
        }, 15000);
        worker.onmessage = ({ data }) => {
          clearTimeout(timeout);
          worker.terminate();
          resolve(data);
        };
        worker.onerror = (error) => {
          clearTimeout(timeout);
          worker.terminate();
          reject(new Error(error.message));
        };
        worker.postMessage({ file: window.file, root: window.root });
      }),
  );
  assert.equal(workerResult.ok, true);
  assert.equal(workerResult.listing.drafts[0].session_id, "worker");
  console.log(
    "Real browser file acceptance passed: two-tab locks, stale conflict, restart recovery, explicit restore/discard, worker file capabilities.",
  );
} finally {
  await context?.close();
  await new Promise((resolve) => server.close(resolve));
  await rm(profile, { recursive: true, force: true });
}

import { test } from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { BrowserDocument, MAX_DOCUMENT_BYTES } from "../dist/index.js";
const bytes = (s) => new TextEncoder().encode(s);
const text = (b) => new TextDecoder().decode(b);
const fail = (code) => (error) => error.code === code;
class Locks {
  busy = false;
  async request(_name, _options, run) {
    if (this.busy) return run(null);
    this.busy = true;
    try {
      return await run({ name: "lock" });
    } finally {
      this.busy = false;
    }
  }
}
class File {
  kind = "file";
  name = "file";
  content = bytes("original");
  aborts = 0;
  writes = 0;
  async getFile() {
    if (this.readError) throw this.readError;
    return new Blob([this.content]);
  }
  async createWritable() {
    if (this.openError) throw this.openError;
    let next;
    return {
      write: async (data) => {
        this.writes++;
        if (this.writeError) throw this.writeError;
        next = typeof data === "string" ? bytes(data) : new Uint8Array(data);
        await this.onWrite?.();
      },
      close: async () => {
        this.content = next;
        if (this.closeError) throw this.closeError;
      },
      abort: async () => {
        this.aborts++;
      },
    };
  }
}
class Directory {
  dirs = new Map();
  files = new Map();
  async getDirectoryHandle(name, { create = false } = {}) {
    if (!this.dirs.has(name)) {
      if (!create) throw new DOMException("missing", "NotFoundError");
      this.dirs.set(name, new Directory());
    }
    return this.dirs.get(name);
  }
  async getFileHandle(name, { create = false } = {}) {
    if (!this.files.has(name)) {
      if (!create) throw new DOMException("missing", "NotFoundError");
      const file = new File();
      file.content = bytes("");
      file.name = name;
      this.files.set(name, file);
    }
    return this.files.get(name);
  }
  async removeEntry(name) {
    this.files.delete(name);
  }
  async *entries() {
    for (const entry of this.files.entries()) yield entry;
  }
}
function fixture() {
  const file = new File(),
    root = new Directory(),
    locks = new Locks();
  return {
    file,
    root,
    locks,
    doc: new BrowserDocument(file, "doc-1", {
      locks,
      crypto: webcrypto,
      recoveryRoot: root,
    }),
  };
}
async function expected(doc) {
  return { kind: "content", sha256: (await doc.read()).file.sha256 };
}
function directory(root) {
  return [...[...root.dirs.values()][0].dirs.values()][0];
}

test("guarded save refuses stale content and preserves shorter replacement bytes", async () => {
  const { file, doc } = fixture();
  const base = await expected(doc);
  const receipt = await doc.save(base, bytes("new"));
  assert.equal(receipt.durability, "browser_managed");
  assert.equal(text((await doc.read()).content), "new");
  await assert.rejects(doc.save(base, bytes("stale")), fail("conflict"));
  assert.equal(file.writes, 1);
});
test("outside edit during staging aborts instead of overwriting it", async () => {
  const { file, doc } = fixture();
  const base = await expected(doc);
  file.onWrite = () => {
    file.content = bytes("outside");
  };
  await assert.rejects(doc.save(base, bytes("mine")), fail("conflict"));
  assert.equal(file.aborts, 1);
  assert.equal(text(file.content), "outside");
});
test("caller mutation cannot change the saved bytes or conflict guard", async () => {
  const { file, doc } = fixture();
  const base = await expected(doc),
    content = bytes("mine");
  const pending = doc.save(base, content);
  base.kind = "missing";
  content.fill(0);
  await pending;
  assert.equal(text(file.content), "mine");
});
test("concurrent tabs use a common lock and the second retry sees conflict", async () => {
  const { file, root, locks, doc } = fixture();
  const other = new BrowserDocument(file, "different-key", {
    locks,
    crypto: webcrypto,
    recoveryRoot: root,
  });
  const base = await expected(doc);
  let release, entered;
  const gate = new Promise((r) => {
      release = r;
    }),
    start = new Promise((r) => {
      entered = r;
    });
  file.onWrite = async () => {
    entered();
    await gate;
  };
  const first = doc.save(base, bytes("first"));
  await start;
  await assert.rejects(other.save(base, bytes("second")), fail("busy"));
  release();
  await first;
  await assert.rejects(other.save(base, bytes("second")), fail("conflict"));
});
test("write failure retains original and uncertain close requires reread", async () => {
  const { file, doc } = fixture();
  const base = await expected(doc);
  file.writeError = new DOMException("full", "QuotaExceededError");
  await assert.rejects(doc.save(base, bytes("new")), fail("quota_exceeded"));
  assert.equal(text(file.content), "original");
  assert.equal(file.aborts, 1);
  file.writeError = null;
  file.closeError = new Error("lost completion");
  await assert.rejects(
    doc.save(base, bytes("published")),
    fail("outcome_unknown"),
  );
  assert.equal(text((await doc.read()).content), "published");
});
test("permission loss, unavailable locks, deleted files and oversize input are explicit", async () => {
  const { file, doc } = fixture();
  file.readError = new DOMException("permission", "NotAllowedError");
  await assert.rejects(doc.read(), fail("permission_denied"));
  file.readError = new DOMException("gone", "NotFoundError");
  await assert.rejects(doc.read(), fail("not_found"));
  assert.throws(
    () => new BrowserDocument(file, "key", { crypto: webcrypto }),
    fail("unsupported"),
  );
  await assert.rejects(
    doc.save({ kind: "missing" }, new Uint8Array(MAX_DOCUMENT_BYTES + 1)),
    fail("too_large"),
  );
});
test("recovery persists per editor session and detects outside changes", async () => {
  const { doc, file, root, locks } = fixture();
  const base = await expected(doc);
  const staged = await doc.stageRecovery("window-one", base, bytes("unsaved"));
  await doc.stageRecovery("window-two", base, bytes("other-window"));
  file.content = bytes("outside");
  const reopened = new BrowserDocument(file, "doc-1", {
    locks,
    crypto: webcrypto,
    recoveryRoot: root,
  });
  const candidate = await reopened.recovery("window-one");
  assert.equal(candidate.base_matches_current_file, false);
  assert.equal(candidate.content_matches_current_file, false);
  assert.equal(atob(candidate.draft.content_base64), "unsaved");
  assert.equal((await reopened.listRecovery()).drafts.length, 2);
  await assert.rejects(
    reopened.discardRecovery("window-one", {
      ...staged.file,
      sha256: "0".repeat(64),
    }),
    fail("conflict"),
  );
  await reopened.discardRecovery("window-one", staged.file);
  assert.equal(await reopened.recovery("window-one"), null);
  assert.equal(text(file.content), "outside");
  assert.equal(
    (await reopened.listRecovery()).drafts[0].session_id,
    "window-two",
  );
});
test("successful save with lost caller acknowledgment is detectable without another save", async () => {
  const { doc } = fixture();
  const base = await expected(doc);
  await doc.stageRecovery("window", base, bytes("new"));
  await doc.save(base, bytes("new"));
  const recovery = await doc.recovery("window");
  assert.equal(recovery.base_matches_current_file, false);
  assert.equal(recovery.content_matches_current_file, true);
});
test("corrupt drafts are retained and separated from usable drafts", async () => {
  const { doc, root } = fixture();
  const base = await expected(doc);
  await doc.stageRecovery("good", base, bytes("good"));
  await doc.stageRecovery("bad", base, bytes("bad"));
  const damaged = directory(root).files.get("bad.json");
  const draft = JSON.parse(text(damaged.content));
  draft.content.sha256 = "0".repeat(64);
  damaged.content = bytes(JSON.stringify(draft));
  await assert.rejects(doc.recovery("bad"), fail("corrupt_recovery"));
  const listing = await doc.listRecovery();
  assert.deepEqual(listing.corrupt_sessions, ["bad"]);
  assert.equal(listing.drafts.length, 1);
  assert.ok(directory(root).files.has("bad.json"));
});
test("untitled recovery never creates a user document or silently saves", async () => {
  const { root, locks } = fixture();
  const doc = new BrowserDocument(null, "untitled", {
    locks,
    crypto: webcrypto,
    recoveryRoot: root,
  });
  await doc.stageRecovery("window", { kind: "missing" }, bytes("unsaved"));
  assert.equal((await doc.recovery("window")).base_matches_current_file, true);
  await assert.rejects(
    doc.save({ kind: "missing" }, bytes("unsaved")),
    fail("permission_denied"),
  );
});
test("quota failure while replacing a draft preserves the prior draft", async () => {
  const { doc, root } = fixture();
  const base = await expected(doc);
  await doc.stageRecovery("window", base, bytes("previous"));
  directory(root).files.get("window.json").writeError = new DOMException(
    "full",
    "QuotaExceededError",
  );
  await assert.rejects(
    doc.stageRecovery("window", base, bytes("next")),
    fail("quota_exceeded"),
  );
  assert.equal(
    atob((await doc.recovery("window")).draft.content_base64),
    "previous",
  );
});

test("binary recovery is byte-exact beyond small text fixtures", async () => {
  const { doc } = fixture();
  const data = Uint8Array.from({ length: 2 * 1024 * 1024 }, (_, i) => i % 256);
  await doc.stageRecovery("binary", await expected(doc), data);
  const candidate = await doc.recovery("binary");
  assert.deepEqual(
    Uint8Array.from(atob(candidate.draft.content_base64), (c) =>
      c.charCodeAt(0),
    ),
    data,
  );
});
test("session capacity refuses a new draft while allowing an existing draft to update", async () => {
  const { doc, root } = fixture();
  const base = await expected(doc);
  await doc.stageRecovery("first", base, bytes("draft"));
  const dir = directory(root);
  for (let i = 1; i < 128; i++) {
    const file = new File();
    file.name = `session-${i}.json`;
    dir.files.set(file.name, file);
  }
  await assert.rejects(
    doc.stageRecovery("overflow", base, bytes("next")),
    fail("too_large"),
  );
  await doc.stageRecovery("first", base, bytes("updated"));
  assert.equal(
    atob((await doc.recovery("first")).draft.content_base64),
    "updated",
  );
});

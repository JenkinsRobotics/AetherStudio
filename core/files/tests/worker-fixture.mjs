// Browser acceptance worker; real application callers should likewise keep large
// document encoding and file IO off the editor's interaction thread.
import { BrowserDocument } from "/files.js";
self.onmessage = async ({ data }) => {
  try {
    const doc = new BrowserDocument(data.file, "test-document", {
      locks: navigator.locks,
      crypto,
      recoveryRoot: data.root,
    });
    const base = { kind: "content", sha256: (await doc.read()).file.sha256 };
    await doc.stageRecovery(
      "worker",
      base,
      new TextEncoder().encode("worker draft"),
    );
    self.postMessage({ ok: true, listing: await doc.listRecovery() });
  } catch (error) {
    self.postMessage({ ok: false, error: String(error) });
  }
};

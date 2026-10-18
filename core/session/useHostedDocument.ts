import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AutosaveSession,
  readRecovery,
  recoveryKey,
  sessionOwner,
  SaveError,
  type SaveState,
} from "./autosave";
import {
  decodeDocument,
  documentRequest,
  encodeDocument,
  type HostedDocument,
} from "./documents";

/** Always-on host history for text documents. Formats stay in the product. */
export function useHostedDocument(options: {
  app: string;
  identity: string;
  text: string | null;
  name: string;
  onLoad: (text: string, file: HostedDocument | null) => void;
  onSaved?: (file: HostedDocument) => void;
}) {
  const current = useRef(options);
  current.current = options;
  const hosted =
    typeof location !== "undefined" &&
    location.pathname.startsWith(`/${options.app}/`);
  const [ready, setReady] = useState(!hosted),
    [file, setFile] = useState<HostedDocument | null>(null),
    [state, setState] = useState<SaveState>({ phase: "saved", durable: true });
  const session = useRef<AutosaveSession<HostedDocument | null> | null>(null);
  const activeIdentity = useRef<string | null>(null);
  const opening = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    if (!hosted) return;
    let disposed = false;
    setReady(false);
    setFile(null);
    const initial = current.current,
      query = new URLSearchParams(location.search),
      id = query.get("document"),
      branch = query.get("branch") ?? "Main";
    opening.current = (async () => {
      if (!id && initial.text === null) {
        if (!disposed) setReady(true);
        return;
      }
      const owner = await sessionOwner();
      const stored = id
        ? await documentRequest<HostedDocument>(initial.app, "read", {
            id,
            branch,
          })
        : null;
      if (disposed) return;
      const initialText = stored
        ? decodeDocument(stored.data_base64!)
        : initial.text!;
      const docKey = id ?? query.get("draft") ?? crypto.randomUUID();
      if (!id) {
        query.set("draft", docKey);
        history.replaceState(null, "", `${location.pathname}?${query}`);
      }
      const keyFor = (base: HostedDocument | null) =>
        recoveryKey(initial.app, owner, `${base?.id ?? docKey}:${branch}`);
      const key = keyFor(stored),
        recovery = readRecovery<HostedDocument | null>(key);
      // Parse before creating a save queue; malformed documents cannot replace valid files.
      initial.onLoad(recovery?.text ?? initialText, stored);
      const queue = new AutosaveSession<HostedDocument | null>({
        key,
        base: stored ? {id:stored.id,name:stored.name,revision:stored.revision,writable:stored.writable,branch:stored.branch,branch_id:stored.branch_id} : null,
        text: initialText,
        keyForBase: keyFor,
        save: async (text, base) => {
          if (base?.writable === false)
            throw new SaveError(
              "This document is read only. Download a copy to keep edits.",
              403,
            );
          return await documentRequest<HostedDocument>(
            initial.app,
            base ? "save" : "create",
            base
              ? {
                  id: base.id,
                  branch,
                  expected_revision: base.revision,
                  data_base64: encodeDocument(text),
                }
              : {
                  name: current.current.name,
                  kind: "file",
                  scope: "personal",
                  data_base64: encodeDocument(text),
                },
          );
        },
      });
      session.current = queue;
      activeIdentity.current = initial.identity;
      queue.subscribe((next) => {
        if (disposed) return;
        setState(next);
        setFile(queue.base);
        if (queue.base) {
          const q = new URLSearchParams(location.search);
          q.set("document", queue.base.id);
          q.delete("draft");
          q.delete("new");
          history.replaceState(null, "", `${location.pathname}?${q}`);
          current.current.onSaved?.(queue.base);
        }
      });
      if (recovery && (recovery.blocked || recovery.text !== initialText))
        queue.recover(recovery, stored?.revision !== recovery.base?.revision);
      if (!stored) queue.write(recovery?.text ?? initialText, true);
      setReady(true);
    })().catch((e) => {
      if (!disposed)
        setState({
          phase: "offline",
          durable: false,
          message: (e as Error).message,
        });
      throw e;
    });
    void opening.current.catch(() => {});
    return () => {
      disposed = true;
      session.current?.dispose();
      session.current = null;
      activeIdentity.current = null;
    };
  }, [hosted, options.app, options.identity]);
  useLayoutEffect(() => {
    if (
      ready &&
      activeIdentity.current === options.identity &&
      options.text !== null
    )
      session.current?.write(options.text);
  }, [ready, options.text, options.identity]);
  const flush = async () => {
    if (!hosted)
      throw new Error(
        "Open this app through Aether Studio to save document history.",
      );
    await opening.current;
    const queue = session.current;
    if (!queue || activeIdentity.current !== current.current.identity)
      throw new Error("Open a document first.");
    if (current.current.text !== null)
      queue.write(current.current.text, !queue.base);
    await queue.flush();
    if (queue.dirty) await queue.flush();
    if (queue.dirty) throw new Error("The document still has unsaved changes.");
  };
  const saveCopy = async () => {
    if (!hosted || current.current.text === null)
      throw new Error("Open a document in Studio first.");
    const copy = await documentRequest<HostedDocument>(
      current.current.app,
      "create",
      {
        name: current.current.name.replace(/(\.[^.]+)$/, " copy$1"),
        scope: "personal",
        kind: "file",
        data_base64: encodeDocument(current.current.text),
      },
    );
    session.current?.dispose();
    location.assign(
      `${location.pathname}?document=${encodeURIComponent(copy.id)}`,
    );
  };
  return { ready, file, state, flush, saveCopy };
}

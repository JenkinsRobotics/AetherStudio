import type { DocumentChange } from "@aether/ui/DocumentServices";

/** One read-only connection per open document; panels never own network transport. */
const subscriptions = new Map<string, { listeners: Set<(event: DocumentChange) => void>; stop: () => void; last?: DocumentChange }>();
export function subscribeDocumentChanges(app: string, id: string, listener: (event: DocumentChange) => void): () => void {
  const key = JSON.stringify([app, id]);
  let entry = subscriptions.get(key);
  if (!entry) {
    entry = { listeners: new Set(), stop: () => {} };
    subscriptions.set(key, entry);
    const owned = entry;
    // Start after the first listener is registered (also safe for unsupported browsers).
    queueMicrotask(() => {
      if (subscriptions.get(key) !== owned) return;
      owned.stop = connect(app, id, event => {
        owned.last = event;
        for (const fn of [...owned.listeners]) fn(event);
      });
    });
  }
  entry.listeners.add(listener);
  if (entry.last) listener(entry.last);
  return () => {
    entry.listeners.delete(listener);
    if (!entry.listeners.size) {
      entry.stop();
      if (subscriptions.get(key) === entry) subscriptions.delete(key);
    }
  };
}

function connect(app: string, id: string, emit: (event: DocumentChange) => void): () => void {
  let stopped = false, attempt = 0, epoch = 0;
  let account: string | null | undefined;
  let source: EventSource | undefined;
  let controller: AbortController | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const close = () => { epoch++; source?.close(); source = undefined; controller?.abort(); clearTimeout(deadline); };
  const failed = () => {
    if (stopped) return;
    close();
    emit({ kind: "unavailable" });
    clearTimeout(retry);
    retry = setTimeout(() => void start(), Math.min(30000, 1000 * 2 ** Math.min(attempt++, 5)));
  };
  const start = async () => {
    if (stopped) return;
    if (typeof EventSource === "undefined") { emit({ kind: "fallback" }); return; }
    const currentEpoch = ++epoch;
    const request = new AbortController();
    controller = request;
    deadline = setTimeout(() => request.abort(), 5000);
    try {
      const response = await fetch("/api/status", { credentials: "same-origin", signal: request.signal });
      if (!response.ok) throw new Error("Status unavailable");
      const status = await response.json();
      if (stopped || currentEpoch !== epoch) return;
      clearTimeout(deadline);
      account = typeof status?.user?.id === "string" ? status.user.id : null;
      if (status?.capabilities?.document_changes !== 1) { emit({ kind: "fallback" }); return; }
      const current = new EventSource(`/api/library/changes?${new URLSearchParams({ app, id })}`);
      source = current;
      let previous = "";
      current.addEventListener("state", event => {
        if (stopped || source !== current) return;
        try {
          const data = (event as MessageEvent).data;
          if (typeof data !== "string" || data.length > 4096) throw new Error("Invalid state");
          const value = JSON.parse(data);
          if (value?.schema !== 1 || value.document_id !== id ||
            typeof value.state_token !== "string" || !/^state-[a-f0-9]{64}$/.test(value.state_token) ||
            !Number.isSafeInteger(value.main_revision) || value.main_revision < 1 ||
            !Number.isSafeInteger(value.latest_revision) || value.latest_revision < value.main_revision ||
            !Number.isSafeInteger(value.collaboration_revision) || value.collaboration_revision < 0 ||
            typeof value.writable !== "boolean") throw new Error("Invalid state");
          attempt = 0;
          if (value.state_token === previous) return;
          previous = value.state_token;
          emit({ kind: "state", writable: value.writable });
        } catch { failed(); }
      });
      current.addEventListener("unavailable", () => { if (source === current) failed(); });
      current.onerror = () => { if (source === current) failed(); };
    } catch { if (!stopped && currentEpoch === epoch) failed(); }
  };
  const offline = () => failed();
  const online = () => { if (stopped) return; close(); clearTimeout(retry); void start(); };
  const accountChanged = (event: Event) => {
    const user = (event as CustomEvent<{id?: string} | null>).detail;
    const next = typeof user?.id === "string" ? user.id : null;
    if (account !== undefined && next !== account) failed();
    account = next;
  };
  document.addEventListener("aether-account", accountChanged);
  window.addEventListener("offline", offline);
  window.addEventListener("online", online);
  void start();
  return () => { stopped = true; clearTimeout(retry); close(); window.removeEventListener("offline", offline); window.removeEventListener("online", online); document.removeEventListener("aether-account", accountChanged); };
}

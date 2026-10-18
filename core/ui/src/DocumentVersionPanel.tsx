import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDocumentMutation } from "./useDocumentMutation";
import { DocumentCreateDialog } from "./DocumentCreateDialog";
import { AetherIcon } from "./AetherIcon";
import { IconButton } from "./IconButton";
import { Button } from "./Button";
import { Menu, type MenuItem } from "./Menu";
import { DOCUMENT_HISTORY_CHANGED, historyBranchKey, type DocumentConnection, type DocumentHistory } from "./DocumentServices";
import { DocumentHistoryGraph } from "./DocumentHistoryGraph";
import { documentHistoryGraph } from "./document-history-graph";
import "./DocumentVersionPanel.css";

type Operation = "version" | "branch" | "compare" | "merge" | null;
const stamp = (seconds: number) =>
  seconds
    ? new Date(seconds * 1000).toLocaleString(undefined, {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "";

/** Shared Onshape-style milestone history. Autosaves are recovery snapshots,
 * never commits; naming a version is an explicit, flushed editor action. */
export function DocumentVersionPanel({
  connection,
  createOnly = false,
  onCreated,
  onCancel,
  branchSource,
  branchOnly = false,
}: {
  connection: DocumentConnection;
  createOnly?: boolean;
  onCreated?: () => void;
  onCancel?: () => void;
  branchSource?: number;
  branchOnly?: boolean;
}) {
  const [disconnected, setDisconnected] = useState(false);
  const [liveWritable, setLiveWritable] = useState<boolean | undefined>();
  const liveAccess = useRef(true), historyRead = useRef(0);
  const [history, setHistory] = useState<DocumentHistory | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [selectedChange, setSelectedChange] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState(""),
    [selection, setSelection] = useState<string | null>(null);
  const [operation, setOperation] = useState<Operation>(
    createOnly ? "version" : null,
  );
  const [name, setName] = useState(""),
    [message, setMessage] = useState("");
  const [compare, setCompare] = useState(""),
    [report, setReport] = useState("");
  const [source, setSource] = useState(""),
    [conflict, setConflict] = useState<Record<string, unknown> | null>(null);
  const [recovery, setRecovery] = useState(false),
    [recoverySelection, setRecoverySelection] = useState<number | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | "toolbar" | null>(
    null,
  );
  const menuAnchor = useRef<HTMLDivElement>(null);
  const branch = connection.branch ?? "Main";
  const branchLabel = history?.branches.find(b => historyBranchKey(b) === branch)?.name ?? connection.branchLabel ?? branch;
  const stable = history?.branch_identity === "stable";
  const mutation = useDocumentMutation(connection, async (action) => {
    if (action === "restore" || action === "merge") await connection.reload();
    await load();
    setError(""); setNotice("Change confirmed."); setOperation(null);
    if (action === "version" || action === "branch_create") onCreated?.();
  }, stable);
  const writable = !disconnected && liveWritable !== false && !mutation.uncertain && connection.writable !== false && history?.writable !== false;
  const graph = useMemo(
    () => (history ? documentHistoryGraph(history) : []),
    [history],
  );
  const selected = selectedChange == null ? graph.find(
    (row) => row.id === (selection ?? `workspace:${branch}`),
  ) : undefined;
  const snapshot = recovery ? recoverySelection : (selectedChange ?? selected?.revision ?? null);
  const selectedName = recovery
    ? "automatic save"
    : selectedChange != null ? "change" : (selected?.name ?? "entry");
  const head = (h: DocumentHistory, workspace = branch) =>
    h.branches.find((b) => historyBranchKey(b) === workspace)?.head_revision;
  const load = async () => {
    const request = ++historyRead.current;
    const next = await connection.call<DocumentHistory>("history");
    if (request === historyRead.current && liveAccess.current) setHistory(next);
    return next;
  };
  useEffect(() => {
    let live = true;
    liveAccess.current = true;
    setDisconnected(false); setLiveWritable(undefined);
    setHistory(null);
    setError("");
    setNotice("");
    setSelection(null);
    setSelectedChange(null);
    setRecovery(false);
    setRecoverySelection(null);
    setOperation(createOnly ? "version" : null);
    setReport("");
    setConflict(null);
    setName("");
    setMessage("");
    setMenu(null);
    const refresh = async () => {
      if (!liveAccess.current) return;
      const request = ++historyRead.current;
      try {
        const h = await connection.call<DocumentHistory>("history");
        if (live && request === historyRead.current && liveAccess.current) setHistory(h);
      } catch (e) {
        if (live && request === historyRead.current) setError((e as Error).message);
      }
    };
    const unsubscribe = connection.subscribeChanges?.(event => {
      if (!live) return;
      const available = event.kind !== "unavailable";
      liveAccess.current = available;
      setDisconnected(!available);
      setLiveWritable(event.kind === "state" ? event.writable : undefined);
      if (available) void refresh();
      else { historyRead.current++; setHistory(null); }
    });
    const changed = (event: Event) => {
      if ((event as CustomEvent<string>).detail === connection.key) refresh();
    };
    window.addEventListener(DOCUMENT_HISTORY_CHANGED, changed);
    refresh();
    const timer = setInterval(refresh, 10000);
    window.addEventListener("focus", refresh);
    return () => {
      live = false;
      historyRead.current++;
      unsubscribe?.();
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(DOCUMENT_HISTORY_CHANGED, changed);
    };
  }, [connection.key, createOnly]);
  const run = async (work: () => Promise<void>) => {
    if (busy || mutation.uncertain || !liveAccess.current) return;
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const prepare = async () => {
    await connection.flush();
    return load();
  };
  const openOperation = (next: Operation) => {
    setOperation(next);
    setName("");
    setMessage("");
    setReport("");
    setConflict(null);
    setCompare("");
  };
  const version = () =>
    run(async () => {
      const h = await prepare();
      await mutation.send("version", {
        name: name.trim(),
        message,
        branch,
        expected_revision: head(h),
      });
      setSelection(`version:${name.trim()}`);
      setNotice(`Version “${name.trim()}” created.`);
      setName("");
      setMessage("");
      if (!createOnly) setOperation(null);
      await load();
      onCreated?.();
    });
  const createBranchFromCurrent = () =>
    run(async () => {
      const h = await prepare();
      const created = await mutation.send<{branch_id?: string}>("branch_create", {
        name: name.trim(),
        message,
        ...(h.branch_identity === "stable" ? {} : {branch}),
        from_revision: branchSource ?? head(h),
        expected_revision: head(h, h.branch_identity === "stable" ? "Main" : branch),
      });
      setSelection(`workspace:${created?.branch_id ?? name.trim()}`);
      setNotice(`Branch “${name.trim()}” created.`);
      setName("");
      setMessage("");
      if (!createOnly) setOperation(null);
      await load();
      onCreated?.();
    });
  const closeCreation = useCallback(() => setOperation(null), []);
  const restore = () => {
    if (
      snapshot == null ||
      !window.confirm(
        `Restore ${selectedName} in ${branchLabel}? Current work will be saved for recovery first.`,
      )
    )
      return;
    void run(async () => {
      const h = await prepare();
      await mutation.send("restore", {
        revision: snapshot,
        branch,
        expected_revision: head(h),
      });
      await connection.reload();
      await load();
    });
  };
  const download = () =>
    void run(async () => {
      if (snapshot == null) return;
      if (connection.downloadSnapshot) {
        await connection.downloadSnapshot(snapshot);
        return;
      }
      const file = await connection.call<{ name: string; data_base64: string }>(
        "read_revision",
        { revision: snapshot },
      );
      const url = URL.createObjectURL(
        new Blob([
          Uint8Array.from(atob(file.data_base64), (c) => c.charCodeAt(0)),
        ]),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  const merge = (resolution?: string) =>
    run(async () => {
      const h = await prepare();
      try {
        await mutation.send("merge", {
          source,
          target: branch,
          resolution,
          expected_revision: resolution ? conflict?.target_head : head(h),
          expected_source_revision: resolution
            ? conflict?.source_head
            : head(h, source),
        });
        setConflict(null);
        setOperation(null);
        await connection.reload();
        await load();
      } catch (e) {
        const detail = (e as Error & { detail?: Record<string, unknown> })
          .detail;
        if (detail?.conflict) setConflict(detail);
        throw e;
      }
    });
  const rename = () => {
    if (!selected || selected.kind === "start") return;
    const next = window.prompt(`Rename ${selected.kind}`, selected.name);
    if (!next?.trim()) return;
    void run(async () => {
      const h = await prepare();
      await mutation.send(
        selected.kind === "version" ? "version_update" : "branch_rename",
        {
          ...(selected.kind === "workspace" && stable
            ? {branch: selected.branchID ?? selected.name, expected_revision: head(h, selected.branchID ?? selected.name)}
            : {name: selected.name, branch, expected_revision: head(h)}),
          new_name: next.trim(),
        },
      );
      setSelection(selected.kind === "workspace" && stable ? selected.id : `${selected.kind}:${next.trim()}`);
      await load();
    });
  };
  const remove = () => {
    if (
      !selected ||
      selected.kind === "start" ||
      !window.confirm(
        selected.kind === "version"
          ? `Remove version label ${selected.name}? Its saved content remains available for recovery.`
          : `Delete merged workspace ${selected.name}? Unmerged work is protected.`,
      )
    )
      return;
    void run(async () => {
      const h = await prepare();
      await mutation.send(
        selected.kind === "version" ? "version_delete" : "branch_delete",
        selected.kind === "workspace" && stable
          ? {branch: selected.branchID ?? selected.name, expected_revision: head(h, selected.branchID ?? selected.name), expected_main_revision: head(h, "Main")}
          : { name: selected.name, branch, expected_revision: head(h) },
      );
      setSelection(null);
      await load();
    });
  };
  const actionIcons: Record<string,string> = {open:"workspace",branch:"branch-from",compare:"compare",restore:"restore",download:"document-download",rename:"pencil",remove:"delete",merge:"merge",share:"people",recovery:"history",candidate:"triangle",released:"triangle-filled",obsolete:"obsoletion",withdraw:"close-circle"};
  const items: MenuItem[] = [
    { id:"compare", label:"Compare entries", disabled:busy || snapshot == null },
    ...(!recovery && selected?.kind === "workspace"
      ? [
          {
            id: "open",
            label: `Open workspace ${selected.name}`,
            disabled:
              busy || !connection.openBranch || (selected.branchID ?? selected.name) === branch,
          },
        ]
      : []),
    {
      id: "branch",
      label: "Branch from selected entry",
      disabled: busy || !writable || snapshot == null,
    },
    {
      id: "restore",
      label: "Restore selected entry",
      disabled:
        busy ||
        !writable ||
        snapshot == null ||
        snapshot === (history && head(history)),
    },
    {
      id: "download",
      label: "Download selected entry",
      disabled: busy || snapshot == null,
    },
    ...(!recovery && selected && selected.kind !== "start"
      ? [
          {
            id: "rename",
            label:
              selected.kind === "version"
                ? "Rename version"
                : "Rename workspace",
            disabled:
              busy ||
              !writable ||
              (selected.kind === "version" && !!selected.status && selected.status !== "version") ||
              (selected.kind === "workspace" &&
                (selected.name === "Main" || (selected.branchID ?? selected.name) === branch)),
          },
          {
            id: "remove",
            label:
              selected.kind === "version"
                ? "Remove version label"
                : "Delete merged workspace",
            disabled:
              busy ||
              !writable ||
              (selected.kind === "version" && !!selected.status && selected.status !== "version") ||
              (selected.kind === "workspace" &&
                (selected.name === "Main" || (selected.branchID ?? selected.name) === branch)),
          },
        ]
      : []),
    {
      id: "merge",
      label: `Merge into ${branchLabel}`,
      separatorBefore: true,
      disabled: busy || !writable || (history?.branches.length ?? 0) < 2,
    },
    ...(history?.scope
      ? [
          {
            id: "share",
            label:
              history.scope === "workspace"
                ? "Make document private"
                : "Share with workspace",
            disabled: busy || !writable,
          },
        ]
      : []),
    ...(!recovery && selected?.kind === "version" ? [
      ...(selected.status === "version" || !selected.status ? [{id:"candidate",label:"Create release candidate"}] : []),
      ...(selected.status === "candidate" ? [{id:"released",label:"Approve release"},{id:"withdraw",label:"Withdraw release candidate"}] : []),
      ...(selected.status === "released" ? [{id:"obsolete",label:"Obsolete release"}] : []),
    ].map(item=>({...item, disabled:busy || !writable, separatorBefore:true})) : []),
    {
      id: "recovery",
      label: recovery ? "Back to versions" : "Automatic saves (recovery)",
      separatorBefore: true,
    },
  ].filter(item=>menu !== "toolbar" || item.id !== "branch").map(item=>({...item,icon:<AetherIcon name={actionIcons[item.id]} />}));
  const command = (id: string) => {
    setMenu(null);
    if (id === "branch" || id === "merge" || id === "compare") openOperation(id);
    if (["candidate", "released", "obsolete", "withdraw"].includes(id) && selected?.kind === "version") {
      const note = id === "obsolete" ? window.prompt("Reason for obsoleting this document release:") : "";
      if (note == null || (id === "obsolete" && !note.trim())) return;
      void run(async () => {
        const h = await prepare();
        await mutation.send("version_status", {name:selected.name, branch, expected_revision:head(h),
          expected_status:selected.status ?? "version", expected_status_updated:selected.statusUpdated ?? 0,
          status:id === "withdraw" ? "version" : id, note});
        await load();
      });
    }
    if (id === "restore") restore();
    if (id === "download") download();
    if (id === "rename") rename();
    if (id === "remove") remove();
    if (id === "recovery") {
      setRecovery(!recovery);
      setOperation(null);
      setRecoverySelection(null);
    }
    if (id === "open" && selected)
      void run(async () => {
        await connection.openBranch?.(selected.branchID ?? selected.name);
      });
    if (
      id === "share" &&
      window.confirm(
        history?.scope === "workspace"
          ? "Make this document and discussions private?"
          : "Share this document and discussions with your workspace?",
      )
    )
      void run(async () => {
        const h = await prepare();
        await mutation.send("share", {
          scope: h.scope === "workspace" ? "personal" : "workspace",
          expected_revision: head(h, "Main"),
        });
        await connection.reload();
        await load();
      });
  };
  return (
    <section
      className="aui-version-panel"
      aria-label={createOnly ? (branchOnly ? "Create branch" : "Create version") : "Versions and history"}
    >
      {disconnected && <p role="status">Live updates are disconnected. Your draft is kept. Reconnecting…</p>}
      {!createOnly && <header className="aui-version-head">
        <h3>{createOnly ? "Create version" : "Versions and history"}</h3>
        {!createOnly && (
          <div className="aui-version-head-actions" ref={menuAnchor}>
            <IconButton
              label="Create version"
              disabled={busy || !writable}
              onClick={() => openOperation("version")}
            >
              <AetherIcon name="version-create" />
            </IconButton>
            <IconButton label="Create branch" disabled={busy || !writable || snapshot == null} onClick={() => openOperation("branch")}>
              <AetherIcon name="branch-from" />
            </IconButton>
            <IconButton
              label="More history actions"
              aria-haspopup="menu"
              aria-expanded={!!menu}
              onClick={() => setMenu(menu ? null : "toolbar")}
            >
              <AetherIcon name="more" />
            </IconButton>
          </div>
        )}
      </header>}
      {!createOnly && (
        <>
          <div className="aui-version-search">
            <input
              type="search"
              aria-label="Search history"
              placeholder="Search history"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <AetherIcon name="search" />
          </div>

        </>
      )}
      {error && (
        <p role="alert" className="aui-version-error">
          {error}
        </p>
      )}
      {mutation.uncertain && <div role="group" aria-label="Confirm pending change">
        <p>The reply was lost. Confirm the original change before making another.</p>
        {mutation.canRetry ? <Button disabled={mutation.retrying} onClick={() => void mutation.retry().catch(e => setError(e.message))}>Retry original change</Button> : <p>This server cannot safely replay this change. Check its history before submitting again.</p>}
      </div>}
      {!createOnly && (operation === "version" || operation === "branch") && <DocumentCreateDialog connection={connection} onClose={closeCreation} mode={operation} sourceRevision={operation === "branch" && !(selected?.kind === "workspace" && (selected.branchID ?? selected.name) === branch) ? snapshot ?? undefined : undefined} sourceName={operation === "branch" ? selectedName : undefined} />}
      {operation && (createOnly || (operation !== "version" && operation !== "branch")) && (
        <div
          className="aui-version-operation"
          role="group"
          aria-label={`${operation} action`}
        >
          {!createOnly && (
            <IconButton
              className="aui-version-dismiss"
              label="Close action"
              onClick={() => setOperation(null)}
            >
              <AetherIcon name="close" />
            </IconButton>
          )}
          {operation === "version" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if(branchOnly) void createBranchFromCurrent(); else void version();
              }}
            >
              <label>
                Name
                <input
                  autoFocus
                  aria-label="Name"
                  value={name}
                  maxLength={80}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                Description
                <textarea
                  aria-label="Description"
                  rows={2}
                  value={message}
                  maxLength={500}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </label>
              <div className="aui-version-create-actions">
              {!branchOnly && <Button
                primary
                type="submit"
                disabled={busy || !writable || !name.trim()}
              >
                <AetherIcon name="version-create" /> Create version
              </Button>}
              <Button
                primary={branchOnly}
                type="button"
                disabled={busy || !writable || !name.trim()}
                onClick={() => void createBranchFromCurrent()}
              >
                <AetherIcon name="branch-from" /> Create branch
              </Button>
              {onCancel && <Button type="button" onClick={onCancel}><AetherIcon name="close" /> Cancel</Button>}
              </div>
              {notice && <p role="status">{notice}</p>}
            </form>
          )}
          {operation === "compare" && (
            <>
              <label>
                Compare {selectedName} with
                <select
                  aria-label="Compare with"
                  value={compare}
                  onChange={(e) => setCompare(e.target.value)}
                >
                  <option value="">Choose entry</option>
                  {graph
                    .filter((row) => row.revision !== snapshot)
                    .map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name}
                        {row.kind === "workspace" ? " (workspace)" : ""}
                      </option>
                    ))}
                </select>
              </label>
              <Button
                disabled={busy || !compare || snapshot == null}
                onClick={() =>
                  void run(async () => {
                    const target = graph.find((row) => row.id === compare);
                    if (!target) return;
                    const result = await connection.call<{
                      same_content: boolean;
                      content_diff?: { text: string; truncated: boolean };
                    }>("compare", { from: snapshot, to: target.revision });
                    setReport(
                      result.same_content
                        ? "Identical file content."
                        : (result.content_diff?.text
                            ?.replace(
                              /^--- revision .*$/m,
                              "--- Selected entry",
                            )
                            .replace(
                              /^\+\+\+ revision .*$/m,
                              "+++ Compared entry",
                            ) ?? "The files differ."),
                    );
                  })
                }
              >
                <AetherIcon name="compare" /> Compare entries
              </Button>
              {report && <pre aria-label="Entry comparison">{report}</pre>}
            </>
          )}
          {operation === "merge" && (
            <>
              <label>
                Merge from
                <select
                  aria-label="Merge source"
                  value={source}
                  onChange={(e) => {
                    setSource(e.target.value);
                    setConflict(null);
                  }}
                >
                  <option value="">Choose workspace</option>
                  {history?.branches
                    .filter((b) => historyBranchKey(b) !== branch)
                    .map((b) => (
                      <option key={historyBranchKey(b)} value={historyBranchKey(b)}>{b.name}</option>
                    ))}
                </select>
              </label>
              <Button
                disabled={
                  busy ||
                  !writable ||
                  !history?.branches.some(
                    (b) => historyBranchKey(b) === source && source !== branch,
                  )
                }
                onClick={() => void merge()}
              >
                <AetherIcon name="merge" /> Merge into {branchLabel}
              </Button>
              {conflict && (
                <div role="group" aria-label="Resolve merge conflict">
                  <p>
                    Both workspaces changed. Choose the complete file to keep;
                    both save histories remain available.
                  </p>
                  <Button disabled={busy} onClick={() => void merge("source")}>
                    <AetherIcon name="document" /> Use source file
                  </Button>
                  <Button disabled={busy} onClick={() => void merge("target")}>
                    <AetherIcon name="workspace" /> Keep current file
                  </Button>
                  <Button onClick={() => setConflict(null)}>
                    <AetherIcon name="close" /> Cancel merge
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
      {!createOnly &&
        (recovery ? (
          <div className="aui-version-recovery">
            <Button
              onClick={() => {
                setRecovery(false);
                setOperation(null);
              }}
            >
              <AetherIcon name="version-control" /> Back to versions
            </Button>
            <h4>Automatic saves</h4>
            <p>Recovery snapshots, not versions or commits.</p>
            <ol aria-label="Automatic saves">
              {history?.revisions
                .filter((save) =>
                  `${save.author} ${save.branch}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .map((save) => (
                  <li key={save.revision}>
                    <button
                      type="button"
                      aria-pressed={recoverySelection === save.revision}
                      onClick={() => setRecoverySelection(save.revision)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setRecoverySelection(save.revision);
                        setMenu({ x: e.clientX, y: e.clientY });
                      }}
                    >
                      <span>{stamp(save.saved)}</span>
                      <small>
                        {save.author} · {save.branch}
                      </small>
                    </button>
                  </li>
                ))}
            </ol>
          </div>
        ) : (
          <DocumentHistoryGraph history={history} graph={graph} branch={branch} query={query}
            selectedID={selected?.id} selectedSave={selectedChange}
            onSelect={row => { setSelection(row.id); setSelectedChange(null); setReport(""); }}
            onSelectSave={setSelectedChange}
            onOpenWorkspace={name => void run(async () => { await connection.openBranch?.(name); })}
            onContextMenu={setMenu} />

        ))}
      {menu && (
        <Menu
          open
          className="aui-collection-popup"
          anchor={menu === "toolbar" ? menuAnchor.current : menu}
          placement="bottom-end"
          ariaLabel="History actions"
          items={items}
          onSelect={command}
          onClose={() => setMenu(null)}
        />
      )}
    </section>
  );
}

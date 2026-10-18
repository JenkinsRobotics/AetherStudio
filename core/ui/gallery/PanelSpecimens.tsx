import { useState, type ReactNode } from "react";
import { BottomPanel, Button, DataTable, EmptyState, ListBox, SplitPane, type DataTableColumn } from "../src/index";

interface ProblemRow { id: string; severity: string; message: string }
export const problemRows: ProblemRow[] = [
  { id: "p1", severity: "Error", message: "Extrude profile is unavailable" },
  { id: "p2", severity: "Warning", message: "Linked component is out of date" },
  { id: "p3", severity: "Info", message: "3 suppressed constraints" },
];
export const problemColumns: DataTableColumn<ProblemRow>[] = [
  { id: "severity", header: "Level", cell: row => row.severity, sortValue: row => row.severity, sortable: true, width: 80 },
  { id: "message", header: "Message", cell: row => row.message, sortValue: row => row.message, sortable: true, width: 240 },
];

/** The same shared SplitPane specimen is used independently and in the workspace. */
export function SplitPaneSpecimen({ primary, secondary }: { primary?: ReactNode; secondary?: ReactNode }) {
  const [size, setSize] = useState(240);
  const [collapsed, setCollapsed] = useState(false);
  return <SplitPane
    style={{ height: "100%" }}
    primary={primary ?? <div className="panel-specimen-content"><strong>Primary panel</strong><p>Drag the divider or use its arrow keys to resize.</p></div>}
    secondary={secondary ?? <div className="panel-specimen-content"><strong>Secondary panel</strong><p>Collapse and restore the primary panel using the divider.</p></div>}
    primarySize={size} onResize={setSize} collapsed={collapsed} onCollapsedChange={setCollapsed}
    collapseSide="primary" separatorLabel="Resize primary panel"
  />;
}

/** Shared BottomPanel, with identical sample interactions in both presentations. */
export function BottomPanelSpecimen({ fill = false, onCollapsedChange }: { fill?: boolean; onCollapsedChange?: (collapsed: boolean) => void }) {
  const [active, setActive] = useState("problems");
  const [collapsed, setCollapsed] = useState(false);
  const [problems, setProblems] = useState(problemRows);
  const [consoleText, setConsoleText] = useState("Kernel ready · exact topology cache warm");
  const [selection, setSelection] = useState<ReadonlySet<string>>(new Set(["p1"]));
  const [history, setHistory] = useState<ReadonlySet<string>>(new Set(["h2"]));
  return <div className="bottom-panel-specimen" style={{ height: collapsed ? "auto" : fill ? "100%" : 240 }}>
    <BottomPanel
      tabs={[
        { id: "problems", label: "Problems", badge: problems.length, content: problems.length
          ? <DataTable ariaLabel="Panel problems" rows={problems} rowID={row => row.id} columns={problemColumns} selectedIDs={selection} onSelect={ids => setSelection(new Set(ids))} />
          : <EmptyState compact title="No problems" /> },
        { id: "history", label: "History", content: <ListBox ariaLabel="Rebuild history" items={[{ id: "h1", label: "Sketch 1" }, { id: "h2", label: "Extrude 1" }, { id: "h3", label: "Fillet 1", dimmed: true }]} selectedIDs={history} onSelect={ids => setHistory(new Set(ids))} /> },
        { id: "console", label: "Console", badge: consoleText ? "•" : undefined, content: consoleText
          ? <pre className="panel-specimen-content">{consoleText}</pre> : <EmptyState compact title="Console cleared" /> },
        { id: "bom", label: "BOM", badge: 140, content: <div className="panel-specimen-content">140 component rows</div> },
        { id: "tasks", label: "Tasks", content: <EmptyState compact title="No background tasks" /> },
      ]}
      activeID={active} onSelect={setActive} collapsed={collapsed}
      onCollapsedChange={value => { setCollapsed(value); onCollapsedChange?.(value); }}
      actions={<Button disabled={active !== "problems" && active !== "console"} onClick={() => active === "problems" ? setProblems([]) : setConsoleText("")}>Clear</Button>}
    />
  </div>;
}

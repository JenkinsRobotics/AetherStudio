import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { visibleParents } from "./document-history-view";
import type { VersionControlEntry } from "./VersionControl";

const laneX = (lane: number) => 10 + lane * 16;
const laneColor = (lane: number) => ["#6b9fff", "#bd98fa", "#4bcebc", "#e7bd65"][lane % 4];

/** Draw the host's actual ancestry beside measured rows. Card expansion and
 * container resizing change positions only; time sorting never creates edges. */
export function VersionControlGraph({ entries, visible, selected, children, linear = false }: {
  entries: readonly VersionControlEntry[];
  visible: readonly VersionControlEntry[];
  selected: string | null;
  children: ReactNode;
  linear?: boolean;
}) {
  const content = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<Record<string, number>>({});
  const xFor = (lane: number) => laneX(linear ? 0 : lane);
  const width = linear ? 20 : 22 + Math.max(0, ...visible.map(entry => entry.lane)) * 16;
  useLayoutEffect(() => {
    const root = content.current;
    if (!root) return;
    const rows = [...root.querySelectorAll<HTMLElement>("[data-entry-id]")];
    const measure = () => {
      const top = root.getBoundingClientRect().top;
      const next: Record<string, number> = {};
      for (const row of rows) {
        const head = row.querySelector<HTMLElement>(".aui-vc-entry-head")!;
        const rect = head.getBoundingClientRect();
        next[row.dataset.entryId!] = rect.top + rect.height / 2 - top;
      }
      setPositions(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(root);
    rows.forEach(row => observer?.observe(row));
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, [visible, selected]);
  const byID = new Map(visible.map(entry => [entry.id, entry]));
  return <div ref={content} className="aui-vc-graph" data-linear={linear} role="list" aria-label="Versions" style={{ paddingLeft: width }}>
    <svg className="aui-vc-graph-links" width={width} height="100%" role="img" aria-label={linear ? "Branch version timeline" : "Branch and merge graph"}>
      <title>Version ancestry — separate branch lanes, solid parent links and dashed merge links</title>
      {visible.flatMap(entry => {
        const primary = new Set(visibleParents(entry, entries, visible, false));
        return visibleParents(entry, entries, visible, !linear).map(id => {
          const parent = byID.get(id)!;
          const y = positions[entry.id], py = positions[id];
          if (y == null || py == null) return null;
          const x = xFor(entry.lane), px = xFor(parent.lane), middle = (y + py) / 2;
          const merge = !primary.has(id);
          return <path key={`${entry.id}:${id}`} data-from={entry.id} data-to={id} data-merge={merge}
            stroke={laneColor(merge ? parent.lane : entry.lane)} d={`M ${x} ${y} C ${x} ${middle}, ${px} ${middle}, ${px} ${py}`}>
            <title>{entry.name} → {parent.name}{merge ? " (merge)" : ""}</title>
          </path>;
        });
      })}
      {visible.map(entry => positions[entry.id] == null ? null : <circle key={entry.id} data-node={entry.id} data-lane={entry.lane} data-selected={selected === entry.id}
        cx={xFor(entry.lane)} cy={positions[entry.id]} r={selected === entry.id ? 5 : 4}
        stroke={laneColor(entry.lane)} style={{ color: laneColor(entry.lane) }}><title>{entry.name} · {entry.branch}</title></circle>)}
    </svg>
    {children}
  </div>;
}

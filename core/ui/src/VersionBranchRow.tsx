import { useState, type ReactNode } from "react";
import { AetherIcon } from "./AetherIcon";
import type { VersionControlEntry } from "./VersionControl";

/** A saved image belongs to its entry. Never substitute the live model for an
 * older version that has no snapshot. */
export function VersionBranchRow({ entry, active, icon, label, onSelect, menu }: {
  entry: VersionControlEntry; active: boolean; icon: string; label: string;
  onSelect: () => void; menu: ReactNode;
}) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  return <div className="aui-vc-entry-head aui-vc-branch-head">
    <button type="button" className="aui-vc-select" aria-label={`Select ${entry.name}`}
      aria-pressed={active} aria-expanded={active} onClick={onSelect}>
      <span className="aui-vc-snapshot">
        {entry.snapshot && failedImage !== entry.snapshot
          ? <img src={entry.snapshot} alt={`Snapshot of ${entry.name}`} onError={() => setFailedImage(entry.snapshot!)} />
          : entry.preview ?? <span className="aui-vc-no-snapshot" aria-label="No saved snapshot"><AetherIcon name={icon}/><small>No snapshot</small></span>}
      </span>
      <span className="aui-vc-branch-copy">
        <span className="aui-vc-branch-title" title={entry.name}>{entry.versionLabel && <small>{entry.versionLabel}</small>}<strong>{entry.name}</strong></span>
        <time dateTime={new Date(entry.saved * 1000).toISOString()} title={`${entry.author} · ${new Date(entry.saved * 1000).toLocaleString()}`}>
          {new Date(entry.saved * 1000).toLocaleString([], { month:"short", day:"numeric", hour:"numeric", minute:"2-digit" })}
        </time>
        {active ? <span className="aui-vc-branch-summary">{entry.description}</span>
          : <span className="aui-vc-branch-meta"><span title={entry.branch}><i/>{entry.branch}</span><span className="aui-vc-badge">{entry.current ? "Current" : label}</span></span>}
      </span>
    </button>
    {menu}
  </div>;
}

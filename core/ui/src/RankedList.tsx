import type { ReactNode } from "react";
import { AetherIcon } from "./AetherIcon";
import "./RankedList.css";

export interface RankedListItem { id: string; label: string; value: string; icon?: ReactNode; }
/** Dense ranked metrics. Selection reports the item ID, never navigates implicitly. */
export function RankedList({ label, items, onSelect, selectedID }: { label: string; items: readonly RankedListItem[]; onSelect?: (id: string) => void; selectedID?: string }) {
  return <ol className="aui-ranked-list" aria-label={label}>{items.map((item, index) => <li key={item.id}>
    <button type="button" disabled={!onSelect} aria-pressed={onSelect ? selectedID === item.id : undefined} onClick={() => onSelect?.(item.id)}>
      <span className="aui-ranked-list__rank">{index + 1}</span><span className="aui-ranked-list__icon">{item.icon}</span><span className="aui-ranked-list__label">{item.label}</span><strong>{item.value}</strong>{onSelect && <AetherIcon name="open-external"/>}
    </button>
  </li>)}</ol>;
}

import { useLayoutEffect, useRef, useState } from "react";

/** A rename owns its draft and focuses before paint; no delayed select can erase typing. */
export function TreeRename({ label, onCommit, onCancel }: {
  label: string; onCommit: (value: string) => void; onCancel: () => void;
}) {
  const [draft, setDraft] = useState(label);
  const input = useRef<HTMLInputElement>(null);
  const finished = useRef(false);
  useLayoutEffect(() => { input.current?.focus(); input.current?.select(); }, []);
  const finish = (cancel = false) => {
    if (finished.current) return;
    finished.current = true;
    const value = draft.trim();
    if (cancel || !value) onCancel(); else onCommit(value);
  };
  return <input ref={input} className="aui-tree-rename" aria-label={`Rename ${label}`}
    value={draft} onChange={(event) => setDraft(event.target.value)}
    onClick={(event) => event.stopPropagation()} onBlur={() => finish()}
    onKeyDown={(event) => {
      event.stopPropagation();
      if (event.key === "Enter" || event.key === "Escape") { event.preventDefault(); finish(event.key === "Escape"); }
    }} />;
}

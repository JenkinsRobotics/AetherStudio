export function selectListItems(ids: readonly string[], selected: ReadonlySet<string>, anchor: string | null, target: string, range: boolean, additive: boolean): Set<string> {
 const start = anchor === null ? -1 : ids.indexOf(anchor), end = ids.indexOf(target);
 if (range && start >= 0 && end >= 0) {
  return new Set([...(additive ? selected : []), ...ids.slice(Math.min(start,end),Math.max(start,end)+1)]);
 }
 if (additive) { const next = new Set(selected); if (next.has(target)) next.delete(target); else next.add(target); return next; }
 return new Set([target]);
}

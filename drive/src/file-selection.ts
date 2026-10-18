export {selectListItems as selectFiles} from "@aether/ui";

/** Only bulk commands inherit a row's existing multi-selection. */
export function selectionForAction(action: string, target: string, selected: ReadonlySet<string>): Set<string> {
  const bulk = ["copy", "move", "trash", "restore", "delete_forever"].includes(action);
  return new Set(bulk && selected.has(target) ? selected : [target]);
}

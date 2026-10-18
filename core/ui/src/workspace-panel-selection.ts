import type { WorkspacePanelState } from "./WorkspaceShell";

/** One active panel per rail; preserve hidden editors and their coordinates. */
export function singlePanelPerSide(
  state: WorkspacePanelState,
  sides: readonly (readonly string[])[],
  previous?: WorkspacePanelState,
  preferredID?: string,
  previousSelection = previous,
): WorkspacePanelState {
  let result = state;
  for (const side of sides) {
    const visible = side.filter(id => state[id] && state[id].placement !== "hidden");
    if (visible.length < 2) continue;
    const newlyOpened = previous && visible.filter(id => !previous[id] || previous[id].placement === "hidden");
    const selected = visible.find(id => previousSelection?.[id] && previousSelection[id].placement !== "hidden");
    const keep = preferredID && visible.includes(preferredID)
      ? preferredID : newlyOpened?.at(-1) ?? selected ?? visible[0];
    if (result === state) result = { ...state };
    for (const id of visible) {
      if (id !== keep) result = { ...result, [id]: { ...state[id], placement: "hidden" } };
    }
  }
  return result;
}

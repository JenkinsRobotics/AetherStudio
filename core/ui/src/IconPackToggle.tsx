import { AetherIcon } from "./AetherIcon";
import { MenuButton } from "./Menu";
import type { ToolIconPack } from "./ToolIconTheme";

/** The illustrated tool packs a `ToolIconTheme` can scope. */
export const TOOL_ICON_PACKS: readonly { id: ToolIconPack; label: string }[] = [
  { id: "classic", label: "Aether Classic" },
  { id: "graphite-ribbon", label: "Graphite Ribbon" },
];

/** Header control: which illustrated tool pack every `ToolIcon` under the app's `ToolIconTheme` draws from. State is the caller's, like `LayoutPresetButton`. */
export function IconPackToggle({ pack, onChange }: { pack: ToolIconPack; onChange: (pack: ToolIconPack) => void }) {
  const current = TOOL_ICON_PACKS.find((entry) => entry.id === pack)?.label ?? pack;
  return (
    <MenuButton label="Icon pack" className="aui-icon-button" title={`Icon pack: ${current}`}
      items={TOOL_ICON_PACKS.map((entry) => ({ id: entry.id, label: entry.label, checked: entry.id === pack }))}
      onSelect={(id) => onChange(id as ToolIconPack)}>
      <AetherIcon name="grid-2" />
    </MenuButton>
  );
}

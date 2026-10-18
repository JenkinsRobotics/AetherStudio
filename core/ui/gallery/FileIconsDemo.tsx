import { FileIcon } from "../src/FileIcon";
import { FILE_TYPES } from "../src/file-types";

/** Every registered file identity at preview/list sizes in both actual themes. */
export function FileIconsDemo() {
  return <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 24 }}>
    {(["light", "dark"] as const).map(mode => <div key={mode} className={`aether-theme-aether-default aether-${mode}-theme`} data-file-icon-preview={mode}
      style={{ flex: "1 1 520px", minWidth: 0, colorScheme: mode, background: "var(--aether-color-bg-app)", color: "var(--aether-color-text)", border: "1px solid var(--aether-color-border)", borderRadius: 12, padding: 24 }}>
      <strong>File icons · {mode}</strong>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(144px, 1fr))", gap: 24, marginTop: 16 }}>
        {FILE_TYPES.map(type => <div key={type.id} style={{ display: "grid", justifyItems: "center", gap: 12 }}>
          <FileIcon type={type} size={144} />
          <span>{type.label}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {[18, 24, 40].map(size => <FileIcon key={size} type={type} size={size} />)}
          </div>
        </div>)}
      </div>
    </div>)}
  </div>;
}

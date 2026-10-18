import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { openFeatureWindow, ToolIcon, type FeatureWindow } from "../src";
import { CAD_FEATURE_EDITORS, type CADFeatureEditor } from "./CADFeatureEditors";
import "./CompactFeaturePopupDemo.css";

const defaultEditor = CAD_FEATURE_EDITORS.find(editor => editor.id === "extrude")!;

/** One body definition per feature; only the shared container presentation changes. */
export function CompactFeaturePopupDemo({ editor = defaultEditor }: { editor?: CADFeatureEditor }) {
  const host = useRef<HTMLDivElement>(null);
  const [iconHost, setIconHost] = useState<HTMLElement | null>(null);
  const title = editor.title.replace(/\s+\d+$/, "");
  useEffect(() => {
    const el = host.current!;
    let current: FeatureWindow | undefined;
    const open = () => {
      current?.close();
      const icon = document.createElement("span");
      icon.className = "aui-feature-header-icon";
      const win = openFeatureWindow({ viewport: el, className: "gallery-demo", title,
        variant: "compact", headerIcon: icon, acceptLabel: "Apply", discardLabel: "Cancel",
        onAccept: () => { win.status.textContent = `Sample applied · ${title}`; }, onDiscard: open });
      current = win;
      Object.assign(win.panel.style, { position: "relative", top: "0", right: "auto", left: "auto" });
      win.panel.setAttribute("role", "region");
      win.panel.setAttribute("aria-label", `${title} reference parameters`);
      editor.build(win);
      setIconHost(icon);
    };
    open();
    return () => current?.close();
  }, [editor, title]);
  return <div className="compact-feature-reference cad-feature-editor" ref={host}>
    {iconHost && createPortal(<ToolIcon name={editor.icon} />, iconHost)}
  </div>;
}

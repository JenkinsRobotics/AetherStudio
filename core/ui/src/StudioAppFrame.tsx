import type { CSSProperties, ReactNode } from "react";
import "./StudioAppFrame.css";

/** Approved Model Studio composition. Products supply their real document and tools. */
export function StudioAppFrame({ children, className = "", style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return <div className={`aui-studio-app ${className}`} style={style}>{children}</div>;
}

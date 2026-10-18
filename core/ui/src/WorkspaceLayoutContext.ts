import { createContext } from "react";
import type { LayoutPreset } from "./WorkspaceShell";

/** Shared chrome follows its hosting workspace unless explicitly customized. */
export const WorkspaceLayoutContext = createContext<LayoutPreset | null>(null);

import { applyInterfaceColors, INTERFACE_COLORS_KEY } from "./InterfaceColors";
import { useEffect, useLayoutEffect, useState } from "react";
import { AetherIcon } from "./AetherIcon";
import { Menu, MenuButton, type MenuItem } from "./Menu";
import { nextLayoutPreset, type LayoutPreset } from "./WorkspaceShell";
import { DEFAULT_THEME_ID, resolveTheme, themeCSS, type AetherThemeManifest } from "./themes";

export type { AetherThemeManifest } from "./themes";

/* The three native Aether Animation Studio header controls, ported faithfully from
 * `WorkspaceChrome.swift`: the studio-mode button (click cycles presets,
 * menu lists them), the workspace windows/tabs menu, and the appearance
 * toggle (System → Light → Dark). */

const PRESET_TITLE: Record<LayoutPreset, string> = { floating: "Floating", docked: "Docked", canvas: "Canvas" };

/** Native studio-mode button: colored per preset, primary click cycles,
 * right-click or ArrowDown opens the Studio modes menu with reset. */
export function StudioModeButton({ preset, onChange, extraItems = [], onExtraSelect }: { preset: LayoutPreset; onChange: (preset: LayoutPreset) => void; extraItems?: readonly MenuItem[]; onExtraSelect?: (id: string) => void }) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const title = PRESET_TITLE[preset];
  return (
    <>
      <button
        type="button"
        className={`aui-studio-mode aui-studio-mode--${preset}`}
        aria-label={`Studio mode: ${title}`}
        title="Mode"
        aria-haspopup="menu"
        onClick={() => onChange(nextLayoutPreset(preset))}
        onContextMenu={(event) => { event.preventDefault(); setMenu({ x: event.clientX, y: event.clientY }); }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            const rect = event.currentTarget.getBoundingClientRect();
            setMenu({ x: rect.left, y: rect.bottom });
          }
        }}
      >
        <AetherIcon name={`mode-${preset}` as "mode-floating"} />
      </button>
      {menu ? (
        <Menu
          open
          anchor={menu}
          placement="bottom-start"
          ariaLabel="Studio modes"
          items={[
            ...(["floating", "docked", "canvas"] as const).map((entry) => ({
              id: entry,
              label: PRESET_TITLE[entry],
              icon: <AetherIcon name={`mode-${entry}` as "mode-floating"} />,
              kind: "radio" as const,
              checked: entry === preset,
            })),
            { id: "reset", label: "Reset Studio Layout", separatorBefore: true },
            ...extraItems,
          ]}
          onSelect={(id) => {
            setMenu(null);
            if (extraItems.some((item) => item.id === id)) onExtraSelect?.(id);
            else onChange(id === "reset" ? "floating" : (id as LayoutPreset));
          }}
          onClose={() => setMenu(null)}
        />
      ) : null}
    </>
  );
}

/** Native workspace windows/tabs menu. Browser-managed entries stay listed
 * but disabled, exactly as named in the native app. */
export function WorkspaceWindowMenu() {
  const browserManaged = "The browser manages windows and tabs.";
  return (
    <MenuButton
      label="Windows"
      className="aui-workspace-windows"
      placement="bottom-end"
      items={[
        { id: "new-tab", label: "New Workspace Tab" },
        { id: "new-window", label: "New Workspace Window" },
        { id: "detach", label: "Detach Current Tab", disabled: true, disabledReason: browserManaged, separatorBefore: true },
        { id: "merge", label: "Merge All Windows", disabled: true, disabledReason: browserManaged },
        { id: "tab-bar", label: "Show or Hide Tab Bar", disabled: true, disabledReason: browserManaged },
        { id: "previous-tab", label: "Previous Workspace Tab", shortcut: "⇧⌘[", disabled: true, disabledReason: browserManaged, separatorBefore: true },
        { id: "next-tab", label: "Next Workspace Tab", shortcut: "⇧⌘]", disabled: true, disabledReason: browserManaged },
      ]}
      onSelect={(id) => {
        if (id === "new-tab") window.open(location.href, "_blank");
        if (id === "new-window") window.open(location.href, "_blank", "popup=yes,width=1280,height=800");
      }}
    >
      <AetherIcon name="windows" />
    </MenuButton>
  );
}

export type AppearanceMode = "system" | "light" | "dark";
const APPEARANCE_ORDER: readonly AppearanceMode[] = ["system", "light", "dark"];
const APPEARANCE_TITLE: Record<AppearanceMode, string> = { system: "System", light: "Light", dark: "Dark" };
const APPEARANCE_KEY = "aether-appearance";

export function storedAppearance(): AppearanceMode {
  try {
    const saved = localStorage.getItem(APPEARANCE_KEY) as AppearanceMode | null;
    return saved && APPEARANCE_ORDER.includes(saved) ? saved : "system";
  } catch { return "system"; }
}

function applyAppearance(mode: AppearanceMode) {
  if (typeof document === "undefined") return;
  const prefersLight = typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: light)").matches;
  const light = mode === "light" || (mode === "system" && prefersLight);
  document.documentElement.classList.toggle("aether-light-theme", light);
  // The illustrated tool palette follows the resolved mode, including System.
  document.documentElement.dataset.aetherTheme = light ? "light" : "dark";
  document.documentElement.dataset.appearance = mode;
  applyInterfaceColors();
}

const THEME_KEY = "aether-theme";
const VIEWPORT_KEY = "aether-viewport-theme";

/** Hot-installs a theme at runtime (VS Code-style): resolves the manifest
 * against the pack, synthesizes the scoped CSS and injects it, replacing any
 * prior install of the same id. Pair with setAetherTheme(manifest.id) to
 * activate immediately. dev/build-theme-css.mjs emits identical selectors. */
export function installAetherTheme(manifest: AetherThemeManifest) {
  if (typeof document === "undefined") return;
  const existing = document.head.querySelector(`style[data-aether-theme="${manifest.id}"]`);
  const style = existing ?? document.createElement("style");
  style.setAttribute("data-aether-theme", manifest.id);
  style.textContent = themeCSS(resolveTheme(manifest));
  if (!existing) document.head.append(style);
}

/** Installed-theme selection: themes generate side-by-side scoped classes;
 * this applies the persisted choice. The default theme is the bare :root. */
export function setAetherTheme(themeID: string) {
  try { localStorage.setItem(THEME_KEY, themeID); } catch { /* device preference only */ }
  applyAetherTheme();
  announceTheme(themeID);
}

export function activeAetherTheme(): string {
  const fallback = typeof document === "undefined" ? DEFAULT_THEME_ID
    : document.documentElement.dataset.aetherHostTheme || DEFAULT_THEME_ID;
  try { return localStorage.getItem(THEME_KEY) || fallback; } catch { return fallback; }
}

/** Tells every mounted control the choice changed. Silent where there is no
 *  document, so a theme can be set in a node test or during prerender. */
const announceTheme = (id: string | null) => {
  if (typeof document === "undefined") return;
  const EventClass = document.defaultView?.CustomEvent ?? CustomEvent;
  document.dispatchEvent(new EventClass("aether-theme", { detail: id }));
};

const swapRootClass = (prefix: string, id: string | null) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const name of [...root.classList]) if (name.startsWith(prefix)) root.classList.remove(name);
  if (id) root.classList.add(`${prefix}${id}`);
};

function applyAetherTheme() {
  if (typeof document === "undefined") return;
  const active = activeAetherTheme();
  swapRootClass("aether-theme-", active === DEFAULT_THEME_ID ? null : active);
}

/** The viewport theme: the stage's own look (background, grid, part and sketch
 * colours), chosen independently of the interface theme. `null` means the
 * interface theme's own viewport look. */
export function setAetherViewportTheme(viewportID: string | null) {
  try { if (viewportID) localStorage.setItem(VIEWPORT_KEY, viewportID); else localStorage.removeItem(VIEWPORT_KEY); } catch { /* device preference only */ }
  applyAetherViewportTheme();
  announceTheme(viewportID);
}

export function activeAetherViewportTheme(): string | null {
  const fallback = typeof document === "undefined" ? null : document.documentElement.dataset.aetherHostViewportTheme ?? null;
  try { return localStorage.getItem(VIEWPORT_KEY) ?? fallback; } catch { return fallback; }
}

function applyAetherViewportTheme() {
  if (typeof document === "undefined") return;
  swapRootClass("aether-viewport-", activeAetherViewportTheme());
}

/** Sets and persists the appearance mode app-wide, as the toggle's click does. */
export function setAetherAppearance(mode: AppearanceMode) {
  try { localStorage.setItem(APPEARANCE_KEY, mode); } catch { /* device preference only */ }
  applyAppearance(mode);
  document.dispatchEvent(new CustomEvent("aether-appearance", { detail: mode }));
}

/** Default the new studio presentation without overwriting a saved user theme. */
export function useStudioDesignDefaults() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.aetherHostTheme ||= "model-studio";
    root.dataset.aetherHostViewportTheme ||= "model-studio";
    applyAetherTheme(); applyAetherViewportTheme();
    announceTheme(activeAetherTheme());
  }, []);
}

/** A concept app that presents in its own theme: the classes ride on <html>
 * (so portalled menus share them) for the component's lifetime, and the
 * person's persisted theme and appearance come back on unmount. */
export function useScopedAetherTheme(themeID: string | null, appearance?: "light" | "dark") {
  useEffect(() => {
    if (themeID) swapRootClass("aether-theme-", themeID === DEFAULT_THEME_ID ? null : themeID);
    if (appearance) {
      document.documentElement.classList.toggle("aether-light-theme", appearance === "light");
      document.documentElement.dataset.aetherTheme = appearance;
    }
    return () => { applyAetherTheme(); applyAppearance(storedAppearance()); };
  }, [themeID, appearance]);
}

/* Suite-wide bootstrap: every page importing @aether/ui applies the stored
 * appearance at load, follows OS changes while in System mode, and follows
 * appearance changes made in any other open tab. */
if (typeof document !== "undefined") {
  applyAppearance(storedAppearance());
  applyAetherTheme();
  applyAetherViewportTheme();
  if (typeof matchMedia === "function") {
    matchMedia("(prefers-color-scheme: light)").addEventListener?.("change", () => {
      if (storedAppearance() === "system") applyAppearance("system");
    });
  }
  if (typeof window !== "undefined") {
    window.addEventListener("storage", (event) => {
      if (event.key === APPEARANCE_KEY) applyAppearance(storedAppearance());
      if (event.key === THEME_KEY) applyAetherTheme();
      if (event.key === VIEWPORT_KEY) applyAetherViewportTheme();
      if (event.key === INTERFACE_COLORS_KEY || event.key === null) applyInterfaceColors();
    });
  }
}

/** Native appearance toggle: cycles System → Light → Dark and applies
 * app-wide immediately; the choice persists per device. */
export function AppearanceToggle() {
  const [mode, setMode] = useState<AppearanceMode>(storedAppearance);
  useEffect(() => {
    const follow = (event: StorageEvent) => { if (event.key === APPEARANCE_KEY) setMode(storedAppearance()); };
    const shared = () => setMode(storedAppearance());
    window.addEventListener("storage", follow);
    document.addEventListener("aether-appearance", shared);
    return () => {
      window.removeEventListener("storage", follow);
      document.removeEventListener("aether-appearance", shared);
    };
  }, []);
  useEffect(() => {
    applyAppearance(mode);
    if (mode !== "system" || typeof matchMedia !== "function") return;
    const media = matchMedia("(prefers-color-scheme: light)");
    const follow = () => applyAppearance("system");
    media.addEventListener?.("change", follow);
    return () => media.removeEventListener?.("change", follow);
  }, [mode]);
  const title = APPEARANCE_TITLE[mode];
  return (
    <button
      type="button"
      className="aui-appearance-toggle"
      aria-label={`Appearance ${title}`}
      title="Appearance"
      onClick={() => {
        const next = APPEARANCE_ORDER[(APPEARANCE_ORDER.indexOf(mode) + 1) % APPEARANCE_ORDER.length];
        try { localStorage.setItem(APPEARANCE_KEY, next); } catch { /* device preference only */ }
        setMode(next);
        document.dispatchEvent(new CustomEvent("aether-appearance", { detail: next }));
      }}
    >
      <AetherIcon name={`appearance-${mode}` as "appearance-system"} />
    </button>
  );
}

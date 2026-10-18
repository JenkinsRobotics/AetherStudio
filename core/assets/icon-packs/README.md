# Icon packs

Two layers, per Jonathan (2026-09-24). **System glyphs** are one consistent
set every Aether Studio app shares for its chrome — headers, menus, panels,
status, widget controls — the way macOS apps share SF Symbols. **Tool packs**
are the illustrated icons for the tools an app makes (CAD modelling, Anima's
tool bars); an app scopes the pack it wants with `ToolIconTheme`.

## System glyphs — `core/assets/icons/` (the default pack)

24px stroke glyphs, 1.7px, currentColor, kebab-case file names. The
`AetherIcon` registry globs the folder (`pack.json` `iconsFromDirectory`), so
adding an icon is adding a file; `dev/check-icon-pack.mjs` guards the
conventions. An alternate system pack overrides icons **by name** through
`registerIconPack({ home: "<svg …>", … })` from `@aether/ui` — a hot swap;
missing names fall back to the default artwork, so partial packs are fine.
The Anima demo kit's `Sym` is a sized alias of `AetherIcon` (pack names, never
SF names); `ToolGlyph` picks the tool pack when the name is a tool.

## Tool packs — `ToolIcon` + `ToolIconTheme`

One directory per pack: `icon-packs/<id>/pack.json` plus the pack's SVGs.

- `classic` — `core/assets/icons/tools/` (drawn by `generate.py`).
- `graphite-ribbon` — `icon-packs/graphite-ribbon/` (purpose-drawn masters,
  `build.py` emits adaptive/light/dark and `artwork.ts`).
- FreeCAD Graphite — `icon-packs/freecad-graphite/`, a separate attributed
  set rendered by `FreeCADIcon`; `tool-map.json` names each Aether tool's
  equivalent.

A pack that lacks a name falls back to the other pack, so a partial pack never
renders nothing. The showcase's header `IconPackToggle` switches the tool pack
for every widget on the page; the Icons tab shows each pack under its name.

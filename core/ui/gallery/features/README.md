# CAD feature editor collection

The original engine-backed feature editors are owned by Aether CAD, in
`Aether-CAD/gallery/features/`. Shared UI must not import the CAD engine.

Aether UI → **App demos → Aether CAD → CAD feature editors** embeds the
CAD-owned gallery at `/cad/gallery/index.html?embed=1`. The full-window link
opens `/cad/gallery/index.html`. Build both the UI showcase and CAD to serve it.

The collection contains Sketch, Extrude, Revolve, Sweep, Loft, Thicken, Enclose,
Plane and Mate, with search and per-editor reset. CAD also retains its transform
gizmo example under Viewport tools. These are interactive reference windows;
their demo controls do not edit a saved CAD document.

The TypeScript files in this directory are legacy redirect builders retained
for compatibility; the showcase no longer renders them as repeated links.

## Feature-editor presentation references — 2026-10-15

**Widgets → Aether CAD → Feature editors** shows the standard and compact
designs independently. The Spacious specimen was removed at Jonathan’s request. `gallery/CADFeatureEditors.tsx` owns the nine
presentation-only body builders shared by the standard and compact sets.
`gallery/CompactFeaturePopupDemo.tsx` mounts those bodies through the shared
`openFeatureWindow({variant: "compact"})` container: icon/title header, full-width
pill tabs and one bottom Cancel/Apply row. Both sets use 300px windows and
the same 12px body typography, 26px field heights and 8px body spacing. Apply gives local sample feedback;
Cancel restores the initial controls. Neither executes or saves CAD geometry.
Actual feature behavior and engine validation belong to Aether CAD.

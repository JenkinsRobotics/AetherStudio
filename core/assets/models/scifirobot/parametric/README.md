# Scifirobot — native CAD feature model

Original Aether study rebuilt as **120 CAD features / 39 individual solid bodies**.
`Scifirobot.acpart` is the editable Aether CAD source; `Scifirobot.step` contains
the evaluated solids. `manifest.ts` and `meshes.json` are generated presentation
assets, including 66 native intermediate solid tips for rollback previews.

Authoring and export live in the CAD product:
`Aether-CAD/scripts/examples/scifirobot/`. Regenerate there through the existing
Aether CAD translator and FreeCAD engine; do not edit the mesh data or implement
CAD evaluation in shared UI/assets. Source dimensions are millimetres; mesh
positions are metres, +Y up, with the robot center at the origin. The gallery
places the center 1.53 metres above its ground plane.

The earlier procedural mesh/GLB is preserved in the parent directory. This is
an independently authored, editable reconstruction of that design. FreeCAD
is used as an external LGPL-2.1-or-later program; see the CAD product's
`freecad-engine/ATTRIBUTION.md` for attribution.

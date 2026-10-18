# Scifirobot

Original code-generated Model Studio artwork. `geometry.ts` is the authoritative
mesh generator; `scifirobot.glb` is the portable seven-part scene with materials.
Coordinates are meters, Y up; named groups remain independently selectable.
The sample includes the shell, optics, hubs, vents, sensors, panel details and antenna.

This is display/sample artwork, not an editable parametric CAD document. Preserve
that distinction when using it for agent benchmarks or imports. No third-party
model, textures or downloaded geometry are included. Brand marks and all interface
icons continue to come from the existing shared branding/icon catalogs.

The matching rendering recipe is `themes/rendering/model-studio.ts`; its interface
and viewport theme manifests live alongside the other shared themes. The UI package
exports these recipes and the reusable vector editor, swatch picker and pointer
interaction helper. Product operations and persistence remain in each application.

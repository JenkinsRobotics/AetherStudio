# Standalone application A marks

Each application has its own transparent A asset, separate from its square app
icon: Studio, CAD, Animation, UI, Map, Sketch, Vector, IO and Drive.

These 1254 × 1254 RGBA PNGs are derived from the current app masters using the
built-in image-generation editor. The letter retains its characteristic material
and surface details; the icon tile, surrounding scene and detached ornamentation
are removed. Animation's orbit, Drive's cloud and UI's panels remain in their
original app icons. The originals and all existing icon assets are unchanged.
These are generated cutouts, not pixel-exact vector paths.

Use `AppMark` for an A placed directly on a UI surface. Use `AppIcon` for the full
square application identity. Do not crop an AppIcon, add a square background to
AppMark, or use CSS blend modes to simulate transparency.

```tsx
import { AppMark } from "@aether/ui/AppMark";

<AppMark app="cad" size={32} alt="Aether CAD" />
```

Omit `alt` when adjacent text already names the app. The component adds no tile,
border, corner radius or shadow. Its URLs are resolved by the consuming bundler,
so it works in hosted and standalone apps without a Studio connection. Each
PNG is a separate resource; only the displayed marks are downloaded.

For non-React use, import `appMarkSources` from
`@aether/assets/branding/marks/sources`, or import an individual PNG such as
`@aether/assets/branding/marks/cad.png`. Keep native proportions and use `contain`.

UI preview: `core/ui/gallery/app-marks.html` (the gallery's `/app-marks.html`).
It shows every mark against light, dark and checkerboard surfaces beside its
original icon, with size controls and direct PNG downloads.

`manifest.json` records dimensions, alpha coverage and original/output hashes.
`PROMPTS.json` records all final prompts, source paths and built-in edit mode.

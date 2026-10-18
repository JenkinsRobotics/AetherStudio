# Aether shared core

`core/` groups the shared infrastructure used by Aether Studio applications.
It is a directory, not an additional runtime package.

| Directory | Package | Responsibility |
| --- | --- | --- |
| `engine/` | `@aether/core` | Geometry, constraints, documents and deterministic engine behavior |
| `ui/` | `@aether/ui` | React controls, themes and workspace layouts |
| `assets/` | Static sources | Shared SVG icons, branding and reusable artwork |

Applications import the packages separately. Engine modules must not import
React, UI widgets or application code. Putting UI under the same parent does
not change that dependency boundary.

The Python semantic engine remains at `../aether_animation/` pending a separately
verified consolidation. Product directories are unchanged in this move;
the `apps/` grouping and suite `host/` remain planned.

From this directory:

```sh
cd engine
npm ci
npm test
npm run check
cd ../ui
npm ci
npm test
npm run typecheck
npm run build
```

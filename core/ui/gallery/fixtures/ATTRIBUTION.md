# 2D media library (imported from the Mochi project)

The Mochi project's media asset tree, imported for creating and previewing 2D
characters (see [`dev/docs/roadmap/2D_Character_Pipeline.md`](../../../dev/docs/roadmap/2D_Character_Pipeline.md)).
`CATALOG.json` is the built index — **149 renderable assets** across images, gifs,
video, and bitmaps (`aether_animation.asset_catalog.build_catalog`).

| Folder | Contents | Engine adapter |
|---|---|---|
| `png/` · `bmps/` | raster images (PNG/BMP) | `ImageAdapter` |
| `gifs/` | ~70 animated gifs (pixel art, 32×32 and up) | `GifAdapter` |
| `video/` | ~31 mp4 clips (the bulk of the size, ~25 MB) | `VideoAdapter` |
| `bitmaps/` | 8×8 monochrome-packed JSON (eye states) | `BitmapAdapter` |
| `animations/` | eye-animation JSON (Mochi's declarative format) | *not yet ported* |
| `math/` · `procedural/` | procedural Python scripts | *not ported (use registered faces)* |
| `mscripts/` | `.mscript` timeline scripts | `aether_animation.raster.mscript_runner` |
| `packs/` · `skins/` | pack/skin manifests (`aether_animation.pack` / `aether_animation.skin`) | — |

Most media assets have a sibling `.props.yaml` sidecar (`asset-props/v1`).

## Use them

- **Example characters** built from this media:
  [`examples/pixel_pet_2d.character.anima`](../../pixel_pet_2d.character.anima)
  (`png/colorwheel.png` + procedural face) and
  [`examples/dino_screen_2d.character.anima`](../../dino_screen_2d.character.anima)
  (`gifs/DinoRun2.gif`). Copy one, swap the `asset:` path to any file here, and
  render it.
- **Preview any asset** (needs the `media` extra: `pip install -e '.[media]'`):
  ```bash
  python -m aether_animation.raster.preview media examples/assets/2d/gifs/<any>.gif --gif out.gif
  python -m aether_animation.raster.preview media examples/assets/2d/png/<any>.png --matrix 64x64 --png panel.png
  ```
- **In the app:** the 2D workspace preview's subject picker renders the built-ins.
- **Rebuild `CATALOG.json`** after adding assets:
  ```python
  from aether_animation.asset_catalog import build_catalog, catalog_to_json
  open("examples/assets/2d/CATALOG.json", "w").write(catalog_to_json(build_catalog("examples/assets/2d")))
  ```

## Notes

- **Size:** ~37 MB, mostly `video/` (~25 MB). If you don't want that in git history,
  `.gitignore` `examples/assets/2d/video/` (or use git-LFS) before committing.
- **`.json` kind:** the catalog labels every `.json` as `bitmap`; `animations/` and
  `procedural/` JSONs are other formats (not yet renderable) — ignore those rows.
- **Incomplete in Mochi:** `packs/` has no real pack yet (README only) and
  `skins/tv1/` is missing its `body.png` — add those to author a full pack/skin.

## Provenance / licensing

Imported from the Mochi project's local test assets for AnimaStudio development.
The 8×8 bitmaps + their sidecars are Mochi-authored; many gifs/images/videos are
third-party pixel art gathered for testing. **Treat this folder as a dev fixture,
not shipping content — review licensing before distributing.**

# AetherStudio — Alpha 0.1

Release tag: `v0.1.0-alpha.1`. This is a developer preview.

## Shared interface

The approved Model Studio design is the default: a transparent document header,
compact app/settings/account controls, floating resizable side cards, matched
216px default side widths, a separate auxiliary tray and contextual tool trays.
Saved layout and theme preferences remain respected. The shared presentation is
implemented in Aether UI rather than copied into each product. Existing product
commands, document formats and engine ownership are retained.

All eight frontends consume Aether UI `0.2.0-alpha.145` and artwork
`0.2.0-alpha.27`. Product-specific session packages retain their existing runtime
code with compatible peer metadata. Model Studio rendering and environment
presets, shared feature-tree controls, icons and branding remain in Aether UI
and Aether Assets.

## Get the versioned packages

The large dependency archives are attached to the GitHub release. After checking
out this tag, run:

```sh
python3 tools/fetch-vendor.py
```

The script verifies every archive against `vendor-manifest.json` before installing
it in the expected local vendor path. It can be rerun without downloading verified
files. Then follow the normal repository setup instructions.

See `suite.py`, `projects.json`, and `dev/rebuild/README.md` for Studio server and multi-repository setup.
The UI gallery is in `core/ui`; Studio and Drive frontends are in `studio` and `drive`.

The web build archive is a frontend bundle, not a desktop installer or a bundled
server. Product APIs must be provided for connected operations.

## Current limits

Includes the Studio server, Drive, Aether UI, shared artwork and drawing foundation. Native desktop installers and automatic upgrades are not part of this release. Existing installations are not switched by downloading this source. PostgreSQL and product runtime adapters must be configured using the repository setup documentation.

Third-party components and artwork retain their individual licenses and
attributions. This release does not change those terms.

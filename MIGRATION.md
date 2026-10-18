## GitHub checkout handoff — 2026-10-10

Active development is now in `AetherStudio`. The existing app snapshot was
imported from `Temp Aether` into this GitHub-linked checkout. Source history and
original starter files are preserved there; this checkout keeps its GitHub
history and origin. No upload or running-installation cutover was performed.
Studio (server, Drive and shared packages) lives in `../AetherStudio`.
Earlier migration notes below describe historical folder names.

# Local project structure complete

Use this folder for new development. Relevant current-branch Git history was
filtered into this repository and the extracted working snapshot is preserved in
a local integration commit. `SOURCE_HISTORY.json` records its origin. The GitHub origin is configured; see SOURCE_HISTORY.json. Original branches/tags and working changes remain in the original
monorepo, whose live installation is unchanged.

See `../AetherStudio/LOCAL_DEVELOPMENT.md` for setup and launch instructions,
and `../AetherStudio/migration/LOCAL_STRUCTURE_COMPLETE.md` for acceptance.
Native desktop packaging and production deployment are separate release work.

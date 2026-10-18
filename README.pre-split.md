# Aether Studio

## Open Aether Studio

The independent local host and admin workspace are implemented. Open the root
**Aether Studio.app**, or run `zsh core/host/install-macos.sh` to build/install the
background service and browser shortcuts. Default: **http://localhost:8780**.
First run opens a guided Welcome → Workspace → Administrator → Applications → Review
setup. Afterward the default home shows app cards and Sign in; direct app links
return to their destination after authentication. Double-click **Install Aether
Studio.command** for installation with prerequisite checks and numbered progress.
Use Safari **File → Add to Dock** for application windows.

The admin sidebar manages bundled apps, users, teams, roles, service accounts,
backups, network settings and activity. Community plugins remain planned.
See [host installation, administration and recovery](core/host/README.md).



A collection of high-quality open-source creative and engineering applications.
Our direction is web-based software: install Aether Studio on a locally hosted
computer or server, then use its applications from browsers across devices.

**One installation, multiple application packages is the target, not a shipped
installer today.** The repository already contains working web applications and
shared foundations. See [current status](dev/docs/reality/STATUS.md) and the
[Aether Studio suite plan](dev/docs/roadmap/Aether_Studio_Suite.md).

Shared infrastructure lives under [`core/`](core/README.md), with separately
importable engine and UI packages.

## Applications and shared code

| Component | Location | Current state |
| --- | --- | --- |
| Aether CAD | `Aether CAD/` | React/TypeScript editor, exact OCCT/WASM Part modeling, engine-backed Assembly workflows |
| Aether Animation (formerly Anima Studio) | `aether-animation/web/` | React/TypeScript authoring rebuild using the Python engine; earlier Swift app archived |
| Aether Dynamics | `aether-dynamics/` | Product scaffold; simulation application planned |
| Aether CAD engine (parked) | `Aether CAD/aether-engine/` | The CAD product's own TypeScript engine (`@aether/core`): sketch/document/geometry/assembly modules and the OCCT kernel adapter. Product-owned, not suite-shared |
| Aether UI | `core/ui/` | Shared React widgets, design tokens and workspace chrome |
| AnimaCore | `aether_animation/` | Canonical Python animation engine and persistent Assembly workspace producer; consolidation into Core remains planned |
| Onshape-style mockup | `onshape mockup/` | React/TypeScript/Three.js interaction prototype; fixture geometry, not a CAD engine |
| Hardware firmware | `firmware/` | Animation output device firmware |

## Development

The local folder is **Aether Studio**. The GitHub remote retains its existing
name until a separate repository rename.

```sh
git clone https://github.com/JenkinsRobotics/AnimaStudio.git "Aether Studio"
cd "Aether Studio"
python3.11 -m venv .venv
.venv/bin/pip install -e ".[dev]"
.venv/bin/python -m aether_animation.httpbridge
```

With the engine running, start an application in another terminal:

```sh
cd core/ui
npm install
cd "../../Aether CAD"
npm install
npm run dev
```

For Animation, use `aether-animation/web/` instead and run `npm install` and
`npm run dev`. These are development entry points, not the planned suite
installer. Current loopback transport and development configuration need work
before using the same installation from another device.

## Architecture and documentation

React owns application presentation. Aether UI supplies shared controls.
Aether Core and the existing Python engine own their respective authoritative
semantics; view code must not duplicate them. Hardware adapters consume evaluated
motion. The mockup guides interaction design while production engine behavior is
preserved. Swift is an archived behavior reference or optional launcher, not
the primary product UI.

- [Suite architecture and migration plan](dev/docs/roadmap/Aether_Studio_Suite.md)
- [Shared UI decision](dev/docs/roadmap/UI_Framework_Decision.md)
- [CAD engine architecture](Aether%20CAD/aether-engine/ARCHITECTURE.md)
- [Animation product](aether-animation/README.md)
- [Shipped status](dev/docs/reality/STATUS.md)
- [Contributor contract](AGENTS.md) and [conventions](CONVENTIONS.md)

## License

[Apache-2.0](LICENSE) © Jenkins Robotics. Imported third-party references and
dependencies retain their own licenses.

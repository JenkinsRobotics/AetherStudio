"""Resolve installed product inputs for disposable integration tests only."""

import json
import shutil
import sys
from pathlib import Path


def configure(root, env):
    projects = json.loads((root / "projects.json").read_text())["projects"]
    for app, service, filename in [
        ("map", "aether_map_service", "automation-show.aethermap"),
        ("cad", "aether_cad_service", "automation-part.acpart"),
    ]:
        product = (root / projects[app]).resolve()
        for suffix, default in [
            ("WORKER", product / f"service/{service}/runtime/native-worker.json"),
            ("FIXTURE", product / f"service/tests/fixtures/{filename}"),
        ]:
            key = f"AETHER_TEST_{app.upper()}_{suffix}"
            path = Path(env.get(key) or default)
            if not path.is_file():
                raise SystemExit(
                    f"Missing {key}: build the installed {app} automation package first."
                )
            env[key] = str(path.resolve())
    candidates = [
        shutil.which("freecadcmd"),
        shutil.which("FreeCADCmd"),
        "/Applications/FreeCAD.app/Contents/Resources/bin/freecadcmd",
    ]
    freecad = env.get("AETHER_TEST_CAD_FREECAD") or next(
        (p for p in candidates if p and Path(p).is_file()), None
    )
    for key, value in [
        ("AETHER_TEST_NODE", env.get("AETHER_TEST_NODE") or shutil.which("node")),
        ("AETHER_TEST_CAD_PYTHON", env.get("AETHER_TEST_CAD_PYTHON") or sys.executable),
        ("AETHER_TEST_CAD_FREECAD", freecad),
    ]:
        if not value or not Path(value).is_file():
            raise SystemExit(
                f"{key} requires an installed executable; no acceptance tests skipped."
            )
        env[key] = str(Path(value).resolve())

"""Explicit installation paths for independently released Aether products.

Configuration is operator-owned, never supplied by an HTTP request.
"""
import json
import os
from pathlib import Path

PLATFORM = Path(__file__).resolve().parents[2]

def project_path(name):
    manifest = Path(os.environ.get("AETHER_PROJECTS_FILE", PLATFORM / "projects.json")).resolve()
    data = json.loads(manifest.read_text())
    if data.get("schema") != 1:
        raise ValueError("Unsupported Aether project manifest")
    value = data["projects"][name]
    return (manifest.parent / value).resolve()

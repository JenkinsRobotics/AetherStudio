"""The browser file adapter consumes immutable generated protocol, not sibling source."""

import json
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def main():
    package = json.loads((ROOT / "core/files/package.json").read_text())
    dependency = package["dependencies"]["@aether/protocol"]
    require(
        dependency.startswith("file:vendor/") and ".." not in dependency,
        "Use a pinned protocol archive in vendor/.",
    )
    archive = ROOT / "core/files" / dependency.removeprefix("file:")
    with tarfile.open(archive) as contents:
        for member in ["dist/index.js", "dist/index.d.ts"]:
            source = contents.extractfile("package/" + member)
            require(source is not None, "Protocol archive is incomplete.")
            require(
                source.read() == (ROOT / "core/protocol" / member).read_bytes(),
                "Pinned protocol differs from generated source: bump its version, "
                "publish a new immutable local archive and update the file adapter.",
            )
        source = contents.extractfile("package/package.json")
        require(source is not None, "Protocol archive is missing its manifest.")
        pinned = json.load(source)
        current = json.loads((ROOT / "core/protocol/package.json").read_text())
        for field in ["version", "name", "exports"]:
            require(pinned[field] == current[field], "Protocol package metadata drifted.")
    require(
        set(package["dependencies"]) == {"@aether/protocol"},
        "Browser files must not acquire a server, SQL or UI dependency.",
    )
    print("Browser file package consumes matching pinned protocol; no server or SQL.")


if __name__ == "__main__":
    main()

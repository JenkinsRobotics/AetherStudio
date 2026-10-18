"""Freeze four trusted, already-built native app adapters into a NEW private tree.

No builds, downloads, account state, database changes or service startup. Native
runtime loaders remain the validators of their formats. External Node/Python and
FreeCAD executables remain explicit installation dependencies, not copied apps.
"""

import argparse
import hashlib
import json
import stat
from pathlib import Path

from native_installation import (
    InstallationError,
    executable,
    new_destination,
    private,
    require,
    write,
)

KINDS = {
    "AETHER_NATIVE_FRONTENDS",
    "AETHER_NATIVE_PRODUCTS",
    "AETHER_NATIVE_ANIMATION",
    "AETHER_NATIVE_MAP_DOWNLOADS",
}


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def read_json(path):
    require(path.is_file() and not path.is_symlink(), "Invalid adapter manifest.")
    require(path.stat().st_size <= 1024 * 1024, "Adapter manifest exceeds limit.")
    value = json.loads(path.read_text())
    require(
        isinstance(value, dict) and value.get("schema") == 1, "Unknown adapter schema."
    )
    return value


def stage(adapters, destination):
    paths = json.loads(private(adapters).read_text())
    require(set(paths) == KINDS, "Supply exactly the four app adapter manifests.")
    require(
        all(isinstance(p, str) and Path(p).is_absolute() for p in paths.values()),
        "Adapter manifest paths must be absolute.",
    )
    root = new_destination(destination)
    files, originals, directories, dependencies, result = {}, {}, {}, {}, {}
    total = 0

    def copy(source, relative, expected=None):
        nonlocal total
        source = Path(source).absolute()
        meta = source.lstat()
        require(stat.S_ISREG(meta.st_mode), "Runtime inputs must be regular files.")
        require(meta.st_size <= 128 * 1024 * 1024, "Runtime file exceeds limit.")
        total += meta.st_size
        require(
            total <= 1024 * 1024 * 1024 and len(files) < 100000,
            "Runtime snapshot exceeds limit.",
        )
        target = root / relative
        require(
            target.is_relative_to(root) and ".." not in Path(relative).parts,
            "Invalid runtime destination.",
        )
        target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        # Read once, write a private file, then independently verify its digest.
        content = source.read_bytes()
        sha = hashlib.sha256(content).hexdigest()
        require(
            len(content) == meta.st_size and (expected is None or sha == expected),
            "Runtime input changed or fails its manifest digest.",
        )
        write(target, content)
        require(digest(target) == sha, "Runtime copy verification failed.")
        files[str(relative)] = {"bytes": len(content), "sha256": sha}
        require(
            str(source) not in originals or originals[str(source)] == sha,
            "Runtime input changed while staging.",
        )
        originals[str(source)] = sha
        return target

    def tree(source, relative):
        source = Path(source).absolute()
        require(source.is_dir() and not source.is_symlink(), "Invalid build directory.")
        directories[str(source)] = sorted(
            p.name for p in source.iterdir() if not p.name.startswith(".")
        )
        (root / relative).mkdir(parents=True, mode=0o700)
        for entry in sorted(source.iterdir()):
            if entry.name.startswith("."):
                continue
            require(not entry.is_symlink(), "Symlink build entries are refused.")
            if entry.is_dir():
                tree(entry, relative / entry.name)
            else:
                copy(entry, relative / entry.name)

    def manifest(name, value):
        path = root / name
        write(path, json.dumps(value, indent=2).encode() + b"\n")
        files[name] = {"bytes": path.stat().st_size, "sha256": digest(path)}
        return str(path)

    def dependency(path):
        original = Path(path).absolute()
        resolved = executable(original)
        dependencies[str(original)] = {
            "resolved": str(resolved),
            "sha256": digest(resolved),
        }

    def load(kind):
        path = Path(paths[kind])
        originals[str(path)] = digest(path)
        value = read_json(path)
        return path, value

    front_path, front = load("AETHER_NATIVE_FRONTENDS")
    require(
        set(front) == {"schema", "studio", "session", "icons", "branding", "apps"},
        "Unsupported frontend configuration.",
    )
    for key in ("studio", "icons", "branding"):
        source = (front_path.parent / front[key]).absolute()
        tree(source, Path("frontends") / key)
        front[key] = str(root / "frontends" / key)
    for app, source in front["apps"].items():
        require(
            app in {"cad", "map", "io", "animation", "sketch", "vector", "drive", "ui"},
            "Unknown frontend app.",
        )
        tree(front_path.parent / source, Path("frontends/apps") / app)
        front["apps"][app] = str(root / "frontends/apps" / app)
    for name in ("account.js", "account.css"):
        copy(
            front_path.parent / front["session"] / name,
            Path("frontends/session") / name,
        )
    front["session"] = str(root / "frontends/session")
    result["AETHER_NATIVE_FRONTENDS"] = manifest("frontends.json", front)

    _, products = load("AETHER_NATIVE_PRODUCTS")
    for key in ("node", "python", "freecad"):
        if products.get(key):
            dependency(products[key])
    installed = []
    for source in products["manifests"]:
        source = Path(source)
        originals[str(source.absolute())] = digest(source)
        value = read_json(source)
        require(
            value["app"] in ("map", "cad")
            and value["entry"] in ("runner.mjs", "runner.pyz"),
            "Unsupported product bundle.",
        )
        directory = Path("products") / value["app"]
        copy(
            source.parent / value["entry"], directory / value["entry"], value["sha256"]
        )
        installed.append(str(copy(source, directory / "native-worker.json")))
    products["manifests"] = installed
    result["AETHER_NATIVE_PRODUCTS"] = manifest("products.json", products)

    _, animation = load("AETHER_NATIVE_ANIMATION")
    dependency(animation["python"])
    animation["archive"] = str(
        copy(
            animation["archive"],
            Path("animation/animation-worker.pyz"),
            animation["sha256"],
        )
    )
    result["AETHER_NATIVE_ANIMATION"] = manifest("animation.json", animation)

    download_path, downloads = load("AETHER_NATIVE_MAP_DOWNLOADS")
    for name, value in downloads["files"].items():
        require(
            name
            in {
                "install.sh",
                "aether_player.py",
                "aether_setup.py",
                "aether_receiver.py",
                "aether-projector-setup.sh",
                "app.zip",
            },
            "Unknown player download.",
        )
        copied = copy(
            download_path.parent / name, Path("map-downloads") / name, value["sha256"]
        )
        require(
            copied.stat().st_size == value["size"], "Player download size mismatch."
        )
    result["AETHER_NATIVE_MAP_DOWNLOADS"] = str(
        copy(download_path, Path("map-downloads/map-downloads.json"))
    )
    # A changing build must not silently become a mixed installation generation.
    for source, sha in originals.items():
        require(
            digest(Path(source)) == sha,
            "Source changed while staging; retry a new generation.",
        )
    for source, names in directories.items():
        require(
            sorted(p.name for p in Path(source).iterdir() if not p.name.startswith("."))
            == names,
            "Build directory changed while staging; retry a new generation.",
        )
    manifest("adapters.json", result)
    report = {
        "schema": 1,
        "files": files,
        "external_dependencies": dependencies,
        "sources": originals,
        "total_payload_bytes": total,
        "services_started": False,
    }
    write(root / "runtime-manifest.json", json.dumps(report, indent=2).encode() + b"\n")
    return {
        "files": len(files),
        "payload_bytes": total,
        "external_dependencies": len(dependencies),
        "adapters": str(root / "adapters.json"),
        "services_started": False,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--adapters", type=Path, required=True)
    parser.add_argument("--destination", type=Path, required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(stage(args.adapters, args.destination)))
    except (InstallationError, OSError, ValueError, KeyError, TypeError):
        raise SystemExit(
            "Runtime staging refused; retain the private candidate for diagnosis."
        ) from None

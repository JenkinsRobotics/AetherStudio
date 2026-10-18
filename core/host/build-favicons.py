"""Package tab-sized copies of the active rounded PNGs as browser ICO files."""

import argparse
import hashlib
import re
import shutil
import struct
import subprocess
import tempfile
from pathlib import Path

WEB_ROOTS = {
    "studio": "studio", "cad": "Aether CAD", "animation": "aether-animation/web",
    "ui": "core/ui/gallery", "map": "aether-map", "sketch": "aether-sketch", "vector": "aether-vector",
    "io": "aether-io", "drive": None,
}


def build(directory, apps=None):
    root = directory.parents[3]
    for app, package in WEB_ROOTS.items():
        if apps is not None and app not in apps:
            continue
        source = directory / f"{app}.png"
        frames = []
        with tempfile.TemporaryDirectory(prefix="aether-favicon-") as temporary:
            for size in (16, 32, 48):
                target = Path(temporary) / f"{size}.png"
                subprocess.run(
                    ["sips", "-z", str(size), str(size), str(source), "--out", str(target)],
                    check=True, stdout=subprocess.DEVNULL,
                )
                frames.append((size, target.read_bytes()))
        # ICO permits PNG-compressed frames. Preserve the original PNG alpha;
        # the operating system chooses a tab-sized frame without a second logo.
        offset = 6 + 16 * len(frames)
        entries = []
        for size, data in frames:
            entries.append(struct.pack("<BBBBHHII", size, size, 0, 0, 1, 32, len(data), offset))
            offset += len(data)
        icon = source.with_suffix(".ico")
        icon.write_bytes(
            struct.pack("<HHH", 0, 1, len(frames))
            + b"".join(entries) + b"".join(data for _, data in frames)
        )
        # Public assets also work in Vite development and standalone exports.
        # These are generated copies, never separately authored identities.
        if package is None:
            print(f"Updated {source.stem} hosted tab icon (16, 32, 48px).")
            continue
        public = root / package / "public"
        public.mkdir(exist_ok=True)
        shutil.copyfile(icon, public / "favicon.ico")
        index = root / package / "index.html"
        digest = hashlib.sha256(icon.read_bytes()).hexdigest()[:12]
        index.write_text(re.sub(
            r'(<link\b[^>]*\brel="icon"[^>]*\bhref=")[^"]+("[^>]*>)',
            lambda match: match[1] + f"./favicon.ico?v={digest}" + match[2],
            index.read_text(),
        ))
        print(f"Updated {source.stem} tab icon (16, 32, 48px).")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--apps", nargs="+", choices=tuple(WEB_ROOTS))
    args = parser.parse_args()
    build(Path(__file__).resolve().parents[2] / "core/assets/branding/apps", args.apps)

"""Build tiny macOS shortcuts which open the independent Studio web host."""

import argparse
import tempfile
import shutil
import plistlib
import shlex
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument("app", choices=["studio", "cad", "animation", "ui", "map", "sketch", "vector", "io", "drive"])
args = parser.parse_args()
names = {
    "studio": "Aether Studio",
    "cad": "Aether CAD",
    "animation": "Aether Animation",
    "ui": "Aether UI",
    "map": "Aether Map",
    "sketch": "Aether Sketch",
    "vector": "Aether Vector",
    "io": "Aether IO",
    "drive": "Aether Drive",
}
name = names[args.app]
bundle = REPO / f"{name}.app"
# Build in a staging directory; replace only after signing succeeds.
with tempfile.TemporaryDirectory(prefix="aether-browser-launcher-") as directory:
    staging = Path(directory) / bundle.name
    executable = staging / "Contents/MacOS" / name
    executable.parent.mkdir(parents=True)
    executable.write_text(
        "#!/bin/zsh\nset -e\ncd "
        + shlex.quote(str(REPO))
        + "\n"
        + "launchctl start studio.aether.host\n"
        + shlex.quote(str(REPO / ".venv/bin/python"))
        + " -m core.host open --app "
        + shlex.quote(args.app)
        + "\n"
    )
    executable.chmod(0o755)
    resources = staging / "Contents/Resources"
    resources.mkdir()
    iconset = Path(directory) / "AppIcon.iconset"
    iconset.mkdir()
    source = REPO / f"core/assets/branding/apps/{args.app}.png"
    for size in (16, 32, 128, 256, 512):
        for scale in (1, 2):
            target = iconset / f"icon_{size}x{size}{'@2x' if scale == 2 else ''}.png"
            subprocess.run(
                [
                    "sips",
                    "-z",
                    str(size * scale),
                    str(size * scale),
                    str(source),
                    "--out",
                    str(target),
                ],
                check=True,
                stdout=subprocess.DEVNULL,
            )
    subprocess.run(
        [
            "iconutil",
            "--convert",
            "icns",
            "--output",
            str(resources / "AppIcon.icns"),
            str(iconset),
        ],
        check=True,
    )
    with (staging / "Contents/Info.plist").open("wb") as file:
        plistlib.dump(
            {
                "CFBundleName": name,
                "CFBundleDisplayName": name,
                "CFBundleIdentifier": f"studio.aether.browser.{args.app}",
                "CFBundleExecutable": name,
                "CFBundlePackageType": "APPL",
                "CFBundleIconFile": "AppIcon",
                "CFBundleShortVersionString": "0.2.0",
                "LSUIElement": True,
            },
            file,
        )
    subprocess.run(["codesign", "--force", "--sign", "-", str(staging)], check=True)
    if bundle.exists():
        shutil.rmtree(bundle)
    shutil.copytree(staging, bundle)
print(f"Built browser shortcut: {bundle}")

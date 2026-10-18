"""Inspect and maintain this source installation without deleting server data."""

import argparse
import json
import os
import platform
import plistlib
import re
import shlex
import shutil
import subprocess
import sys
from pathlib import Path

from core.host.installation import default_directory, platform_paths, server_lease

REPO = Path(__file__).resolve().parents[2]
LABEL = "studio.aether.host"
LAUNCHERS = {
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


def command_line(arguments):
    if sys.platform == "win32":
        return "& " + " ".join(
            "'" + str(arg).replace("'", "''") + "'" for arg in arguments
        )
    return shlex.join(str(arg) for arg in arguments)


def installation_plan(directory, root=REPO):
    directory, root = Path(directory).resolve(), Path(root).resolve()
    python = root / (
        ".venv/Scripts/python.exe" if sys.platform == "win32" else ".venv/bin/python"
    )
    prefix = [str(python), "-m", "core.host.maintenance"]
    actions = {}
    for action in ("inspect", "repair", "uninstall"):
        args = [*prefix, action, "--data", str(directory)]
        actions[action] = {
            "preview": command_line(args),
            "apply": command_line([*args, "--apply"]),
        }
    return {
        "platform": "macOS" if sys.platform == "darwin" else platform.system(),
        "python_version": platform.python_version(),
        "source_directory": str(root),
        "data_directory": str(directory),
        "configuration_file": str(platform_paths()[1]),
        "service": "macOS per-user LaunchAgent"
        if sys.platform == "darwin"
        else "Foreground / externally managed service",
        "managed_lifecycle": sys.platform == "darwin",
        "commands": actions,
        "working_directory": command_line(
            ["Set-Location" if sys.platform == "win32" else "cd", str(root)]
        ),
        "retained": [
            "Accounts and permissions",
            "Files and version history",
            "Backups and certificates",
            "Installation configuration",
            "Source checkout and dependencies",
        ],
    }


def diagnostics(host):
    settings = host.running_settings
    return {
        "installation": installation_plan(host.store.directory),
        "network": {
            key: settings[key] for key in ("name", "public_url", "bind_address", "port")
        },
        "https": bool(settings["tls_cert"]),
        "restart_required": settings != host.store.settings(),
        "storage": host.storage.state(),
        "counts": {
            "users": host.store.db.execute("SELECT count(*) FROM users").fetchone()[0],
            "documents": host.store.db.execute(
                "SELECT count(*) FROM library WHERE kind!='folder'"
            ).fetchone()[0],
        },
        "applications": [
            {"id": key, "installed": (value[2] / "index.html").is_file()}
            for key, value in host.packages.items()
        ],
    }


def owned_launchers(root):
    result = []
    for app, name in LAUNCHERS.items():
        bundle = root / (name + ".app")
        if not bundle.exists():
            continue
        if bundle.is_symlink():
            raise ValueError(f"Refusing to remove a linked app: {bundle}")
        try:
            info = plistlib.loads((bundle / "Contents/Info.plist").read_bytes())
        except (OSError, ValueError) as error:
            raise ValueError(f"Cannot verify browser shortcut: {bundle}") from error
        if info.get("CFBundleIdentifier") != f"studio.aether.browser.{app}":
            raise ValueError(f"Not a generated Studio browser shortcut: {bundle}")
        result.append(bundle)
    return result


def verify_service(plist, root, directory):
    if not plist.exists():
        return
    if plist.is_symlink():
        raise ValueError("Refusing to modify a linked service file.")
    config = plistlib.loads(plist.read_bytes())
    args = config.get("ProgramArguments", [])
    if (
        config.get("Label") != LABEL
        or config.get("WorkingDirectory") != str(root)
        or args[:4] != [str(root / ".venv/bin/python"), "-m", "core.host", "serve"]
    ):
        raise ValueError(
            "Service belongs to a different installation; no changes made."
        )
    active = (
        Path(args[args.index("--data") + 1]).resolve()
        if "--data" in args
        else default_directory().resolve()
    )
    if active != directory:
        raise ValueError("Service uses a different data folder; no changes made.")


def apply(action, directory, root=REPO):
    if action not in ("repair", "uninstall"):
        raise ValueError("Unknown maintenance action.")
    if sys.platform != "darwin":
        raise ValueError(
            "Managed repair/uninstall is currently available for the Mac installer. Stop your externally managed service and use its OS installer on other hosts."
        )
    directory, root = Path(directory).resolve(), Path(root).resolve()
    if not (directory / "studio.sqlite3").is_file():
        raise ValueError("No existing Studio installation in this data folder.")
    plist = Path.home() / "Library/LaunchAgents" / (LABEL + ".plist")
    verify_service(plist, root, directory)
    bundles = owned_launchers(root) if action == "uninstall" else []
    if action == "uninstall" and (
        root.is_relative_to(directory)
        or any(directory.is_relative_to(bundle) for bundle in bundles)
    ):
        raise ValueError(
            "Data overlaps the installation or a shortcut; separate data before uninstalling."
        )
    target = f"gui/{os.getuid()}/{LABEL}"
    running = subprocess.run(["launchctl", "print", target], capture_output=True)
    if running.returncode == 0:
        if not plist.exists():
            raise ValueError(
                "Loaded service has no verifiable installation file. Stop it using the OS service manager first."
            )
        # Verify the loaded job is from this checkout, even if its plist was replaced.
        loaded = running.stdout.decode(errors="replace")
        if f"working directory = {root}\n" not in loaded:
            raise ValueError(
                "Loaded service belongs to another checkout; no changes made."
            )
        match = re.search(r"\n\s*--data\s*\n\s*([^\n]+)", loaded)
        if match and Path(match.group(1).strip()).resolve() != directory:
            raise ValueError(
                "Loaded service uses another data folder; no changes made."
            )
        subprocess.run(["launchctl", "bootout", target], check=True)
    with server_lease(directory):
        if action == "uninstall":
            plist.unlink(missing_ok=True)
            for bundle in bundles:
                shutil.rmtree(bundle)
            return {
                "removed": [str(plist), *map(str, bundles)],
                "data_preserved": str(directory),
            }
        # Create a recoverable snapshot with the live service stopped, before builds.
        from core.host.server import StudioHost

        host = StudioHost(directory)
        try:
            name = host.backup()
        finally:
            host.store.db.close()
    subprocess.run(
        ["zsh", str(root / "core/host/install-macos.sh"), "--data", str(directory)],
        cwd=root,
        check=True,
    )
    return {"backup": name, "data_preserved": str(directory)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("inspect", "repair", "uninstall"))
    parser.add_argument("--data", type=Path)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Perform the displayed action. Otherwise print the plan only.",
    )
    args = parser.parse_args()
    directory = (args.data or default_directory()).expanduser().resolve()
    plan = installation_plan(directory)
    if args.action == "inspect" or not args.apply:
        print(
            json.dumps({"action": args.action, "preview_only": True, **plan}, indent=2)
        )
        return
    try:
        print(json.dumps(apply(args.action, directory), indent=2))
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError) as error:
        parser.exit(
            1,
            f"Maintenance stopped: {error}\nServer data has not been deleted. Correct the issue and run repair again if the service is stopped.\n",
        )


if __name__ == "__main__":
    main()

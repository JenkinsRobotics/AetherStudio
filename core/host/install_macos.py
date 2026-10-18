"""Persist a Mac installation and generate its launch agent with explicit paths."""

import argparse
import os
import plistlib
import re
import subprocess
from pathlib import Path

from core.host.installation import (
    configure_directory,
    default_directory,
    local_directory,
)
from core.host.server import StudioHost


def launch_agent(root, directory):
    return {
        "Label": "studio.aether.host",
        "ProgramArguments": [
            str(root / ".venv/bin/python"),
            "-m",
            "core.host",
            "serve",
            "--data",
            str(directory),
        ],
        "WorkingDirectory": str(root),
        "RunAtLoad": True,
        "KeepAlive": True,
        "ThrottleInterval": 10,
        "Umask": 63,
        "StandardOutPath": str(directory / "logs/host.log"),
        "StandardErrorPath": str(directory / "logs/host-error.log"),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path)
    parser.add_argument("--backup-directory")
    args = parser.parse_args()
    directory = local_directory(args.data or default_directory())
    domain = f"gui/{os.getuid()}"
    plist = Path.home() / "Library/LaunchAgents/studio.aether.host.plist"
    existing = subprocess.run(
        ["launchctl", "print", domain + "/studio.aether.host"], capture_output=True
    )
    running = existing.returncode == 0
    if running:
        # Inspect the loaded job, not the possibly newer plist on disk.
        match = re.search(r"\n\s*--data\s*\n\s*([^\n]+)", existing.stdout.decode())
        active = Path(match.group(1).strip()) if match else default_directory()
        if directory != active.resolve():
            parser.error(
                "Stop the existing host before changing its data location. Back up and restore its data into the new folder first."
            )
        if args.backup_directory is not None:
            parser.error(
                "For a running installation, choose the backup destination in Administration > Backups."
            )
    else:
        host = StudioHost(directory)
        try:
            if args.backup_directory is not None:
                host.storage.configure(
                    {"interval_hours": 24, "export_directory": args.backup_directory}
                )
        finally:
            host.store.db.close()
    (directory / "logs").mkdir(parents=True, exist_ok=True, mode=0o700)
    configure_directory(directory)
    plist.parent.mkdir(parents=True, exist_ok=True)
    with plist.open("wb") as stream:
        plistlib.dump(launch_agent(Path.cwd(), directory), stream)
    plist.chmod(0o600)
    if running:
        print(
            "Host already running; data preserved. Updated service paths take effect on its next load."
        )
    else:
        subprocess.run(["launchctl", "bootstrap", domain, str(plist)], check=True)
    print(f"Server data: {directory}")


if __name__ == "__main__":
    main()

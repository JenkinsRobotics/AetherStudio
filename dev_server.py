"""Inspect the native installation, or explicitly serve a private native config.

The preserved .dev-data database is a migration source, never the default writer.
macOS launchd owns the installed server; --serve is for isolated development.
"""

import argparse
import json
import os
import urllib.error
import urllib.request
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--serve", action="store_true", help="Run a native host in the foreground")
    parser.add_argument("--config", type=Path, help="Explicit private native installation JSON")
    parser.add_argument("--binary", type=Path, help="Explicit native host executable")
    args = parser.parse_args()
    if bool(args.config) != bool(args.binary):
        parser.error("Supply --config and --binary together for an isolated native host.")
    if args.config:
        if not args.serve:
            parser.error("An explicit development configuration requires --serve.")
        binary, config = args.binary, args.config
    else:
        marker = Path.home() / "Library/Application Support/Aether Studio Native/current-installation.json"
        if not marker.is_file():
            parser.error("No native installation is registered. See dev/rebuild/NATIVE_INSTALLATION.md.")
        installation = json.loads(marker.read_text())
        binary, config = Path(installation["binary"]), Path(installation["config"])
        if not args.serve:
            origin = installation["origin"]
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
            try:
                with opener.open(origin + "/api/status", timeout=5) as response:
                    ready = json.load(response).get("ready")
            except (OSError, ValueError, urllib.error.URLError):
                parser.error("Native service is unavailable. Inspect its launchd logs; no legacy fallback was started.")
            print(f"Aether Studio native server: {origin} (ready: {bool(ready)})")
            print("Managed by launchd. App hot reload: AETHER_DEV_SERVER=" + origin + " npm run dev")
            return
    if not binary.is_absolute() or not config.is_absolute() or not binary.is_file() or not config.is_file():
        parser.error("Use existing absolute native binary and configuration paths.")
    os.execv(str(binary), [str(binary), "serve", "--config", str(config)])

if __name__ == "__main__":
    main()

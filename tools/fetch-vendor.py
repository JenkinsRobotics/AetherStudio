#!/usr/bin/env python3
"""Fetch the exact versioned packages for this source release; verify SHA-256."""
import hashlib, json, os, urllib.request
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT / "vendor-manifest.json").read_text())
for item in manifest["packages"]:
    target = ROOT / item["path"]
    if target.is_file() and hashlib.sha256(target.read_bytes()).hexdigest() == item["sha256"]:
        print("Verified", item["path"])
        continue
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix(target.suffix + ".download")
    try:
        request = urllib.request.Request(item["url"], headers={"User-Agent": "Aether-Alpha-Package-Fetcher"})
        with urllib.request.urlopen(request, timeout=120) as response, temporary.open("wb") as output:
            while block := response.read(1024 * 1024):
                output.write(block)
        if hashlib.sha256(temporary.read_bytes()).hexdigest() != item["sha256"]:
            raise RuntimeError("Package checksum mismatch: " + item["path"])
        os.replace(temporary, target)
        print("Downloaded", item["path"])
    finally:
        temporary.unlink(missing_ok=True)

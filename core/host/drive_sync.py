"""Opt-in desktop folder sync: python -m core.host.drive_sync --help.

Only operates in an explicitly selected local directory. Conflicts preserve both
copies, remote revocation retains the local copy, and deletions use Drive trash.
No Finder/File Explorer placeholder extension is installed by this client.
"""

import argparse
import base64
import getpass
import hashlib
import http.cookiejar
import json
import os
import tempfile
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import uuid
from contextlib import suppress
from pathlib import Path

STATE = ".aether-drive-sync.json"


def digest(path):
    result = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            result.update(chunk)
    return result.hexdigest()


def safe_file(root, relative):
    parts = relative.split("/")
    if not parts or any(
        p in ("", ".", "..")
        or p.startswith(".aether-drive-")
        or "\\" in p
        or ":" in p
        or any(ord(c) < 32 for c in p)
        for p in parts
    ):
        raise ValueError("Unsafe remote filename; skipped: " + relative)
    reserved = {
        "CON",
        "PRN",
        "AUX",
        "NUL",
        *[f"COM{i}" for i in range(1, 10)],
        *[f"LPT{i}" for i in range(1, 10)],
    }
    if any(
        p.split(".")[0].upper() in reserved or p.endswith((".", " ")) for p in parts
    ):
        raise ValueError("Filename is not portable: " + relative)
    target = root.joinpath(*parts)
    if not target.resolve().is_relative_to(root.resolve()) or any(
        p.is_symlink() for p in [target, *target.parents] if p != root.parent
    ):
        raise ValueError("Sync does not follow symbolic links: " + relative)
    return target


class DriveClient:
    def __init__(self, url, username, directory):
        self.url = url.rstrip("/")
        parsed = urllib.parse.urlsplit(url)
        if (
            parsed.scheme not in ("http", "https")
            or not parsed.netloc
            or parsed.username
            or parsed.password
            or parsed.path not in ("", "/")
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError("Provide an HTTP(S) Studio URL without credentials.")
        directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        key = hashlib.sha256((self.url + ":" + username).encode()).hexdigest()[:20]
        self.identity = key
        self.cookies = http.cookiejar.LWPCookieJar(str(directory / (key + ".cookies")))
        try:
            self.cookies.load(ignore_discard=True)
        except (FileNotFoundError, http.cookiejar.LoadError):
            pass
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(self.cookies)
        )

    def call(self, action, data):
        return self.request("/api/drive/" + action, data)

    def request(self, path, data):
        req = urllib.request.Request(
            self.url + path,
            json.dumps(data).encode(),
            {"Content-Type": "application/json", "Origin": self.url},
        )
        try:
            with self.opener.open(req, timeout=90) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            body = error.read()
            try:
                message = json.loads(body).get("error", str(error))
            except ValueError:
                message = str(error)
            raise RuntimeError(f"{error.code}: {message}") from None

    def login(self, username):
        try:
            return self.call("context", {})
        except RuntimeError as error:
            if not str(error).startswith("401:"):
                raise
        self.request(
            "/api/login",
            {"username": username, "password": getpass.getpass("Studio password: ")},
        )
        self.cookies.save(ignore_discard=True)
        Path(self.cookies.filename).chmod(0o600)
        return self.call("context", {})

    def download(self, entry, target):
        original = digest(target) if target.is_file() else None
        with tempfile.NamedTemporaryFile(
            dir=target.parent, prefix=".aether-drive-download-", delete=False
        ) as handle:
            temporary = Path(handle.name)
        try:
            with (
                self.opener.open(
                    self.url
                    + "/api/drive/download?id="
                    + urllib.parse.quote(entry["id"]),
                    timeout=90,
                ) as response,
                temporary.open("wb") as output,
            ):
                for chunk in iter(lambda: response.read(1024 * 1024), b""):
                    output.write(chunk)
            if digest(temporary) != entry["sha256"]:
                raise RuntimeError(
                    "Remote content changed during download; retry: " + entry["name"]
                )
            if target.exists() and digest(target) != original:
                target.rename(
                    target.with_name(target.name + f".local-conflict-{time.time_ns()}")
                )
            os.replace(temporary, target)
        finally:
            temporary.unlink(missing_ok=True)

    def upload(self, path, destination, entry=None):
        if entry and entry["app"] != "drive":
            if path.stat().st_size > 6 * 1024 * 1024:
                raise RuntimeError(
                    "Native documents above 6 MB must be saved by their editor."
                )
            return self.call(
                "document",
                {
                    "id": entry["id"],
                    "action": "save",
                    "expected_revision": entry["revision"],
                    "data_base64": base64.b64encode(path.read_bytes()).decode(),
                },
            )
        upload = self.call(
            "upload_begin",
            {
                **destination,
                "operation_id": uuid.uuid4().hex,
                "name": path.name,
                "size": path.stat().st_size,
                **(
                    {"id": entry["id"], "expected_revision": entry["revision"]}
                    if entry
                    else {}
                ),
            },
        )["id"]
        offset = 0
        try:
            with path.open("rb") as handle:
                for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                    self.call(
                        "upload_chunk",
                        {
                            "upload": upload,
                            "offset": offset,
                            "data_base64": base64.b64encode(chunk).decode(),
                        },
                    )
                    offset += len(chunk)
            return self.call(
                "upload_finish", {"upload": upload, "sha256": digest(path)}
            )
        except Exception:
            # Cleanup must not replace the original transfer error.
            with suppress(Exception):
                self.call("upload_cancel", {"upload": upload})
            raise


def local_renames(client, root, destination, remote, old, report):
    """Match moved local files by filesystem identity to preserve Drive IDs."""
    local = {}
    for path in root.rglob("*"):
        if path.is_symlink() or path.name.startswith(".aether-drive-"):
            continue
        stat = path.stat()
        local[(stat.st_dev, stat.st_ino)] = path.relative_to(root).as_posix()
    for entry in remote:
        previous = old.get(entry["id"])
        if (
            not previous
            or entry["trashed"]
            or previous.get("deleted")
            or previous["path"] != entry["path"]
        ):
            continue
        if safe_file(root, previous["path"]).exists():
            continue
        moved = local.get(tuple(previous.get("inode", [])))
        if not moved or moved == previous["path"] or not entry["manageable"]:
            continue
        target = safe_file(root, moved)
        parent_path = target.parent.relative_to(root).as_posix()
        folder = next(
            (
                r
                for r in remote
                if r["kind"] == "folder"
                and r["path"] == parent_path
                and not r["trashed"]
            ),
            None,
        )
        if parent_path != "." and not folder:
            continue
        parent = folder["id"] if folder else destination.get("parent")
        result = client.call(
            "move",
            {
                "id": entry["id"],
                "name": target.name,
                "destination": {**destination, "parent": parent},
            },
        )
        prefix = entry["path"] + "/"
        for child in remote:
            if child["path"].startswith(prefix):
                child["path"] = moved + "/" + child["path"][len(prefix) :]
        for record in old.values():
            if record["path"].startswith(prefix):
                record["path"] = moved + "/" + record["path"][len(prefix) :]
        entry.update(
            {
                "path": moved,
                "name": target.name,
                "parent": parent,
                "revision": result["revision"],
            }
        )
        previous["path"] = moved
        report("Moved: " + moved)


def sync_once(client, root, destination, report=print):
    root = root.resolve()
    root.mkdir(parents=True, exist_ok=True)
    state_path = root / STATE
    state = (
        json.loads(state_path.read_text())
        if state_path.exists()
        else {
            "destination": destination,
            "source": getattr(client, "identity", "local"),
            "files": {},
        }
    )
    if state["destination"] != destination or state.get("source") != getattr(
        client, "identity", "local"
    ):
        raise ValueError(
            "This directory belongs to another Drive location. Choose an empty folder."
        )
    old = state["files"]
    remote = client.call("sync_manifest", destination)["files"]
    paths = [
        unicodedata.normalize("NFC", r["path"]).casefold()
        for r in remote
        if not r["trashed"]
    ]
    if len(paths) != len(set(paths)):
        raise ValueError(
            "Drive contains duplicate filenames at the same path. Rename them in Drive before syncing."
        )
    local_renames(client, root, destination, remote, old, report)
    seen, remote_paths, folders = set(), set(), {"": destination.get("parent")}
    # Reconcile directory renames before their children; unchanged IDs keep
    # local edits associated with the original document and its history.
    removed_folders = []
    for entry in remote:
        if entry["kind"] != "folder":
            continue
        previous = old.get(entry["id"])
        target = safe_file(root, entry["path"])
        if previous and previous["path"] != entry["path"]:
            earlier = safe_file(root, previous["path"])
            if earlier.is_dir() and not target.exists():
                target.parent.mkdir(parents=True, exist_ok=True)
                earlier.rename(target)
                prefix = previous["path"] + "/"
                for record in old.values():
                    if record["path"].startswith(prefix):
                        record["path"] = (
                            entry["path"] + "/" + record["path"][len(prefix) :]
                        )
            previous["path"] = entry["path"]
        if (
            previous
            and not target.exists()
            and not entry["trashed"]
            and not previous.get("deleted")
        ):
            descendants = [
                r for r in remote if r["path"].startswith(entry["path"] + "/")
            ]
            unchanged = all(
                r["id"] in old
                and (r["kind"] == "folder" or r["sha256"] == old[r["id"]].get("hash"))
                for r in descendants
                if not r["trashed"]
            )
            if unchanged and entry["manageable"]:
                client.call("trash", {"id": entry["id"]})
                entry["trashed"] = True
                for child in descendants:
                    child["trashed"] = True
            else:
                # Restore the folder's remote contents, never delete newly
                # arrived changes just because their old local parent vanished.
                for child in descendants:
                    if child["id"] in old:
                        old[child["id"]]["deleted"] = True
        if entry["trashed"]:
            removed_folders.append(target)
    for entry in remote:
        ident, relative = entry["id"], entry["path"]
        seen.add(ident)
        remote_paths.add(relative)
        target = safe_file(root, relative)
        previous = old.get(ident)
        if entry["kind"] == "folder":
            if not entry["trashed"]:
                target.mkdir(parents=True, exist_ok=True)
                folders[relative] = ident
            old[ident] = {
                "path": relative,
                "kind": "folder",
                "deleted": entry["trashed"],
            }
            continue
        if previous and previous["path"] != relative:
            earlier = safe_file(root, previous["path"])
            if (
                earlier.is_file()
                and not target.exists()
                and digest(earlier) == previous["hash"]
            ):
                target.parent.mkdir(parents=True, exist_ok=True)
                earlier.rename(target)
            elif earlier.exists():
                earlier.rename(
                    earlier.with_name(
                        earlier.name + f".local-conflict-{time.time_ns()}"
                    )
                )
                report("Kept local conflict after a remote rename: " + previous["path"])
        local_hash = digest(target) if target.is_file() else None
        if entry["trashed"]:
            if previous and local_hash == previous["hash"]:
                target.unlink()
            elif local_hash:
                report("Kept locally edited file deleted remotely: " + relative)
            old[ident] = {
                "path": relative,
                "hash": local_hash or entry["sha256"],
                "deleted": True,
            }
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        if previous and local_hash is None and not previous.get("deleted"):
            if entry["sha256"] == previous["hash"] and entry["manageable"]:
                client.call("trash", {"id": ident})
                previous["deleted"] = True
                continue
            report("Remote changed or deletion is not permitted; restored: " + relative)
        elif local_hash and local_hash != entry["sha256"]:
            if previous and previous["hash"] == entry["sha256"] and entry["writable"]:
                client.upload(target, {**destination, "parent": entry["parent"]}, entry)
                old[ident] = {"path": relative, "hash": local_hash}
                report("Uploaded: " + relative)
                continue
            if not previous or local_hash != previous["hash"]:
                conflict = target.with_name(
                    target.name + f".local-conflict-{time.time_ns()}"
                )
                target.rename(conflict)
                report("Kept conflict copy: " + conflict.name)
        if local_hash != entry["sha256"] or not target.exists():
            client.download(entry, target)
            report("Downloaded: " + relative)
        old[ident] = {"path": relative, "hash": entry["sha256"]}
    for directory in reversed(removed_folders):
        if directory.is_dir() and not any(directory.iterdir()):
            directory.rmdir()
    # Revoked access or permanently deleted items never trigger uploading or deleting a local copy.
    protected = {record["path"] for ident, record in old.items() if ident not in seen}
    for item in sorted(root.rglob("*"), key=lambda p: (len(p.parts), str(p))):
        relative = item.relative_to(root).as_posix()
        if (
            item.name.startswith(".aether-drive-")
            or ".local-conflict-" in item.name
            or item.name.endswith(".aether-download")
            or relative in remote_paths
            or relative in protected
        ):
            continue
        safe_file(root, relative)
        parent = folders.get(item.parent.relative_to(root).as_posix().removeprefix("."))
        if item.parent != root and parent is None:
            continue
        if item.is_dir():
            folder = client.call(
                "create",
                {**destination, "parent": parent, "kind": "folder", "name": item.name},
            )
            folders[relative] = folder["id"]
            old[folder["id"]] = {"path": relative, "kind": "folder"}
        elif item.is_file():
            uploaded = client.upload(item, {**destination, "parent": parent})
            old[uploaded["id"]] = {"path": relative, "hash": uploaded["sha256"]}
            report("Uploaded: " + relative)
    for record in old.values():
        target = safe_file(root, record["path"])
        if target.exists():
            stat = target.stat()
            record["inode"] = [stat.st_dev, stat.st_ino]
    temporary = state_path.with_suffix(".tmp")
    temporary.write_text(json.dumps(state, indent=2))
    temporary.chmod(0o600)
    os.replace(temporary, state_path)


def main():
    parser = argparse.ArgumentParser(
        description="Synchronize an explicitly selected directory with Aether Drive. Conflicts preserve both copies."
    )
    parser.add_argument("--url", default="http://localhost:8780")
    parser.add_argument("--username", required=True)
    parser.add_argument("--folder", type=Path, required=True)
    parser.add_argument("--organization", default="default")
    parser.add_argument("--workspace")
    parser.add_argument("--remote-folder")
    parser.add_argument(
        "--watch", action="store_true", help="Repeat every 15 seconds; Ctrl-C stops."
    )
    args = parser.parse_args()
    client = DriveClient(args.url, args.username, Path.home() / ".config/aether-drive")
    client.login(args.username)
    destination = {
        "organization": args.organization,
        "workspace": args.workspace,
        "parent": args.remote_folder,
    }
    while True:
        try:
            sync_once(client, args.folder, destination)
        except (RuntimeError, ValueError, OSError) as error:
            print("Sync paused:", error)
            if not args.watch:
                raise SystemExit(1) from None
        if not args.watch:
            break
        time.sleep(15)


if __name__ == "__main__":
    main()

"""Offline restore into an empty directory; never overwrite a live installation."""

import json
import sqlite3
import zipfile
from pathlib import Path

from core.host.state import DEFAULT_SETTINGS, Problem


def restore(archive_path: Path, directory: Path):
    if directory.exists() and any(directory.iterdir()):
        raise Problem(
            409,
            "Restore requires an empty data directory; stop the service and keep the original data as a rollback copy.",
        )
    with zipfile.ZipFile(archive_path) as archive:
        if json.loads(archive.read("backup.json")).get("version") != 1:
            raise Problem(400, "Unsupported backup version.")
        entries = archive.infolist()
        if sum(item.file_size for item in entries) > 20 * 1024**3:
            raise Problem(400, "Backup exceeds the 20 GB restore limit.")
        for item in entries:
            path = Path(item.filename)
            if (
                path.is_absolute()
                or ".." in path.parts
                or not (
                    item.filename in ("backup.json", "studio.sqlite3")
                    or item.filename.startswith("workspaces/")
                    or (item.filename.startswith("drive/blobs/") and len(path.parts) == 3 and len(path.name) == 64 and all(c in "0123456789abcdef" for c in path.name))
                )
            ):
                raise Problem(400, "Backup contains an invalid path.")
        directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        directory.chmod(0o700)
        archive.extractall(directory)
    connection = sqlite3.connect(directory / "studio.sqlite3")
    if connection.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
        connection.close()
        raise Problem(400, "Backup database failed its integrity check.")
    connection.execute("DELETE FROM sessions")
    tables = {
        r[0]
        for r in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")
    }
    for table in ("setup_sessions", "recovery_tokens", "drive_uploads", "drive_link_visits", "automation_grants"):
        if table in tables:
            connection.execute(f"DELETE FROM {table}")
    if "host_storage" in tables:
        connection.execute("DROP TABLE host_storage")  # Old server paths must never be reused.
    connection.execute("UPDATE services SET active=0,token=''")
    for key, value in DEFAULT_SETTINGS.items():
        if key != "name":
            connection.execute(
                "UPDATE settings SET value=? WHERE key=?", (json.dumps(value), key)
            )
    connection.commit()
    connection.close()
    (directory / "studio.sqlite3").chmod(0o600)

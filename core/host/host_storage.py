"""Server backup policy. Only complete archives are published to external folders."""

import json
import os
import shutil
import tempfile
import threading
import time
from pathlib import Path

from core.host.state import Problem


class HostStorage:
    def __init__(self, host):
        self.host = host
        db = host.store.db
        db.execute(
            "CREATE TABLE IF NOT EXISTS host_storage (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL)"
        )
        db.execute(
            "INSERT OR IGNORE INTO host_storage VALUES(1, ?)",
            (
                json.dumps(
                    {
                        "interval_hours": 24,
                        "export_directory": "",
                        "last_attempt": 0,
                        "last_backup": "",
                        "last_success": 0,
                        "last_export": "",
                        "error": "",
                    }
                ),
            ),
        )
        db.commit()

    def read(self):
        return json.loads(
            self.host.store.db.execute(
                "SELECT value FROM host_storage WHERE id=1"
            ).fetchone()[0]
        )

    def write(self, policy):
        self.host.store.db.execute(
            "UPDATE host_storage SET value=? WHERE id=1", (json.dumps(policy),)
        )
        self.host.store.db.commit()

    def state(self):
        policy = self.read()
        return {
            **policy,
            "data_directory": str(self.host.store.directory.resolve()),
            "free_bytes": shutil.disk_usage(self.host.store.directory).free,
            "next_backup": (policy["last_attempt"] + policy["interval_hours"] * 3600)
            if policy["interval_hours"]
            else None,
        }

    def configure(self, values):
        hours = values.get("interval_hours")
        destination = values.get("export_directory", "")
        if type(hours) is not int or hours not in (0, 6, 12, 24, 168):
            raise Problem(400, "Choose a supported backup interval.")
        if not isinstance(destination, str) or len(destination) > 4096:
            raise Problem(400, "Enter a server folder path.")
        destination = destination.strip()
        if destination:
            target = Path(destination).expanduser()
            if not target.is_absolute():
                raise Problem(
                    400, "Backup destination must be an absolute path on the server."
                )
            target = target.resolve()
            root = self.host.store.directory.resolve()
            if target.is_relative_to(root) or root.is_relative_to(target):
                raise Problem(
                    400,
                    "Choose a separate backup folder outside the live data directory.",
                )
            try:
                target.mkdir(parents=True, exist_ok=True, mode=0o700)
                with tempfile.TemporaryFile(dir=target):
                    pass
            except OSError as error:
                raise Problem(
                    400, "Studio cannot write to this backup folder."
                ) from error
            destination = str(target)
        policy = self.read()
        if destination != policy["export_directory"]:
            policy.update(last_export="", error="")
        policy.update(interval_hours=hours, export_directory=destination)
        self.write(policy)
        return self.state()

    def completed(self, name):
        policy = self.read()
        policy.update(
            last_attempt=time.time(),
            last_success=time.time(),
            last_backup=name,
            error="",
            last_export="",
        )
        if policy["export_directory"]:
            temporary = None
            try:
                target = Path(policy["export_directory"])
                # A disconnected/missing volume must fail, never recreate its mount path.
                if not target.is_dir():
                    raise OSError("Backup destination is unavailable")
                fd, temporary = tempfile.mkstemp(
                    prefix=".aether-backup-", suffix=".partial", dir=target
                )
                with (
                    os.fdopen(fd, "wb") as output,
                    (self.host.store.directory / "backups" / name).open("rb") as source,
                ):
                    shutil.copyfileobj(source, output)
                    output.flush()
                    os.fsync(output.fileno())
                os.replace(temporary, target / name)
                policy["last_export"] = name
            except OSError:
                policy["error"] = (
                    "Local backup is safe; delivery to the backup folder failed. Check the destination and create another backup."
                )
            finally:
                if temporary:
                    try:
                        Path(temporary).unlink(missing_ok=True)
                    except OSError:
                        pass
        self.write(policy)

    def tick(self, now=None):
        now = time.time() if now is None else now
        with self.host.lock:
            policy = self.read()
            if not self.host.store.ready() or not policy["interval_hours"]:
                return False
            if now < policy["last_attempt"] + policy["interval_hours"] * 3600:
                return False
            policy["last_attempt"] = now
            self.write(policy)
            try:
                name = self.host.backup()
                self.host.store.audit("host", "scheduled_backup_created", name)
            except Exception:
                policy = self.read()
                policy["error"] = (
                    "Scheduled backup failed. Check server storage and create a backup manually."
                )
                self.write(policy)
            return True

    def start(self):
        stop = threading.Event()

        def worker():
            while not stop.wait(60):
                self.tick()

        thread = threading.Thread(target=worker, name="studio-backups", daemon=True)
        thread.start()
        return stop, thread

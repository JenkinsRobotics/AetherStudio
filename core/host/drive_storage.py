"""Resumable, bounded uploads and immutable Drive blobs; document IDs stay in library."""

import base64
import binascii
import hashlib
import json
import secrets
import time
from pathlib import Path

from .state import Problem

CHUNK_BYTES = 1024 * 1024
MAX_UPLOAD_BYTES = 512 * 1024 * 1024


# Launch ownership belongs to the server's library, not browser-specific uploaders.
NATIVE_EXTENSIONS = {
    ".acpart": "cad",
    ".cadpart": "cad",
    ".acasm": "cad",
    ".acad": "cad",
    ".acdrw": "cad",
    ".aethermap": "map",
    ".aethersketch": "sketch",
    ".aetherio": "io",
    ".anima": "animation",
}


class DriveStorage:
    def __init__(self, drive):
        self.drive, self.db = drive, drive.db
        self.root = drive.host.store.directory / "drive"
        for name in ("uploads", "blobs"):
            (self.root / name).mkdir(parents=True, exist_ok=True, mode=0o700)
        self.db.execute(
            "CREATE TABLE IF NOT EXISTS drive_uploads(id TEXT PRIMARY KEY,owner TEXT NOT NULL,name TEXT NOT NULL,size INTEGER NOT NULL,received INTEGER NOT NULL,destination TEXT NOT NULL,created REAL NOT NULL)"
        )
        self.db.commit()

    @staticmethod
    def descriptor(content):
        if not content or not content.startswith(b'{"aether_drive_blob":'):
            return None
        try:
            data = json.loads(content)
            digest = data["aether_drive_blob"]
            if len(digest) != 64 or any(c not in "0123456789abcdef" for c in digest):
                return None
            return data
        except (ValueError, KeyError, TypeError):
            return None

    def blob(self, row):
        data = self.descriptor(row["content"]) if row["app"] == "drive" else None
        if not data:
            return None
        path = self.root / "blobs" / data["aether_drive_blob"]
        if not path.is_file():
            raise Problem(
                404, "Stored file content is unavailable. Restore it from a backup."
            )
        return path

    def dispatch(self, action, user, data):
        uid = user["id"]
        if action == "upload_begin":
            size, name = data.get("size"), self.drive.library.name(data.get("name"))
            if (
                not isinstance(size, int)
                or isinstance(size, bool)
                or not 0 <= size <= MAX_UPLOAD_BYTES
            ):
                raise Problem(413, "Uploads support files up to 512 MB.")
            replacing = data.get("id")
            if replacing:
                row = self.drive.row(uid, replacing, "editor")
                if row["app"] != "drive" or row["kind"] != "file":
                    raise Problem(
                        400, "Use the owning editor to save this native document."
                    )
                if row["revision"] != data.get("expected_revision"):
                    raise Problem(
                        409,
                        "The remote file changed. Keep the local copy and reconcile it first.",
                    )
                destination = {
                    **self.drive.access.location(row),
                    "parent": row["parent"],
                    "replace_id": replacing,
                    "expected_revision": row["revision"],
                }
                name = row["name"]
            else:
                destination = self.drive.access.destination(uid, data)
                self.drive.unique(name, destination, uid)
            # Prevent abandoned upload reservations growing without bound.
            for stale in self.db.execute(
                "SELECT id FROM drive_uploads WHERE created<?", (time.time() - 86400,)
            ).fetchall():
                (self.root / "uploads" / stale[0]).unlink(missing_ok=True)
                self.db.execute("DELETE FROM drive_uploads WHERE id=?", (stale[0],))
            if (
                self.db.execute(
                    "SELECT COUNT(*) FROM drive_uploads WHERE owner=?", (uid,)
                ).fetchone()[0]
                >= 8
            ):
                raise Problem(429, "Finish or cancel another upload first.")
            ident = secrets.token_hex(16)
            (self.root / "uploads" / ident).touch(mode=0o600)
            self.db.execute(
                "INSERT INTO drive_uploads VALUES (?,?,?,?,0,?,?)",
                (ident, uid, name, size, json.dumps(destination), time.time()),
            )
            self.db.commit()
            return {"id": ident, "offset": 0, "chunk_bytes": CHUNK_BYTES}
        upload = self.db.execute(
            "SELECT * FROM drive_uploads WHERE id=? AND owner=?",
            (data.get("upload"), uid),
        ).fetchone()
        if not upload:
            raise Problem(404, "Upload not found.")
        path = self.root / "uploads" / upload["id"]
        if action == "upload_cancel":
            path.unlink(missing_ok=True)
            self.db.execute("DELETE FROM drive_uploads WHERE id=?", (upload["id"],))
            self.db.commit()
            return {"ok": True}
        if action == "upload_status":
            return {"offset": upload["received"], "size": upload["size"]}
        if action == "upload_chunk":
            if data.get("offset") != upload["received"]:
                raise Problem(
                    409, "Upload offset changed. Resume from its current offset."
                )
            try:
                encoded = data["data_base64"]
                if (
                    not isinstance(encoded, str)
                    or len(encoded) > CHUNK_BYTES * 4 // 3 + 4
                ):
                    raise ValueError()
                chunk = base64.b64decode(encoded, validate=True)
                if (
                    not chunk
                    or len(chunk) > CHUNK_BYTES
                    or upload["received"] + len(chunk) > upload["size"]
                ):
                    raise ValueError()
            except (ValueError, KeyError, binascii.Error):
                raise Problem(400, "Invalid upload chunk.") from None
            with path.open("r+b") as handle:
                handle.seek(upload["received"])
                handle.write(chunk)
                handle.truncate()
                handle.flush()
            received = upload["received"] + len(chunk)
            self.db.execute(
                "UPDATE drive_uploads SET received=? WHERE id=?",
                (received, upload["id"]),
            )
            self.db.commit()
            return {"offset": received}
        if action != "upload_finish":
            raise Problem(404, "Unknown upload operation.")
        if (
            upload["received"] != upload["size"]
            or path.stat().st_size != upload["size"]
        ):
            raise Problem(409, "Upload is incomplete.")
        saved_destination = json.loads(upload["destination"])
        if saved_destination.get("replace_id"):
            self.drive.row(uid, saved_destination["replace_id"], "editor")
            destination = saved_destination
        else:
            destination = self.drive.access.destination(uid, saved_destination)
        digest = hashlib.sha256()
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(CHUNK_BYTES), b""):
                digest.update(chunk)
        digest = digest.hexdigest()
        if data.get("sha256") and data["sha256"] != digest:
            raise Problem(409, "Upload checksum does not match.")
        blob = self.root / "blobs" / digest
        if not blob.exists():
            # Keep the resumable source until metadata commits successfully.
            import shutil

            shutil.copyfile(path, blob)
            blob.chmod(0o600)
        content = json.dumps(
            {"aether_drive_blob": digest, "size": upload["size"]}, separators=(",", ":")
        ).encode()
        if saved_destination.get("replace_id"):
            row = self.drive.row(uid, saved_destination["replace_id"], "editor")
            result = self.drive.library.dispatch(
                "save",
                user,
                {
                    "app": "drive",
                    "id": row["id"],
                    "expected_revision": saved_destination["expected_revision"],
                    "data_base64": base64.b64encode(content).decode(),
                },
                trusted_drive_blob=True,
            )
            result = self.drive.metadata(self.drive.row(uid, result["id"]), uid)
        else:
            app = (
                NATIVE_EXTENSIONS.get(Path(upload["name"]).suffix.lower(), "drive")
                if upload["size"] <= 6 * 1024 * 1024
                else "drive"
            )
            if app != "drive":
                content = path.read_bytes()
            result = self.drive.create(
                user,
                {
                    **destination,
                    "name": upload["name"],
                    "app": app,
                    "data_base64": base64.b64encode(content).decode(),
                },
                trusted_blob=True,
            )
        self.db.execute("DELETE FROM drive_uploads WHERE id=?", (upload["id"],))
        self.db.commit()
        path.unlink(missing_ok=True)
        return result

"""Drive's mixed-type browser and file operations over the canonical library."""

import base64
import hashlib
import mimetypes
import secrets
import time

from .state import Problem
from .drive_storage import DriveStorage
from .drive_listing import listing_metadata
from .drive_sharing import migrate_sharing, shared_metadata
from .drive_recycle import recycle_metadata, purge, empty_recycle_bin


class Drive:
    def __init__(self, host):
        self.host, self.library = host, host.library
        self.db, self.access = self.library.db, self.library.access
        self.storage = DriveStorage(self)
        migrate_sharing(self.db)
        self.db.execute("CREATE INDEX IF NOT EXISTS drive_events_file ON drive_events(file_id,id)")
        self.db.execute("CREATE INDEX IF NOT EXISTS library_parent ON library(parent)")

    def row(self, uid, ident, role="viewer", trash=False):
        row = self.db.execute("SELECT * FROM library WHERE id=?", (ident,)).fetchone()
        if not row:
            raise Problem(404, "File not found.")
        self.access.require(row, uid, role, include_trash=trash)
        return row

    def metadata(self, row, uid):
        versions = self.db.execute(
            "SELECT COUNT(*) FROM library_versions WHERE file_id=?", (row["id"],)
        ).fetchone()[0]
        place = self.access.location(row)
        role = self.access.role(row, uid, include_trash=True)
        descriptor = (
            self.storage.descriptor(row["content"]) if row["app"] == "drive" else None
        )
        return {
            **self.library.metadata(row, uid),
            **({"size": descriptor["size"]} if descriptor else {}),
            "writable": role in ("owner", "editor"),
            "manageable": role == "owner",
            "role": role,
            "sha256": descriptor["aether_drive_blob"]
            if descriptor
            else hashlib.sha256(row["content"] or b"").hexdigest(),
            "owner_id": row["owner"],
            "trashed": bool(row["trashed"]),
            "versions": versions,
            "favorite": bool(
                self.db.execute(
                    "SELECT 1 FROM drive_favorites WHERE user_id=? AND file_id=?",
                    (uid, row["id"]),
                ).fetchone()
            ),
            "mime": mimetypes.guess_type(row["name"])[0] or "application/octet-stream",
            **place,
        }

    def descendants(self, row):
        result, seen, pending = [], set(), [row]
        while pending:
            item = pending.pop()
            if item["id"] in seen:
                raise Problem(409, "Folder hierarchy contains a cycle.")
            seen.add(item["id"])
            result.append(item)
            pending.extend(
                self.db.execute(
                    "SELECT * FROM library WHERE parent=?", (item["id"],)
                ).fetchall()
            )
        return result

    def list(self, uid, data):
        org, view, parent = (
            data.get("organization", "default"),
            data.get("view", "personal"),
            data.get("parent"),
        )
        if org == "all":
            if view == "workspace":
                raise Problem(400, "Choose a workspace organization.")
        else:
            self.access.require_org(uid, org)
        if view not in (
            "personal",
            "workspace",
            "shared",
            "recent",
            "favorites",
            "trash",
            "search",
        ):
            raise Problem(400, "Choose a Drive location.")
        direction = data.get("shared_scope", "with")
        if direction not in ("with", "by"):
            raise Problem(400, "Choose With you or By you.")
        path = []
        if parent:
            folder = self.row(uid, parent)
            if (
                folder["kind"] != "folder"
                or (org != "all" and self.access.location(folder)["organization"] != org)
            ):
                raise Problem(404, "Folder not found in this organization.")
            cursor = folder
            while cursor:
                if not self.access.role(cursor, uid):
                    break
                path.insert(0, {"id": cursor["id"], "name": cursor["name"]})
                cursor = (
                    self.db.execute(
                        "SELECT * FROM library WHERE id=?", (cursor["parent"],)
                    ).fetchone()
                    if cursor["parent"]
                    else None
                )
        query = str(data.get("query", "")).strip().casefold()
        recent = dict(
            self.db.execute(
                "SELECT file_id,opened FROM library_recents WHERE user_id=?", (uid,)
            )
        )
        files = []
        for row in self.db.execute(
            "SELECT l.* FROM library l JOIN drive_locations d ON l.id=d.file_id WHERE (?='all' OR d.organization=?)",
            (org, org),
        ):
            if not self.access.role(row, uid, include_trash=view == "trash") or bool(
                row["trashed"]
            ) != (view == "trash"):
                continue
            sharing = {}
            if view == "shared":
                included, sharing = shared_metadata(self, row, uid, direction)
                if not included:
                    continue
            place = self.access.location(row)
            favorite = self.db.execute(
                "SELECT 1 FROM drive_favorites WHERE user_id=? AND file_id=?",
                (uid, row["id"]),
            ).fetchone()
            if not query:
                if parent and row["parent"] != parent:
                    continue
                if not parent:
                    if view == "personal" and (
                        place["workspace"] or row["owner"] != uid or row["parent"]
                    ):
                        continue
                    if view == "workspace" and (
                        place["workspace"] != data.get("workspace") or row["parent"]
                    ):
                        continue
                    if view == "recent" and row["id"] not in recent:
                        continue
                    if view == "favorites" and not favorite:
                        continue
                    if view == "trash" and row["parent"]:
                        p = self.db.execute(
                            "SELECT trashed FROM library WHERE id=?", (row["parent"],)
                        ).fetchone()
                        if p and p[0]:
                            continue
            if query and query not in row["name"].casefold():
                continue
            if (
                data.get("app")
                and data["app"] != row["app"]
                and row["kind"] != "folder"
            ):
                continue
            files.append({**self.metadata(row, uid), **listing_metadata(self, row, uid), **(recycle_metadata(self, row, uid) if view == "trash" else {}), **sharing, "opened": recent.get(row["id"])})
        files.sort(
            key=lambda f: (
                f["kind"] != "folder",
                -(f["opened"] or 0) if view == "recent" else f["name"].casefold(),
            )
        )
        return {"files": files, "path": path}

    def unique(self, name, dest, uid, exclude=None):
        rows = self.db.execute(
            "SELECT l.* FROM library l JOIN drive_locations d ON d.file_id=l.id WHERE l.trashed=0 AND l.parent IS ? AND d.organization=? AND d.workspace IS ? AND lower(l.name)=lower(?)",
            (dest["parent"], dest["organization"], dest["workspace"], name),
        )
        if any(
            row["id"] != exclude
            and (dest["workspace"] or dest["parent"] or row["owner"] == uid)
            for row in rows
        ):
            raise Problem(
                409, "An item with this name already exists in the destination."
            )

    def create(self, user, data, *, trusted_blob=False):
        destination = self.access.destination(user["id"], data)
        name = self.library.name(data.get("name"))
        self.unique(name, destination, user["id"])
        app = data.get("app", "drive")
        if app not in self.host.packages:
            raise Problem(400, "Choose a registered file type.")
        result = self.library.dispatch(
            "create",
            user,
            {**data, **destination, "app": app, "name": name},
            trusted_drive_blob=trusted_blob,
        )
        self.access.event(
            user["id"], destination["organization"], "created", result["id"], name
        )
        self.db.commit()
        return self.metadata(self.row(user["id"], result["id"]), user["id"])

    def dispatch(self, action, user, data):
        self.access.ensure_default()
        uid = user["id"]
        if action == "empty_trash":
            return empty_recycle_bin(self, user, data)
        if action == "sync_manifest":
            from .drive_sync_api import manifest

            return manifest(self, user, data)
        if action.startswith("upload_"):
            return self.storage.dispatch(action, user, data)
        if action == "administration":
            return self.access.administration(user)
        if action == "context":
            return {
                **self.access.context(uid),
                "user": {
                    "id": uid,
                    "username": user["username"],
                    "name": user["full_name"] or user["username"],
                    "admin": user["role"] == "admin",
                },
                "apps": self.host.apps(user),
            }
        if action in (
            "organization_create",
            "workspace_create",
            "workspace_icon",
            "workspace_open",
            "workspace_favorite",
            "members",
            "member_update",
        ):
            return self.access.manage(action, user, data)
        if action == "list":
            return self.list(uid, data)
        if action == "create":
            return self.create(user, data)
        if action == "redeem":
            link = self.db.execute(
                "SELECT * FROM drive_links WHERE token_hash=? AND revoked=0 AND expires>?",
                (
                    hashlib.sha256(str(data.get("token", "")).encode()).hexdigest(),
                    time.time(),
                ),
            ).fetchone()
            if not link:
                raise Problem(404, "This sharing link has expired or was revoked.")
            row = self.db.execute(
                "SELECT * FROM library WHERE id=? AND trashed=0", (link["file_id"],)
            ).fetchone()
            if not row:
                raise Problem(404, "File not found.")
            self.access.require_org(uid, self.access.location(row)["organization"])
            self.db.execute(
                "INSERT OR IGNORE INTO drive_link_visits VALUES (?,?)",
                (link["id"], uid),
            )
            self.db.commit()
            return self.metadata(self.row(uid, row["id"]), uid)
        if action == "activity":
            org = data.get("organization", "default")
            self.access.require_org(uid, org)
            # One file's history, for a details pane, or the whole organization's feed.
            one = data.get("file")
            return {
                "events": [
                    dict(r)
                    for r in self.db.execute(
                        "SELECT e.*,COALESCE(NULLIF(u.full_name,''),u.username) author FROM drive_events e JOIN users u ON u.id=e.actor"
                        " WHERE organization=?"
                        + (" AND e.file_id=? ORDER BY e.id DESC LIMIT 20" if one else " ORDER BY e.id DESC LIMIT 500"),
                        (org, one) if one else (org,),
                    )
                    if (
                        r["file_id"]
                        and self.access.role(
                            self.db.execute(
                                "SELECT * FROM library WHERE id=?", (r["file_id"],)
                            ).fetchone(),
                            uid,
                            True,
                        )
                    )
                    or (
                        not r["file_id"] and self.access.membership(uid, org) == "owner"
                    )
                ]
            }
        row = self.row(
            uid, data.get("id"), trash=action in ("restore", "delete_forever")
        )
        place = self.access.location(row)
        if action == "details":
            return self.metadata(row, uid)
        if action in ("read", "open"):
            if row["kind"] != "file":
                raise Problem(400, "Choose a file.")
            self.db.execute(
                "INSERT OR REPLACE INTO library_recents VALUES (?,?,?)",
                (uid, row["id"], time.time()),
            )
            self.db.commit()
            result = self.metadata(row, uid)
            if action == "read":
                blob = self.storage.blob(row)
                if blob and blob.stat().st_size > 16 * 1024 * 1024:
                    raise Problem(413, "Use the download endpoint for large files.")
                result["data_base64"] = base64.b64encode(
                    blob.read_bytes() if blob else row["content"] or b""
                ).decode()
            return result
        if action == "favorite":
            self.db.execute(
                "DELETE FROM drive_favorites WHERE user_id=? AND file_id=?",
                (uid, row["id"]),
            )
            if data.get("favorite"):
                self.db.execute(
                    "INSERT INTO drive_favorites VALUES (?,?)", (uid, row["id"])
                )
            self.db.commit()
            return {"ok": True}
        if action in ("sharing", "grant", "link_create", "link_revoke"):
            return self.sharing(action, row, user, data)
        if action == "document":
            return self.library.dispatch(
                data.get("action"), user, {**data, "app": row["app"], "id": row["id"]}
            )
        required = (
            "owner"
            if action in ("move", "trash", "restore", "delete_forever")
            else "editor"
        )
        if action != "copy":
            self.access.require(
                row,
                uid,
                required,
                include_trash=action in ("restore", "delete_forever"),
            )
        if action in ("move", "copy"):
            return self.transfer(action, row, user, data)
        if action == "rename":
            name = self.library.name(data.get("name"))
            self.unique(
                name, {**place, "parent": row["parent"]}, row["owner"], row["id"]
            )
            result = self.library.dispatch(
                "rename",
                user,
                {
                    "app": row["app"],
                    "id": row["id"],
                    "name": name,
                    "expected_revision": data.get("expected_revision"),
                },
            )
        elif action in ("trash", "restore"):
            if action == "restore" and row["parent"]:
                parent = self.db.execute(
                    "SELECT * FROM library WHERE id=?", (row["parent"],)
                ).fetchone()
                if not parent or not self.access.role(parent, uid):
                    raise Problem(409, "Restore the containing folder first.")
            if action == "restore":
                self.unique(
                    row["name"],
                    {**place, "parent": row["parent"]},
                    row["owner"],
                    row["id"],
                )
            self.db.execute(
                "UPDATE library SET trashed=?,modified=? WHERE id=?",
                (1 if action == "trash" else 0, time.time(), row["id"]),
            )
            result = {"ok": True}
        elif action == "delete_forever":
            purge(self, uid, [row])
            result = {"ok": True}
        else:
            raise Problem(404, "Unknown Drive operation.")
        self.access.event(
            uid,
            place["organization"],
            action,
            None if action == "delete_forever" else row["id"],
            row["name"],
        )
        self.db.commit()
        return result

    def transfer(self, action, row, user, data):
        uid = user["id"]
        destination = self.access.destination(uid, data.get("destination", {}))
        items = self.descendants(row)
        if action == "copy":
            items = [item for item in items if self.access.role(item, uid)]
        if destination["parent"] in {i["id"] for i in items}:
            raise Problem(400, "A folder cannot be placed inside itself.")
        name = self.library.name(
            data.get(
                "name", row["name"] if action == "move" else "Copy of " + row["name"]
            )
        )
        self.unique(name, destination, uid)
        original_org = self.access.location(row)["organization"]
        if action == "move":
            for item in items:
                self.access.require(item, uid, "owner", True)
            with self.db:
                for item in items:
                    self.access.place(item["id"], destination)
                    self.db.execute(
                        "UPDATE library SET scope=?,owner=?,modified=? WHERE id=?",
                        (
                            destination["scope"],
                            uid if not destination["workspace"] else item["owner"],
                            time.time(),
                            item["id"],
                        ),
                    )
                    if original_org != destination["organization"]:
                        self.db.execute(
                            "DELETE FROM drive_grants WHERE file_id=?", (item["id"],)
                        )
                        self.db.execute(
                            "UPDATE drive_links SET revoked=1 WHERE file_id=?",
                            (item["id"],),
                        )
                self.db.execute(
                    "UPDATE library SET parent=?,name=? WHERE id=?",
                    (destination["parent"], name, row["id"]),
                )
            ident = row["id"]
        else:
            mapping = {}
            for item in items:
                self.access.require(item, uid)
            # Clone the complete subtree in one transaction. An invalid descendant
            # must not leave a half-copied project behind.
            with self.db:
                for item in items:
                    ident, now = secrets.token_hex(16), time.time()
                    target_parent = mapping.get(item["parent"], destination["parent"])
                    target_name = name if item["id"] == row["id"] else item["name"]
                    self.db.execute(
                        "INSERT INTO library (id,owner,app,scope,parent,name,kind,content,created,modified) VALUES (?,?,?,?,?,?,?,?,?,?)",
                        (
                            ident,
                            uid,
                            item["app"],
                            destination["scope"],
                            target_parent,
                            target_name,
                            item["kind"],
                            item["content"],
                            now,
                            now,
                        ),
                    )
                    self.access.place(ident, destination)
                    if item["kind"] != "folder":
                        self.library.history.record(self.row(uid, ident), uid, "create")
                    mapping[item["id"]] = ident
            ident = mapping[row["id"]]
        self.access.event(uid, destination["organization"], action, ident, name)
        self.db.commit()
        return self.metadata(self.row(uid, ident), uid)

    def sharing(self, action, row, user, data):
        uid, place = user["id"], self.access.location(row)
        self.access.require(row, uid, "owner")
        if action == "sharing":
            return {
                "grants": [
                    dict(r)
                    for r in self.db.execute(
                        "SELECT g.user_id,g.role,COALESCE(NULLIF(u.full_name,''),u.username) name FROM drive_grants g JOIN users u ON u.id=g.user_id WHERE file_id=?",
                        (row["id"],),
                    )
                ],
                "links": [
                    dict(r)
                    for r in self.db.execute(
                        "SELECT id,audience,role,expires,revoked FROM drive_links WHERE file_id=?",
                        (row["id"],),
                    )
                ],
            }
        if action == "grant":
            target, role = data.get("user"), data.get("role")
            self.access.require_org(target, place["organization"])
            if role not in ("viewer", "editor", "remove"):
                raise Problem(400, "Choose view or edit access.")
            if role == "remove":
                self.db.execute(
                    "DELETE FROM drive_grants WHERE file_id=? AND user_id=?",
                    (row["id"], target),
                )
            else:
                self.db.execute(
                    """INSERT INTO drive_grants(file_id,user_id,role,shared_by,shared_at)
                    VALUES (?,?,?,?,?) ON CONFLICT(file_id,user_id)
                    DO UPDATE SET role=excluded.role""",
                    (row["id"], target, role, uid, time.time()),
                )
            result = {"ok": True}
        elif action == "link_create":
            role, days = data.get("role", "viewer"), data.get("days", 7)
            if (
                role not in ("viewer", "editor")
                or not isinstance(days, int)
                or not 1 <= days <= 365
            ):
                raise Problem(
                    400, "Choose view/edit access and an expiry of 1–365 days."
                )
            token, ident = secrets.token_urlsafe(32), secrets.token_hex(12)
            self.db.execute(
                "INSERT INTO drive_links(id,file_id,token_hash,audience,role,expires,created,revoked,shared_by) VALUES (?,?,?,'organization',?,?,?,0,?)",
                (
                    ident,
                    row["id"],
                    hashlib.sha256(token.encode()).hexdigest(),
                    role,
                    time.time() + days * 86400,
                    time.time(),
                    uid,
                ),
            )
            result = {"id": ident, "url": "/drive/?share=" + token}
        else:
            self.db.execute(
                "UPDATE drive_links SET revoked=1 WHERE file_id=? AND id=?",
                (row["id"], data.get("link")),
            )
            result = {"ok": True}
        self.access.event(uid, place["organization"], action, row["id"], row["name"])
        self.db.commit()
        return result

"""Host-owned file library. Product engines retain ownership of document formats."""

import base64
import binascii
import secrets
import time

from .state import Problem
from .drive_access import DriveAccess
from .history import History
from .collaboration import Collaboration

MAX_FILE_BYTES = 6 * 1024 * 1024


class Library:
    def __init__(self, store, products=None):
        from .products import Products
        self.products = products if products is not None else Products()
        self.store = store
        self.db = store.db
        self.db.executescript("""
            CREATE TABLE IF NOT EXISTS library (
                id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES users(id),
                app TEXT NOT NULL, scope TEXT NOT NULL, parent TEXT,
                name TEXT NOT NULL, kind TEXT NOT NULL, content BLOB,
                revision INTEGER NOT NULL DEFAULT 1, created REAL NOT NULL,
                modified REAL NOT NULL, trashed INTEGER NOT NULL DEFAULT 0);
            CREATE TABLE IF NOT EXISTS library_recents (
                user_id TEXT NOT NULL REFERENCES users(id), file_id TEXT NOT NULL REFERENCES library(id),
                opened REAL NOT NULL, PRIMARY KEY(user_id,file_id));
        """)

        self.access = DriveAccess(store)
        store.drive_access = self.access
        self.history = History(store)
        self.collaboration = Collaboration(store)

    def entry(self, uid, app, file_id, write=False):
        row = self.db.execute(
            "SELECT * FROM library WHERE id=? AND (app=? OR kind='folder') AND trashed=0", (file_id, app)
        ).fetchone()
        if not row or not self.access.role(row, uid) or (write and self.access.role(row, uid) not in ("owner", "editor")):
            raise Problem(404, "File or folder not found, or access is unavailable.")
        return row

    def metadata(self, row, uid):
        owner = self.db.execute(
            "SELECT full_name,username FROM users WHERE id=?", (row["owner"],)
        ).fetchone()
        return {
            **{
                k: row[k]
                for k in (
                    "id",
                    "app",
                    "scope",
                    "parent",
                    "name",
                    "kind",
                    "revision",
                    "created",
                    "modified",
                )
            },
            "size": (row["size"] or 0)
            if "size" in row.keys()
            else len(row["content"] or b""),
            "owner": owner["full_name"] or owner["username"],
            "writable": self.access.role(row, uid) in ("owner", "editor"),
            **self.access.location(row),
        }

    def dispatch(self, action, user, data, *, trusted_drive_blob=False):
        self.access.ensure_default()
        uid, app = user["id"], data["app"]
        if action == "save" and app == "drive" and not trusted_drive_blob and self.content(data).startswith(b'{"aether_drive_blob":'):
            raise Problem(400, "Use a verified Drive upload for blob content.")
        if action == "list":
            view = data.get("view", "personal")
            if view not in ("personal", "workspace", "recent"):
                raise Problem(400, "Unknown library view.")
            parent = data.get("parent") or None
            query = str(data.get("query", "")).strip().lower()[:200]
            if parent:
                folder = self.entry(uid, app, parent)
                if folder["kind"] != "folder":
                    raise Problem(400, "Choose a folder.")
            rows = self.db.execute(
                "SELECT *,length(content) AS size FROM library WHERE (app=? OR kind='folder') AND trashed=0 ORDER BY (kind='folder') DESC,modified DESC",
                (app,),
            ).fetchall()
            recent = dict(
                self.db.execute(
                    "SELECT file_id,opened FROM library_recents WHERE user_id=?", (uid,)
                )
            )
            visible = [
                r
                for r in rows
                if (
                    r["scope"] == view and (view != "personal" or r["owner"] == uid)
                    if view != "recent"
                    else r["id"] in recent and r["kind"] != "folder"
                )
                and self.access.role(r, uid)
                and (query in r["name"].lower())
                and (bool(query) or view == "recent" or r["parent"] == parent)
            ]
            if view == "recent":
                visible.sort(key=lambda r: recent[r["id"]], reverse=True)
            # A file's version is how many times someone named a state of it,
            # not how many times it autosaved (Jonathan, 2026-10-03: "commits
            # and stuff is what sets the revision number, not just the
            # automatic saves"). `revision` counts every save and runs into the
            # dozens within an hour of editing; `versions` is what a person
            # recognises as V1, V2. One query for the page, not one per row.
            versions = {}
            if visible:
                marks = ",".join("?" * len(visible))
                versions = {
                    r["file_id"]: {"versions": r["versions"], "latest_version": r["latest"]}
                    for r in self.db.execute(
                        f"""SELECT file_id, COUNT(*) AS versions,
                                   (SELECT name FROM library_versions inner_v
                                     WHERE inner_v.file_id = outer_v.file_id
                                     ORDER BY created DESC LIMIT 1) AS latest
                              FROM library_versions outer_v
                             WHERE file_id IN ({marks}) GROUP BY file_id""",
                        tuple(r["id"] for r in visible),
                    )
                }
            return {
                "files": [
                    {
                        **self.metadata(r, uid),
                        **versions.get(r["id"], {"versions": 0, "latest_version": None}),
                    }
                    for r in visible
                ]
            }
        if self.products.supports_document(app, action, create=True):
            return self.products.document(self, action, user, data)
        if action == "create":
            destination = self.access.destination(uid, data)
            scope = destination["scope"]
            kind = data.get("kind", "file")
            if scope not in ("personal", "workspace") or kind not in ("file", "folder"):
                raise Problem(400, "Choose a file location and type.")
            parent = destination["parent"]
            if parent:
                folder = self.entry(uid, app, parent, write=True)
                if folder["kind"] != "folder" or folder["scope"] != scope:
                    raise Problem(400, "Choose a folder in the same location.")
            name = self.name(data.get("name"))
            content = self.content(data) if kind == "file" else None
            if app == "drive" and content and content.startswith(b'{"aether_drive_blob":') and not trusted_drive_blob:
                raise Problem(400, "Use a verified Drive upload for blob content.")
            file_id, now = secrets.token_hex(16), time.time()
            self.db.execute(
                "INSERT INTO library (id,owner,app,scope,parent,name,kind,content,created,modified) VALUES (?,?,?,?,?,?,?,?,?,?)",
                (file_id, uid, app, scope, parent, name, kind, content, now, now),
            )
            self.access.place(file_id, destination)
            if kind != "folder":
                self.history.record(self.entry(uid, app, file_id), uid, "create")
                self.db.execute(
                    "INSERT OR REPLACE INTO library_recents VALUES (?,?,?)",
                    (uid, file_id, now),
                )
            self.store.audit(user["username"], "library_created", file_id)
            return self.metadata(self.entry(uid, app, file_id), uid)
        row = self.entry(
            uid, app, data.get("id"), write=action in ("save", "rename", "share")
        )
        if action in ("collaboration", "collaboration_mutate"):
            return self.collaboration.dispatch(action, row, user, data)
        if self.products.supports_document(app, action):
            return self.products.document(self, action, user, data, row)
        if action in (
            "history", "read_revision", "compare",
            "restore", "version", "version_update", "version_delete", "version_status",
            "branch_create", "branch_rename", "branch_delete", "merge",
        ):
            return self.history.dispatch(action, user, row, data)
        if action == "read":
            if row["kind"] != "file":
                raise Problem(400, "Choose a file to open.")
            if data.get("branch") not in (None, "", "Main"):
                head = self.db.execute(
                    "SELECT head_revision FROM library_branches WHERE file_id=? AND name=?",
                    (row["id"], str(data["branch"])),
                ).fetchone()
                if not head:
                    raise Problem(404, "Branch not found.")
                old_row = self.history.revision(row["id"], head["head_revision"])
                return {
                    **self.metadata(row, uid),
                    "branch": str(data["branch"]),
                    "revision": head["head_revision"],
                    "data_base64": base64.b64encode(old_row["content"]).decode(),
                }
            self.db.execute(
                "INSERT OR REPLACE INTO library_recents VALUES (?,?,?)",
                (uid, row["id"], time.time()),
            )
            self.db.commit()
            return {
                **self.metadata(row, uid),
                "data_base64": base64.b64encode(row["content"]).decode(),
            }
        if action == "save" and data.get("branch") not in (None, "", "Main"):
            branch = str(data["branch"])
            head = self.db.execute(
                "SELECT head_revision FROM library_branches WHERE file_id=? AND name=?",
                (row["id"], branch),
            ).fetchone()
            if not head:
                raise Problem(404, "Branch not found.")
            if data.get("expected_revision") != head["head_revision"]:
                raise Problem(
                    409, "This branch changed. Reopen it before saving your changes."
                )
            if row["kind"] != "file":
                raise Problem(400, "Folders cannot contain file data.")
            content = self.content(data)
            next_revision = (
                self.db.execute(
                    "SELECT MAX(revision) AS top FROM library_history WHERE file_id=?",
                    (row["id"],),
                ).fetchone()["top"]
                or row["revision"]
            ) + 1
            self.history.record(
                row,
                uid,
                "save",
                data.get("note", ""),
                branch=branch,
                parent=head["head_revision"],
                revision=next_revision,
                content=content,
            )
            self.db.execute(
                "UPDATE library_branches SET head_revision=? WHERE file_id=? AND name=?",
                (next_revision, row["id"], branch),
            )
            self.db.commit()
            return {**self.metadata(row, uid), "branch": branch, "revision": next_revision}
        if action in ("save", "rename", "share"):
            if data.get("expected_revision") != row["revision"]:
                raise Problem(
                    409, "This file changed. Reopen it before saving your changes."
                )
            if action == "save":
                if row["kind"] != "file":
                    raise Problem(400, "Folders cannot contain file data.")
                self.db.execute(
                    "UPDATE library SET content=? WHERE id=?",
                    (self.content(data), row["id"]),
                )
                self.db.execute(
                    "INSERT OR REPLACE INTO library_recents VALUES (?,?,?)",
                    (uid, row["id"], time.time()),
                )
            elif action == "rename":
                self.db.execute(
                    "UPDATE library SET name=? WHERE id=?",
                    (self.name(data.get("name")), row["id"]),
                )
            else:
                self.access.require(row, uid, "owner")
                scope = data.get("scope")
                if row["kind"] != "file" or scope not in ("personal", "workspace"):
                    raise Problem(
                        400, "Only individual files can change sharing location."
                    )
                if self.access.location(row)["organization"] != "default":
                    raise Problem(400, "Use Aether Drive to choose a workspace in this organization.")
                self.db.execute(
                    "UPDATE library SET scope=?,parent=NULL WHERE id=?",
                    (scope, row["id"]),
                )
            if action == "share":
                destination = self.access.destination(uid, {"scope": scope})
                self.access.place(row["id"], destination)
            self.db.execute(
                "UPDATE library SET revision=?,modified=? WHERE id=?",
                (self.history.next_revision(row), time.time(), row["id"]),
            )
            if row["kind"] != "folder":
                self.history.record(
                    self.entry(uid, app, row["id"]),
                    uid,
                    action,
                    data.get("note", ""),
                    parent=row["revision"],
                )
            self.store.audit(user["username"], "library_" + action, row["id"])
            return self.metadata(self.entry(uid, app, row["id"]), uid)
        if action == "copy":
            if row["kind"] != "file":
                raise Problem(400, "Choose a file to copy.")
            created = self.dispatch(
                "create",
                user,
                {
                    "app": app,
                    "name": "Copy of " + row["name"],
                    "scope": "personal",
                    "data_base64": base64.b64encode(row["content"]).decode(),
                },
            )
            # Creating from an editor is opening; copying in the library is not.
            # The copy must not jump into "Recently opened" until it is used.
            self.db.execute(
                "DELETE FROM library_recents WHERE user_id=? AND file_id=?",
                (uid, created["id"]),
            )
            self.db.commit()
            return created
        raise Problem(404, "Unknown library operation.")

    @staticmethod
    def name(value):
        if (
            not isinstance(value, str)
            or not 1 <= len(value.strip()) <= 180
            or value.strip() in (".", "..")
            or any(ord(c) < 32 or c in "/\\" for c in value)
        ):
            raise Problem(400, "Use a name of 1–180 characters without slashes.")
        return value.strip()

    @staticmethod
    def content(data):
        try:
            value = data["data_base64"]
            if not isinstance(value, str) or len(value) > MAX_FILE_BYTES * 4 // 3 + 4:
                raise ValueError()
            content = base64.b64decode(value, validate=True)
            if len(content) > MAX_FILE_BYTES:
                raise ValueError()
            return content
        except (KeyError, ValueError, binascii.Error):
            raise Problem(400, "Choose a file up to 6 MB with valid content.") from None

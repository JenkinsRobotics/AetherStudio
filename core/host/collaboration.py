"""Document collaboration lives with the host, independently of product formats.

Collaboration has its own optimistic revision: a comment never changes file
content or makes an editor's save stale. Edits are journaled, not silently lost.
Access comes from Library.entry; authors may edit their own items, owners may
moderate, and assignees may complete tasks assigned to them.
"""
import base64
import binascii
import datetime
import json
import secrets
import time

from .state import Problem


class Collaboration:
    def __init__(self, store):
        self.store, self.db = store, store.db
        self.db.executescript("""
          CREATE TABLE IF NOT EXISTS document_collaboration (
            file_id TEXT PRIMARY KEY REFERENCES library(id), revision INTEGER NOT NULL,
            content TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS collaboration_events (
            file_id TEXT NOT NULL REFERENCES library(id), revision INTEGER NOT NULL,
            actor TEXT NOT NULL REFERENCES users(id), created REAL NOT NULL,
            collection TEXT NOT NULL, operation TEXT NOT NULL, item TEXT NOT NULL,
            before_json TEXT, after_json TEXT, PRIMARY KEY(file_id, revision));
        """)

    def read(self, row, user):
        saved = self.db.execute("SELECT * FROM document_collaboration WHERE file_id=?", (row["id"],)).fetchone()
        content = json.loads(saved["content"]) if saved else {"comments": [], "tasks": [], "reminders": [], "notes": {"text": ""}}
        members = [dict(r) for r in self.db.execute(
            "SELECT id,COALESCE(NULLIF(full_name,''),username) AS name,avatar FROM users WHERE active=1 AND role!='service' ORDER BY username")
            if self.store.drive_access.role(row, r["id"])]
        return {**content, "revision": saved["revision"] if saved else 0,
                "actor": user["id"], "owner": row["owner"], "members": members,
                "activity": [dict(r) for r in self.db.execute(
                    "SELECT e.revision,e.created,e.collection,e.operation,e.item,COALESCE(NULLIF(u.full_name,''),u.username) AS author FROM collaboration_events e JOIN users u ON u.id=e.actor WHERE file_id=? ORDER BY revision DESC LIMIT 100", (row["id"],))]}

    @staticmethod
    def text(value, limit, required=True):
        if not isinstance(value, str) or len(value) > limit or (required and not value.strip()):
            raise Problem(400, f"Enter text up to {limit} characters.")
        return value.strip()

    @staticmethod
    def images(value):
        if not isinstance(value, list) or len(value) > 3:
            raise Problem(400, "Attach up to three images.")
        result = []
        for image in value:
            if not isinstance(image, dict):
                raise Problem(400, "Choose a PNG or JPEG image.")
            name, data = image.get("name"), image.get("data_url")
            if not isinstance(name, str) or not 1 <= len(name) <= 160 or not isinstance(data, str) or len(data) > 1400000:
                raise Problem(400, "Use named images under 1 MB each.")
            try:
                prefix, encoded = data.split(",", 1)
                raw = base64.b64decode(encoded, validate=True)
                valid = (prefix == "data:image/png;base64" and raw.startswith(b"\x89PNG\r\n\x1a\n")) or (prefix == "data:image/jpeg;base64" and raw.startswith(b"\xff\xd8\xff"))
                if not valid or len(raw) > 1048576:
                    raise ValueError()
            except (ValueError, binascii.Error):
                raise Problem(400, "Choose a PNG or JPEG image under 1 MB.") from None
            result.append({"name": name, "data_url": data})
        return result

    def dispatch(self, action, row, user, data):
        state = self.read(row, user)
        if action == "collaboration":
            return state
        if data.get("expected_revision") != state["revision"]:
            raise Problem(409, "Someone updated this discussion. Refresh and retry; your draft has been kept.")
        collection, operation = data.get("collection"), data.get("operation")
        if collection not in ("comments", "tasks", "reminders", "notes") or operation not in ("add", "update", "delete"):
            raise Problem(400, "Unknown collaboration operation.")
        actor, owner, now = user["id"], self.store.drive_access.role(row, user["id"]) in ("owner", "editor"), time.time()
        patch = data.get("value", {})
        if not isinstance(patch, dict):
            raise Problem(400, "Expected an item object.")
        before = None
        item_id = str(data.get("item", ""))
        if collection == "notes":
            if not owner or operation != "update":
                raise Problem(403, "Only the document owner can update its notes.")
            before = state["notes"]
            after = {"text": self.text(patch.get("text"), 50000, False), "author": actor, "updated": now}
            state["notes"] = after
            item_id = "notes"
        else:
            items = state[collection]
            if operation == "add":
                if len(items) >= 5000:
                    raise Problem(400, "This document has reached its collaboration item limit.")
                item_id = secrets.token_hex(16)
                after = {"id": item_id, "author": actor, "created": now, "updated": now}
                if collection == "comments":
                    parent = patch.get("parent") or None
                    if parent and not any(i["id"] == parent and not i.get("parent") and not i.get("deleted") for i in items):
                        raise Problem(400, "Choose an existing discussion to reply to.")
                    revision = patch.get("revision")
                    parent_item = next((i for i in items if i["id"] == parent), None)
                    branch = parent_item.get("branch", "Main") if parent_item else patch.get("branch", "Main")
                    if not isinstance(branch, str) or (branch != "Main" and not self.db.execute("SELECT 1 FROM library_branches WHERE file_id=? AND name=?", (row["id"], branch)).fetchone() and not parent_item):
                        raise Problem(400, "Choose an existing workspace for this discussion.")
                    after.update(parent=parent, revision=revision, branch=branch, resolved=False)
                else:
                    after.update(status="open", due="", assignee=actor)
            else:
                before = next((i for i in items if i["id"] == item_id), None)
                if not before or before.get("deleted"):
                    raise Problem(404, "Collaboration item not found.")
                can_edit = owner or before["author"] == actor
                assignee_status = collection in ("tasks", "reminders") and before.get("assignee") == actor and operation == "update" and set(patch) == {"status"}
                if not can_edit and not assignee_status:
                    raise Problem(403, "Only the author or document owner can edit this item.")
                after = {**before, "updated": now}
            if operation == "delete":
                after.update(deleted=True, text="")
                if collection == "comments":
                    after["attachments"] = []
            else:
                if operation == "add" or "text" in patch:
                    after["text"] = self.text(patch.get("text"), 10000 if collection == "comments" else 1000)
                if collection == "comments":
                    if "revision" in patch:
                        revision = patch["revision"]
                        if revision is not None and (not isinstance(revision, int) or isinstance(revision, bool) or not self.db.execute("SELECT 1 FROM library_history WHERE file_id=? AND revision=?", (row["id"], revision)).fetchone()):
                            raise Problem(400, "Choose a saved state of this document.")
                        after["revision"] = revision
                        version = self.db.execute("SELECT name FROM library_versions WHERE file_id=? AND revision=? ORDER BY created DESC LIMIT 1", (row["id"], revision)).fetchone() if revision is not None else None
                        after["reference_name"] = version["name"] if version else ("Saved state" if revision is not None else "")
                    if "attachments" in patch:
                        after["attachments"] = self.images(patch["attachments"])
                if collection == "comments" and "resolved" in patch:
                    if not isinstance(patch["resolved"], bool) or after.get("parent"):
                        raise Problem(400, "Resolve the discussion, not an individual reply.")
                    after["resolved"] = patch["resolved"]
                if collection != "comments":
                    if "status" in patch:
                        if patch["status"] not in ("open", "in_progress", "done"):
                            raise Problem(400, "Unknown task state.")
                        after["status"] = patch["status"]
                    if "due" in patch:
                        due = patch["due"]
                        try:
                            if due:
                                datetime.date.fromisoformat(due)
                        except (TypeError, ValueError):
                            raise Problem(400, "Use a valid due date (YYYY-MM-DD).") from None
                        if not isinstance(due, str) or (due and len(due) != 10):
                            raise Problem(400, "Use a valid due date (YYYY-MM-DD).")
                        after["due"] = due
                    if "assignee" in patch:
                        if patch["assignee"] not in {m["id"] for m in state["members"]}:
                            raise Problem(400, "Choose a person with access to this document.")
                        after["assignee"] = patch["assignee"]
            if operation == "add":
                items.append(after)
            else:
                state[collection] = [after if i["id"] == item_id else i for i in items]
        content = {k: state[k] for k in ("comments", "tasks", "reminders", "notes")}
        revision = state["revision"] + 1
        with self.db:
            self.db.execute("INSERT INTO document_collaboration VALUES (?,?,?) ON CONFLICT(file_id) DO UPDATE SET revision=excluded.revision,content=excluded.content",
                            (row["id"], revision, json.dumps(content)))
            self.db.execute("INSERT INTO collaboration_events VALUES (?,?,?,?,?,?,?,?,?)", (row["id"], revision, actor, now, collection, operation, item_id, json.dumps(before), json.dumps(after)))
        return self.read(row, user)

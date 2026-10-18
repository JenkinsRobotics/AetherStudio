"""Immutable, content-addressed saved revisions and named versions."""

import difflib
import base64
import hashlib
import json
import time

from .state import Problem


class History:
    def __init__(self, store):
        self.store, self.db = store, store.db
        self.db.executescript("""
            CREATE TABLE IF NOT EXISTS library_blobs (hash TEXT PRIMARY KEY, content BLOB NOT NULL);
            CREATE TABLE IF NOT EXISTS library_history (
                file_id TEXT NOT NULL REFERENCES library(id), revision INTEGER NOT NULL,
                blob_hash TEXT NOT NULL REFERENCES library_blobs(hash), name TEXT NOT NULL,
                author TEXT NOT NULL REFERENCES users(id), saved REAL NOT NULL,
                event TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', PRIMARY KEY(file_id,revision));
            CREATE TABLE IF NOT EXISTS library_versions (
                file_id TEXT NOT NULL REFERENCES library(id), name TEXT NOT NULL,
                revision INTEGER NOT NULL, author TEXT NOT NULL REFERENCES users(id), created REAL NOT NULL,
                PRIMARY KEY(file_id,name), FOREIGN KEY(file_id,revision) REFERENCES library_history(file_id,revision));
            CREATE TABLE IF NOT EXISTS library_branches (
                file_id TEXT NOT NULL REFERENCES library(id), name TEXT NOT NULL,
                head_revision INTEGER NOT NULL, created_from INTEGER NOT NULL,
                author TEXT NOT NULL REFERENCES users(id), created REAL NOT NULL,
                PRIMARY KEY(file_id,name));
        """)
        history_columns = {row[1] for row in self.db.execute("PRAGMA table_info(library_history)")}
        if "branch" not in history_columns:
            self.db.execute("ALTER TABLE library_history ADD COLUMN branch TEXT NOT NULL DEFAULT 'Main'")
        if "parent_revision" not in history_columns:
            self.db.execute("ALTER TABLE library_history ADD COLUMN parent_revision INTEGER")
        if "merge_parent_revision" not in history_columns:
            self.db.execute("ALTER TABLE library_history ADD COLUMN merge_parent_revision INTEGER")
        version_columns = {row[1] for row in self.db.execute("PRAGMA table_info(library_versions)")}
        if "message" not in version_columns:
            self.db.execute("ALTER TABLE library_versions ADD COLUMN message TEXT NOT NULL DEFAULT ''")
        if "branch" not in version_columns:
            self.db.execute("ALTER TABLE library_versions ADD COLUMN branch TEXT NOT NULL DEFAULT 'Main'")
            self.db.execute("UPDATE library_versions SET branch=COALESCE((SELECT branch FROM library_history h WHERE h.file_id=library_versions.file_id AND h.revision=library_versions.revision),'Main')")
        for column, declaration in {
            "status": "TEXT NOT NULL DEFAULT 'version'",
            "origin": "TEXT NOT NULL DEFAULT 'user'",
            "status_updated": "REAL NOT NULL DEFAULT 0",
            "status_note": "TEXT NOT NULL DEFAULT ''",
        }.items():
            if column not in version_columns:
                self.db.execute(f"ALTER TABLE library_versions ADD COLUMN {column} {declaration}")
        branch_columns = {row[1] for row in self.db.execute("PRAGMA table_info(library_branches)")}
        if "message" not in branch_columns:
            self.db.execute("ALTER TABLE library_branches ADD COLUMN message TEXT NOT NULL DEFAULT ''")
        for row in self.db.execute(
            "SELECT * FROM library WHERE kind IN ('file','project') AND NOT EXISTS (SELECT 1 FROM library_history h WHERE h.file_id=library.id)"
        ).fetchall():
            self.record(
                row,
                row["owner"],
                "baseline",
                "History begins with the file retained when history support was installed.",
            )
        self.db.commit()

    def record(self, row, author, event, note="", branch="Main", parent=None, revision=None, content=None, merge_parent=None):
        content = (row["content"] if content is None else content) or b""
        digest = hashlib.sha256(content).hexdigest()
        self.db.execute(
            "INSERT OR IGNORE INTO library_blobs VALUES (?,?)", (digest, content)
        )
        self.db.execute(
            "INSERT INTO library_history(file_id,revision,blob_hash,name,author,saved,event,note,branch,parent_revision,merge_parent_revision) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (
                row["id"],
                row["revision"] if revision is None else revision,
                digest,
                row["name"],
                author,
                time.time(),
                event,
                str(note)[:500],
                branch,
                parent,
                merge_parent,
            ),
        )

    # ---- the lineage model -------------------------------------------------
    #
    # Git-shaped on purpose (Jonathan, 2026-10-02: "comparable to Onshape and
    # git"). A branch is a name with a moving head. Main's head is the library
    # row itself; every other branch's head lives in library_branches. Every
    # revision names its parent, a merge revision names two, and the walk
    # below is what "is this already merged", "what is the base", and
    # "what changed between here and there" are all built from.

    def head(self, row, branch):
        """The active head: (branch name, head revision). Main is the row."""
        name = str(branch or "Main")
        if name == "Main":
            return "Main", row["revision"]
        found = self.db.execute(
            "SELECT head_revision FROM library_branches WHERE file_id=? AND name=?",
            (row["id"], name),
        ).fetchone()
        if not found:
            raise Problem(404, "Branch not found.")
        return name, found["head_revision"]

    def next_revision(self, row):
        """The next free revision number for this file, across every branch."""
        top = self.db.execute(
            "SELECT MAX(revision) AS top FROM library_history WHERE file_id=?", (row["id"],)
        ).fetchone()["top"]
        return (row["revision"] if top is None else max(top, row["revision"])) + 1

    def advance(self, row, author, branch, content, event, note="", parent=None, merge_parent=None):
        """Record one new revision on a branch and move that branch's head to it.

        This is the one place a head moves. Main's head is the library row,
        so advancing Main also replaces the row's content; a branch head is a
        pointer in library_branches, so advancing it touches nothing else."""
        name, current = self.head(row, branch)
        parent = current if parent is None else parent
        next_revision = self.next_revision(row)
        self.record(row, author, event, note, branch=name, parent=parent, revision=next_revision,
                    content=content, merge_parent=merge_parent)
        if name == "Main":
            self.db.execute(
                "UPDATE library SET content=?,revision=?,modified=? WHERE id=?",
                (content, next_revision, time.time(), row["id"]),
            )
        else:
            self.db.execute(
                "UPDATE library_branches SET head_revision=? WHERE file_id=? AND name=?",
                (next_revision, row["id"], name),
            )
        return next_revision

    def parents(self, file_id, revision):
        """Both parents of a revision, or the previous Main revision for the
        legacy rows that recorded none (restores and settings edits before
        merge_parent existed). Roots have no parent."""
        found = self.db.execute(
            "SELECT parent_revision,merge_parent_revision,branch,event FROM library_history WHERE file_id=? AND revision=?",
            (file_id, revision),
        ).fetchone()
        if not found:
            return []
        out = [p for p in (found["parent_revision"], found["merge_parent_revision"]) if p is not None]
        if not out and found["event"] not in ("create", "baseline"):
            previous = self.db.execute(
                "SELECT MAX(revision) AS r FROM library_history WHERE file_id=? AND revision<? AND branch=?",
                (file_id, revision, found["branch"]),
            ).fetchone()["r"]
            if previous is not None:
                out.append(previous)
        return out

    def ancestors(self, file_id, revision):
        """Every revision reachable from this one, itself included."""
        seen, frontier = set(), [revision]
        while frontier:
            current = frontier.pop()
            if current in seen:
                continue
            seen.add(current)
            frontier.extend(self.parents(file_id, current))
        return seen

    def merge_base(self, file_id, a, b):
        """The newest revision both sides descend from, or None if unrelated."""
        common = self.ancestors(file_id, a) & self.ancestors(file_id, b)
        return max(common) if common else None

    @staticmethod
    def feature_diff(before, after):
        """What changed between two CAD documents, by feature id.

        Both must be the JSON part format with a `features` list; anything else
        — a workspace package, a non-CAD file — reports None and the caller
        falls back to "the bytes differ". This is the host's structural diff;
        the engine's geometric one is a separate packet."""
        try:
            a, b = json.loads(before), json.loads(after)
        except (ValueError, TypeError):
            return None
        if not all(isinstance(d, dict) and isinstance(d.get("features"), list) for d in (a, b)):
            return None
        def by_id(doc):
            return {f.get("id"): f for f in doc["features"] if isinstance(f, dict) and f.get("id")}

        def name(f):
            return f.get("name") or f.get("type") or "feature"

        fa, fb = by_id(a), by_id(b)
        return {
            "added": [{"id": i, "name": name(fb[i])} for i in fb if i not in fa],
            "removed": [{"id": i, "name": name(fa[i])} for i in fa if i not in fb],
            "changed": [{"id": i, "name": name(fb[i])} for i in fb if i in fa and fa[i] != fb[i]],
        }

    def branch_heads(self, file_id, main_head):
        branches = [
            dict(r)
            for r in self.db.execute(
                "SELECT name,head_revision,created_from,created,message FROM library_branches WHERE file_id=? ORDER BY created",
                (file_id,),
            )
        ]
        return [{"name": "Main", "head_revision": main_head, "created_from": None, "created": None}, *branches]

    def revision(self, file_id, revision):
        row = self.db.execute(
            "SELECT h.*,b.content FROM library_history h JOIN library_blobs b ON b.hash=h.blob_hash WHERE file_id=? AND revision=?",
            (file_id, revision),
        ).fetchone()
        if not row:
            raise Problem(404, "Saved revision not found.")
        return row

    @staticmethod
    def content_diff(before, after):
        """Bounded text comparison for any product; archives remain byte snapshots."""
        if before == after:
            return {"kind": "identical", "text": "", "truncated": False}
        if max(len(before), len(after)) > 200_000:
            return {"kind": "large", "text": "Download revisions to compare this large file.", "truncated": False}
        try:
            texts = [content.decode("utf-8") for content in (before, after)]
            if any("\x00" in text for text in texts):
                raise UnicodeError()
        except UnicodeError:
            return {"kind": "binary", "text": "Binary content changed. Download revisions to inspect.", "truncated": False}
        for index, text in enumerate(texts):
            try:
                texts[index] = json.dumps(json.loads(text), indent=2, sort_keys=True, ensure_ascii=False)
            except (ValueError, TypeError):
                pass
        lines = list(difflib.unified_diff(texts[0].splitlines(), texts[1].splitlines(), fromfile="Selected revision", tofile="Compared revision", lineterm=""))
        return {"kind": "text", "text": "\n".join(lines[:500])[:30000], "truncated": len(lines) > 500 or sum(map(len, lines)) > 30000}

    def dispatch(self, action, user, row, data):
        file_id = row["id"]
        if row["kind"] == "folder":
            raise Problem(400, "Select a document to view its history.")
        if action == "history":
            return {
                "writable": self.store.drive_access.role(row, user["id"]) in ("owner", "editor"),
                "scope": row["scope"],
                "revisions": [
                    dict(r)
                    for r in self.db.execute(
                        "SELECT h.revision,h.name,h.saved,h.event,h.note,h.blob_hash,h.branch,h.parent_revision,h.merge_parent_revision,COALESCE(NULLIF(u.full_name,''),u.username) AS author FROM library_history h JOIN users u ON u.id=h.author WHERE file_id=? ORDER BY revision DESC",
                        (file_id,),
                    )
                ],
                "versions": [
                    dict(r)
                    for r in self.db.execute(
                        "SELECT name,revision,created,message,status,origin,status_updated,status_note,branch FROM library_versions WHERE file_id=? ORDER BY created DESC",
                        (file_id,),
                    )
                ],
                "branches": self.branch_heads(file_id, row["revision"]),
            }
        if action == "read_revision":
            old = self.revision(file_id, data.get("revision"))
            return {
                "id": file_id,
                "name": old["name"],
                "revision": old["revision"],
                "data_base64": base64.b64encode(old["content"]).decode(),
                "writable": False,
            }
        if action == "compare":
            a = self.revision(file_id, data.get("from"))
            b = self.revision(file_id, data.get("to"))
            base = self.merge_base(file_id, a["revision"], b["revision"])
            def path(tip):
                """Revisions on this side since the base, newest first."""
                if base is None:
                    return sorted(self.ancestors(file_id, tip), reverse=True)
                return sorted(self.ancestors(file_id, tip) - self.ancestors(file_id, base), reverse=True)
            def rows(revisions):
                if not revisions:
                    return []
                marks = ",".join("?" * len(revisions))
                return [dict(r) for r in self.db.execute(
                    f"SELECT h.revision,h.saved,h.event,h.note,h.branch,COALESCE(NULLIF(u.full_name,''),u.username) AS author FROM library_history h JOIN users u ON u.id=h.author WHERE file_id=? AND revision IN ({marks}) ORDER BY revision DESC",
                    (file_id, *revisions))]
            return {
                "from": a["revision"], "to": b["revision"], "base": base,
                "same_content": a["blob_hash"] == b["blob_hash"],
                "content_diff": self.content_diff(a["content"], b["content"]),
                "from_only": rows(path(a["revision"])),
                "to_only": rows(path(b["revision"])),
                "features": self.feature_diff(a["content"], b["content"]),
            }
        if self.store.drive_access.role(row, user["id"]) not in ("owner", "editor"):
            raise Problem(403, "Only the document owner can change its history.")
        # Every mutation is guarded by the head the caller last saw — on the
        # branch they are working in, not always Main. A merge guards its
        # target; everything else guards the active branch.
        guard_branch = data.get("target") if action == "merge" else data.get("branch")
        guard_name, guard_head = self.head(row, guard_branch)
        if data.get("expected_revision") != guard_head:
            raise Problem(
                409, "The document changed. Refresh its history before continuing."
            )
        if action == "version":
            name = data.get("name", "")
            if not isinstance(name, str) or not 1 <= len(name.strip()) <= 80:
                raise Problem(400, "Use a version name of 1–80 characters.")
            if self.db.execute(
                "SELECT 1 FROM library_versions WHERE file_id=? AND name=?",
                (file_id, name.strip()),
            ).fetchone():
                raise Problem(409, "That version name is already in use.")
            message = data.get("message", "")
            if not isinstance(message, str) or len(message) > 500:
                raise Problem(400, "Use a commit message up to 500 characters.")
            self.db.execute(
                "INSERT INTO library_versions(file_id,name,revision,author,created,message,branch) VALUES (?,?,?,?,?,?,?)",
                (file_id, name.strip(), guard_head, user["id"], time.time(), message.strip(), guard_name),
            )
            self.store.audit(user["username"], "version_created", file_id)
            return {"ok": True, "revision": guard_head}
        if action == "version_status":
            name = str(data.get("name", "")).strip()
            version = self.db.execute("SELECT * FROM library_versions WHERE file_id=? AND name=?", (file_id, name)).fetchone()
            if not version:
                raise Problem(404, "Version not found.")
            if data.get("expected_status") != version["status"] or data.get("expected_status_updated") != version["status_updated"]:
                raise Problem(409, "The release state changed. Reload history before continuing.")
            allowed = {"version": {"candidate"}, "candidate": {"version", "released"}, "released": {"obsolete"}, "obsolete": set()}
            status = data.get("status")
            if not isinstance(status, str) or status not in allowed[version["status"]]:
                raise Problem(400, "Invalid release transition.")
            note = data.get("note", "")
            if not isinstance(note, str) or len(note) > 500 or (status == "obsolete" and not note.strip()):
                raise Problem(400, "Provide an obsoletion reason of 1–500 characters.")
            self.db.execute("UPDATE library_versions SET status=?,status_updated=?,status_note=? WHERE file_id=? AND name=?",
                            (status, time.time(), note.strip(), file_id, name))
            self.store.audit(user["username"], f"version_{status}", file_id)
            return {"ok": True, "status": status}
        if action in ("version_update", "version_delete"):
            name = str(data.get("name", "")).strip()
            if not self.db.execute(
                "SELECT 1 FROM library_versions WHERE file_id=? AND name=?", (file_id, name)
            ).fetchone():
                raise Problem(404, "Version not found.")
            state = self.db.execute("SELECT status FROM library_versions WHERE file_id=? AND name=?", (file_id, name)).fetchone()["status"]
            if state != "version":
                raise Problem(409, "Release records cannot be renamed or removed. Withdraw a candidate first.")
            if action == "version_delete":
                self.db.execute("DELETE FROM library_versions WHERE file_id=? AND name=?", (file_id, name))
                self.store.audit(user["username"], "version_deleted", file_id)
                return {"ok": True}
            new_name = data.get("new_name", name)
            if not isinstance(new_name, str) or not 1 <= len(new_name.strip()) <= 80:
                raise Problem(400, "Use a version name of 1–80 characters.")
            new_name = new_name.strip()
            if new_name != name and self.db.execute(
                "SELECT 1 FROM library_versions WHERE file_id=? AND name=?", (file_id, new_name)
            ).fetchone():
                raise Problem(409, "That version name is already in use.")
            message = data.get("message")
            if message is not None and (not isinstance(message, str) or len(message) > 500):
                raise Problem(400, "Use a commit message up to 500 characters.")
            if message is None:
                self.db.execute("UPDATE library_versions SET name=? WHERE file_id=? AND name=?", (new_name, file_id, name))
            else:
                self.db.execute("UPDATE library_versions SET name=?,message=? WHERE file_id=? AND name=?", (new_name, message.strip(), file_id, name))
            self.store.audit(user["username"], "version_updated", file_id)
            return {"ok": True, "name": new_name}
        if action == "branch_create":
            name = data.get("name", "")
            message = data.get("message", "")
            if not isinstance(message, str) or len(message) > 500:
                raise Problem(400, "Use a branch description up to 500 characters.")
            if not isinstance(name, str) or not 1 <= len(name.strip()) <= 80 or name.strip() == "Main":
                raise Problem(400, "Use a branch name of 1-80 characters (not Main).")
            if self.db.execute(
                "SELECT 1 FROM library_branches WHERE file_id=? AND name=?",
                (file_id, name.strip()),
            ).fetchone():
                raise Problem(409, "That branch name is already in use.")
            source = data.get("from_revision", row["revision"])
            self.revision(file_id, source)
            self.db.execute(
                "INSERT INTO library_branches(file_id,name,head_revision,created_from,author,created,message) VALUES (?,?,?,?,?,?,?)",
                (file_id, name.strip(), source, source, user["id"], time.time(), message.strip()),
            )
            self.store.audit(user["username"], "branch_created", file_id)
            return {"ok": True, "name": name.strip(), "head_revision": source}
        if action in ("branch_rename", "branch_delete"):
            name = str(data.get("name", "")).strip()
            if name == "Main":
                raise Problem(400, "Main cannot be renamed or deleted.")
            branch_name, branch_head = self.head(row, name)
            if action == "branch_delete":
                # Git refuses to delete a branch whose work is not reachable from
                # elsewhere, and so does this, unless told the work is disposable.
                merged = branch_head in self.ancestors(file_id, row["revision"])
                if not merged and not data.get("force"):
                    raise Problem(409, f"{branch_name} has work that is not merged into Main. Merge it, or delete with force.")
                self.db.execute("DELETE FROM library_branches WHERE file_id=? AND name=?", (file_id, branch_name))
                self.store.audit(user["username"], "branch_deleted", file_id)
                return {"ok": True, "merged": merged}
            new_name = data.get("new_name", "")
            if not isinstance(new_name, str) or not 1 <= len(new_name.strip()) <= 80 or new_name.strip() == "Main":
                raise Problem(400, "Use a branch name of 1-80 characters (not Main).")
            new_name = new_name.strip()
            if self.db.execute(
                "SELECT 1 FROM library_branches WHERE file_id=? AND name=?", (file_id, new_name)
            ).fetchone():
                raise Problem(409, "That branch name is already in use.")
            self.db.execute("UPDATE library_branches SET name=? WHERE file_id=? AND name=?", (new_name, file_id, branch_name))
            self.db.execute("UPDATE library_history SET branch=? WHERE file_id=? AND branch=?", (new_name, file_id, branch_name))
            self.db.execute("UPDATE library_versions SET branch=? WHERE file_id=? AND branch=?", (new_name, file_id, branch_name))
            self.store.audit(user["username"], "branch_renamed", file_id)
            return {"ok": True, "name": new_name}
        if action == "merge":
            source_name, source_head = self.head(row, data.get("source"))
            target_name, target_head = guard_name, guard_head
            if data.get("expected_source_revision", source_head) != source_head:
                raise Problem(409, "The source branch changed. Refresh and review the merge again.")
            if source_name == target_name:
                raise Problem(400, "Choose a different branch to merge from.")
            if source_head in self.ancestors(file_id, target_head):
                return {"ok": True, "merged": False, "reason": "already", "revision": target_head}
            base = self.merge_base(file_id, source_head, target_head)
            fast_forward = base == target_head
            source_rev = self.revision(file_id, source_head)
            if fast_forward:
                content = source_rev["content"]
            else:
                # Both sides moved. A CAD document is one blob, so there is no
                # line-level three-way merge to run: like git on a binary, the
                # caller must say which side wins, and the merge revision
                # records both parents so the choice is visible in history.
                resolution = data.get("resolution")
                if resolution not in ("source", "target"):
                    raise Problem(409, "Both branches changed since they diverged. Resolve the conflict by choosing a side.", {
                        "conflict": True, "base": base, "source": source_name, "source_head": source_head,
                        "target": target_name, "target_head": target_head,
                        "features": self.feature_diff(self.revision(file_id, target_head)["content"], source_rev["content"]),
                    })
                content = source_rev["content"] if resolution == "source" else self.revision(file_id, target_head)["content"]
            note = str(data.get("message") or f"Merged {source_name} into {target_name}")[:500]
            # Always a merge revision, never a moved pointer (git --no-ff): the
            # merge is then an event in the log with two parents, on every branch.
            new_revision = self.advance(row, user["id"], target_name, content, "merge", note,
                                        parent=target_head, merge_parent=source_head)
            # Explicit merge checkpoint, never produced by routine saves.
            label = f"Merge {time.strftime('%Y-%m-%d %H:%M:%S', time.gmtime())}: {source_name} into {target_name}"[:80]
            while self.db.execute("SELECT 1 FROM library_versions WHERE file_id=? AND name=?", (file_id, label)).fetchone():
                label = f"Merge {new_revision}: {time.time_ns()}"
            self.db.execute("INSERT INTO library_versions(file_id,name,revision,author,created,message,origin,branch) VALUES (?,?,?,?,?,?,?,?)",
                            (file_id, label, new_revision, user["id"], time.time(), note, "automatic", target_name))
            self.store.audit(user["username"], "branch_merged", file_id)
            return {"ok": True, "merged": True, "fast_forward": fast_forward, "revision": new_revision,
                    "source_head": source_head, "target": target_name}
        if action == "restore":
            old = self.revision(file_id, data.get("revision"))
            # Restoring while working in a branch moves that branch, not Main.
            # Before this, a restore from a branch view rewrote Main's content.
            new_revision = self.advance(row, user["id"], guard_name, old["content"], "restore",
                                        f"Restored revision {old['revision']}")
            self.store.audit(user["username"], "revision_restored", file_id)
            return {"ok": True, "revision": new_revision, "branch": guard_name}
        raise Problem(404, "Unknown history operation.")

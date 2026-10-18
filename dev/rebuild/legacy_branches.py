"""Recover provable legacy branch lineage without changing frozen snapshots.

Names were the old server's only identities. Refuse reused/discontinuous names
instead of attaching historical records to a possibly unrelated active branch.
Deleted branches are retained as tombstones; their unavailable creation metadata
is explicitly marked as recovered, never presented as an original creation event.
"""
import hashlib
import json
import math
import re


def extract(db, require):
    def rows(table):
        return [dict(r) for r in db.execute("SELECT * FROM " + table)]

    def name(value):
        require(isinstance(value, str) and value == value.strip() and 1 <= len(value) <= 80
                and not any(ord(c) < 32 or 127 <= ord(c) <= 159 for c in value),
                "Invalid legacy branch name.")

    users = {r[0] for r in db.execute("SELECT id FROM users")}
    files = {r["id"]: r for r in rows("library")}
    tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    active = {}
    for b in rows("library_branches") if "library_branches" in tables else []:
        require(set(b) == {"file_id", "name", "head_revision", "created_from", "author", "created", "message"},
                "Unsupported legacy branch fields.")
        name(b["name"])
        require(b["name"] != "Main" and b["file_id"] in files
                and files[b["file_id"]]["kind"] == "file" and b["author"] in users,
                "Invalid legacy branch reference.")
        require(type(b["created"]) in (int, float) and math.isfinite(b["created"])
                and 0 <= b["created"] < 9_223_372_036_854_775, "Invalid legacy branch time.")
        require(isinstance(b["message"], str) and len(b["message"]) <= 500 and "\0" not in b["message"],
                "Invalid legacy branch description.")
        active[b["file_id"], b["name"]] = b

    histories = {}
    for h in rows("library_history"):
        require(set(h) == {"file_id", "revision", "blob_hash", "name", "author", "saved", "event", "note",
                           "branch", "parent_revision", "merge_parent_revision"}, "Unsupported legacy history fields.")
        name(h["branch"])
        require(type(h["saved"]) in (int, float) and math.isfinite(h["saved"])
                and 0 <= h["saved"] < 9_223_372_036_854_775, "Invalid history time.")
        require(isinstance(h["note"], str) and len(h["note"]) <= 500 and "\0" not in h["note"],
                "Invalid history note.")
        require(h["author"] in users and h["event"] in ("create", "baseline", "save", "rename", "merge", "restore", "document_units"),
                "Invalid history author/event.")
        require(type(h["revision"]) is int and 1 <= h["revision"] <= 4294967295,
                "Invalid legacy revision number.")
        require(h["file_id"] in files and files[h["file_id"]]["kind"] == "file",
                "Invalid legacy history document.")
        histories.setdefault(h["file_id"], []).append(h)

    result = {"branches": [], "lineage": {}, "names": {}}
    for file, history in histories.items():
        history.sort(key=lambda h: h["revision"])
        require(all(h["revision"] == i for i, h in enumerate(history, 1)),
                "Incomplete history; refusing to invent missing revisions.")
        require(history[0]["branch"] == "Main", "Legacy history must begin on Main.")
        by_revision = {h["revision"]: h for h in history}
        groups = {}
        for h in history:
            groups.setdefault(h["branch"], []).append(h)
        names = set(groups) | {n for f, n in active if f == file}
        require(len(names - {"Main"}) <= 4096, "Legacy branches exceed the native listing limit.")
        for label in sorted(names):
            entries = groups.get(label, [])
            b = active.get((file, label))
            branch_id = None
            fork = None
            if label != "Main":
                if entries:
                    fork = entries[0]["parent_revision"]
                    require(type(fork) is int and 0 < fork < entries[0]["revision"],
                            "Unprovable legacy branch origin; original archive retained.")
                if b:
                    require(type(b["head_revision"]) is int and type(b["created_from"]) is int
                            and b["head_revision"] in by_revision and b["created_from"] in by_revision,
                            "Missing legacy branch head/origin.")
                    require(not entries or (fork == b["created_from"] and b["created"] <= entries[0]["saved"]),
                            "Ambiguous reused legacy branch name; review original archive.")
                    fork = b["created_from"]
                    require(b["head_revision"] == (entries[-1]["revision"] if entries else fork),
                            "Legacy branch head differs from its history.")
                require(fork in by_revision, "Missing legacy branch origin.")
                key = json.dumps(["legacy-import", file, label, fork], ensure_ascii=False, separators=(",", ":"))
                branch_id = "branch-" + hashlib.sha256(key.encode()).hexdigest()
                result["names"][file, label] = branch_id
                result["branches"].append({"document_id": file, "id": branch_id, "name": label,
                    "head_revision": b["head_revision"] if b else entries[-1]["revision"],
                    "created_from": fork, "actor": b["author"] if b else entries[0]["author"],
                    "created_unix_ms": int((b["created"] if b else entries[0]["saved"]) * 1000),
                    "message": b["message"] if b else "Recovered deleted legacy branch; original creation metadata unavailable.",
                    "deleted": b is None, "recovered_creation": b is None})
            previous = fork
            for h in entries:
                parent = h["parent_revision"]
                # This is the original History.parents fallback, not global r-1.
                if parent is None and h["merge_parent_revision"] is None and h["event"] not in ("create", "baseline"):
                    parent = previous
                require(parent == previous and (parent is None or (type(parent) is int and parent < h["revision"])),
                        "Discontinuous or reused legacy branch lineage.")
                require((h["revision"] == 1) == (parent is None), "Detached legacy history root.")
                merge = h["merge_parent_revision"]
                require((merge is not None) == (h["event"] == "merge") and (merge is None or
                        (type(merge) is int and 0 < merge < h["revision"] and merge != parent)),
                        "Invalid legacy merge ancestry.")
                restored = None
                if h["event"] == "restore":
                    match = re.fullmatch(r"Restored revision ([1-9][0-9]*)", h["note"])
                    restored = int(match[1]) if match else None
                    require(restored in by_revision and restored < h["revision"]
                            and by_revision[restored]["blob_hash"] == h["blob_hash"],
                            "Unprovable legacy restore source.")
                result["lineage"][file, h["revision"]] = {"parent_revision": parent,
                    "restored_from_revision": restored,
                    **({"branch_id": branch_id} if branch_id else {}),
                    **({"merge_parent_revision": merge} if merge else {})}
                previous = h["revision"]
            if label == "Main":
                require(entries and files[file]["revision"] == entries[-1]["revision"],
                        "Legacy Main head differs from its history.")
    require(all(file in histories for file, _ in active), "Branch without document history.")
    return result


def reference(graph, file, label, require, context="legacy branch"):
    if label == "Main":
        return None
    branch_id = graph["names"].get((file, label))
    require(branch_id is not None, "Unresolvable " + context + " reference; review original archive.")
    return branch_id


def import_rows(graph, insert, digest, encoded):
    for raw in graph["branches"]:
        branch = dict(raw)
        recovered = branch.pop("recovered_creation")
        op = "legacy-branch-create-" + digest(encoded([branch["document_id"], branch["id"]]).encode())
        # Import receipts describe snapshot adoption, not replayable legacy commands.
        head = {k: branch[k] for k in ("id", "name", "head_revision", "created_from", "created_unix_ms", "message", "deleted")}
        head["author"] = branch["actor"]
        receipt = {"kind": "head", "branch": head,
                   "legacy_import": {"recovered_creation": recovered}}
        audit = {"operation_id": op, "document_id": branch["document_id"], "actor": branch["actor"],
                 "event": "branch_create", "saved_unix_ms": branch["created_unix_ms"]}
        insert("aether_store.branch_operations", {**audit, "fingerprint": digest(encoded(receipt).encode()), "receipt": receipt})
        insert("aether_store.branch_audit", audit)
        insert("aether_store.branches", {**branch, "created_operation_id": op})

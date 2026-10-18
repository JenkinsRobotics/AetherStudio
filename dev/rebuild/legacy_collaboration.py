"""Validate and replay legacy collaboration before an offline native import.

No source mutation, invented receipts, or loss of deleted item history. This
module is an operator adapter, never an application runtime dependency.
"""
import base64
import binascii
import datetime
import json
import math
import re

MAX_BYTES = 16 * 1024 * 1024


def extract(db, require, graph=None):
    if __package__:
        from .legacy_branches import extract as branches
        from .legacy_branches import reference
    else:
        from legacy_branches import extract as branches
        from legacy_branches import reference
    graph = branches(db, require) if graph is None else graph
    tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    if not ({"document_collaboration", "collaboration_events"} & tables):
        return {"heads": [], "items": [], "events": []}
    require({"document_collaboration", "collaboration_events"} <= tables,
            "Incomplete collaboration schema.")
    users = {r[0] for r in db.execute("SELECT id FROM users")}
    files = {r[0] for r in db.execute("SELECT id FROM library WHERE kind='file'")}
    revisions = {(r[0], r[1]) for r in db.execute("SELECT file_id,revision FROM library_history")}
    result = {"heads": [], "items": [], "events": []}

    def text(v, limit, required=False):
        require(isinstance(v, str) and "\0" not in v and len(v) <= limit
                and (not required or bool(v.strip())), "Invalid collaboration text.")

    def stamp(v):
        require(type(v) in (int, float) and math.isfinite(v) and v >= 0,
                "Invalid collaboration timestamp.")

    def identifier(v):
        require(isinstance(v, str) and re.fullmatch(r"[A-Za-z0-9_.:-]{1,128}", v),
                "Invalid collaboration item identifier.")

    def images(v):
        require(isinstance(v, list) and len(v) <= 3, "Invalid collaboration images.")
        for image in v:
            require(isinstance(image, dict) and set(image) == {"name", "data_url"},
                    "Invalid collaboration image fields.")
            text(image["name"], 160)
            require(len(image["name"]) >= 1, "Invalid collaboration image name.")
            data = image["data_url"]
            require(isinstance(data, str) and len(data) <= 1400000, "Invalid collaboration image size.")
            try:
                prefix, payload = data.split(",", 1)
                raw = base64.b64decode(payload, validate=True)
                require(len(raw) <= 1048576 and (
                    (prefix == "data:image/png;base64" and raw.startswith(b"\x89PNG\r\n\x1a\n")) or
                    (prefix == "data:image/jpeg;base64" and raw.startswith(b"\xff\xd8\xff"))),
                    "Invalid collaboration image format.")
            except (ValueError, binascii.Error):
                require(False, "Invalid collaboration image encoding.")

    def item(v, collection, file):
        require(isinstance(v, dict), "Invalid collaboration item.")
        if collection == "notes":
            require(set(v) == {"text"} or set(v) == {"text", "author", "updated"},
                    "Unsupported collaboration note fields.")
            text(v["text"], 50000)
            if "author" in v:
                require(isinstance(v["author"], str) and v["author"] in users, "Unknown collaboration author.")
                stamp(v["updated"])
            return
        basic = {"id", "author", "created", "updated", "text"}
        required = basic | ({"parent", "revision", "branch", "resolved"} if collection == "comments"
                            else {"status", "due", "assignee"})
        allowed = required | {"deleted"} | ({"attachments", "reference_name"} if collection == "comments" else set())
        require(required <= set(v) <= allowed, "Unsupported collaboration item fields.")
        identifier(v["id"])
        require(isinstance(v["author"], str) and v["author"] in users, "Unknown collaboration author.")
        stamp(v["created"])
        stamp(v["updated"])
        require(v["updated"] >= v["created"], "Invalid collaboration time order.")
        require("deleted" not in v or v["deleted"] is True, "Invalid collaboration tombstone.")
        text(v["text"], 10000 if collection == "comments" else 1000, not v.get("deleted"))
        if v.get("deleted"):
            require(v["text"] == "", "Invalid collaboration deleted text.")
        if collection == "comments":
            reference(graph, file, v["branch"], require, "collaboration branch")
            if v["parent"] is not None:
                identifier(v["parent"])
            ref = v["revision"]
            require(ref is None or (type(ref) is int and (file, ref) in revisions),
                    "Invalid collaboration saved-state reference.")
            require(type(v["resolved"]) is bool and (v["parent"] is None or not v["resolved"]),
                    "Invalid collaboration resolution.")
            if "reference_name" in v:
                text(v["reference_name"], 80)
            if "attachments" in v:
                images(v["attachments"])
            if v.get("deleted"):
                require(v.get("attachments") == [], "Invalid deleted collaboration attachments.")
        else:
            require(isinstance(v["assignee"], str) and v["assignee"] in users and v["status"] in ("open", "in_progress", "done"),
                    "Invalid collaboration assignment/state.")
            date = v["due"]
            require(isinstance(date, str), "Invalid collaboration due date.")
            if date:
                require(re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", date), "Invalid collaboration due date.")
                try:
                    datetime.date.fromisoformat(date)
                except ValueError:
                    require(False, "Invalid collaboration due date.")

    saved = {r["file_id"]: dict(r) for r in db.execute("SELECT * FROM document_collaboration")}
    require(all(f in files for f in saved), "Unknown collaboration document.")
    events = {}
    for r in db.execute("SELECT * FROM collaboration_events ORDER BY file_id,revision"):
        r = dict(r)
        require(r["file_id"] in saved, "Orphan collaboration event.")
        events.setdefault(r["file_id"], []).append(r)
    for file, row in saved.items():
        require(set(row) == {"file_id", "revision", "content"}, "Unsupported collaboration state fields.")
        require(type(row["revision"]) is int and 1 <= row["revision"] <= 4294967295,
                "Invalid collaboration revision.")
        try:
            content = json.loads(row["content"])
        except (TypeError, ValueError):
            require(False, "Invalid collaboration JSON.")
        state = {"comments": [], "tasks": [], "reminders": [], "notes": {"text": ""}}
        require(isinstance(content, dict) and set(content) == set(state), "Unsupported collaboration collections.")
        history = events.get(file, [])
        require(len(history) == row["revision"], "Incomplete collaboration history.")
        for revision, event in enumerate(history, 1):
            require(set(event) == {"file_id", "revision", "actor", "created", "collection", "operation", "item", "before_json", "after_json"},
                    "Unsupported collaboration event fields.")
            collection, operation, key = event["collection"], event["operation"], event["item"]
            require(event["revision"] == revision and event["actor"] in users,
                    "Invalid collaboration event sequence/author.")
            stamp(event["created"])
            require(collection in state and operation in ("add", "update", "delete"),
                    "Unsupported collaboration event.")
            try:
                before, after = json.loads(event["before_json"]), json.loads(event["after_json"])
            except (TypeError, ValueError):
                require(False, "Invalid collaboration event JSON.")
            item(after, collection, file)
            require(after.get("updated") == event["created"], "Collaboration event time mismatch.")
            if collection == "notes":
                require(key == "notes" and operation == "update" and before == state[collection]
                        and after.get("author") == event["actor"], "Invalid collaboration note event.")
                state[collection] = after
            else:
                identifier(key)
                require(after["id"] == key, "Collaboration event item mismatch.")
                items = state[collection]
                previous = next((v for v in items if v["id"] == key), None)
                require(before == previous, "Collaboration before-state mismatch.")
                if operation == "add":
                    require(previous is None and not after.get("deleted") and len(items) < 5000
                            and after["author"] == event["actor"] and after["created"] == event["created"],
                            "Invalid collaboration addition.")
                    if collection == "comments" and after["parent"] is not None:
                        require(any(v["id"] == after["parent"] and v["parent"] is None and not v.get("deleted") for v in items),
                                "Invalid collaboration reply parent.")
                    items.append(after)
                else:
                    require(previous is not None and not previous.get("deleted")
                            and all(after[k] == previous[k] for k in ("author", "created", "id")),
                            "Invalid collaboration update.")
                    if collection == "comments":
                        require(all(after[k] == previous[k] for k in ("parent", "branch")), "Changed collaboration parent.")
                    require(bool(after.get("deleted")) == (operation == "delete"), "Invalid collaboration deletion.")
                    items[items.index(previous)] = after
            result["events"].append({"document_id": file, "revision": revision, "actor": event["actor"],
                "created": event["created"], "collection": collection, "operation": operation,
                "item_id": key, "before_state": before, "after_state": after, "operation_id": None})
        require(state == content, "Collaboration history does not reconstruct saved state.")
        # Default json spacing conservatively bounds PostgreSQL's stored JSON text.
        require(len(json.dumps(state, ensure_ascii=False).encode()) <= MAX_BYTES,
                "Collaboration exceeds qualified state size.")
        result["heads"].append({"document_id": file, "revision": row["revision"]})
        for collection, values in state.items():
            if collection == "notes":
                values = [values] if "author" in values else []
            for position, value in enumerate(values):
                result["items"].append({"document_id": file, "collection": collection,
                    "item_id": "notes" if collection == "notes" else value["id"],
                    "position": position, "value": value})
    # Validate the original event replay first. Then project stable identities
    # into every retained state without changing names, timestamps or archives.
    def projected(value, file):
        if value is None:
            return None
        branch_id = reference(graph, file, value["branch"], require)
        return {**value, **({"branch_id": branch_id} if branch_id else {})}

    for event in result["events"]:
        if event["collection"] == "comments":
            for key in ("before_state", "after_state"):
                event[key] = projected(event[key], event["document_id"])
    for item in result["items"]:
        if item["collection"] == "comments":
            item["value"] = projected(item["value"], item["document_id"])
    return result

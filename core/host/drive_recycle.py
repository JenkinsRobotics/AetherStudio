"""Recycle-bin presentation and permission-checked permanent deletion."""

from .state import Problem


def recycle_metadata(drive, row, uid):
    db = drive.db
    deleted = db.execute(
        """SELECT e.created,COALESCE(NULLIF(u.full_name,''),u.username) author
        FROM drive_events e JOIN users u ON u.id=e.actor
        WHERE e.file_id=? AND e.action='trash' ORDER BY e.id DESC LIMIT 1""",
        (row["id"],),
    ).fetchone()
    creator = db.execute(
        """SELECT author FROM (
        SELECT COALESCE(NULLIF(u.full_name,''),u.username) author,h.saved created
        FROM library_history h JOIN users u ON u.id=h.author WHERE h.file_id=? AND h.event='create'
        UNION ALL SELECT COALESCE(NULLIF(u.full_name,''),u.username),e.created
        FROM drive_events e JOIN users u ON u.id=e.actor WHERE e.file_id=? AND e.action IN ('created','copy')
        ) ORDER BY created LIMIT 1""",
        (row["id"], row["id"]),
    ).fetchone()
    place = drive.access.location(row)
    root = "My files" if row["owner"] == uid else "Shared files"
    if place["workspace"] and drive.access.workspace_role(uid, place["workspace"]):
        workspace = db.execute(
            "SELECT name FROM drive_workspaces WHERE id=?", (place["workspace"],)
        ).fetchone()
        root = workspace[0] if workspace else "Workspace"
    parts, parent, seen = [], row["parent"], {row["id"]}
    while parent and parent not in seen:
        seen.add(parent)
        folder = db.execute("SELECT * FROM library WHERE id=?", (parent,)).fetchone()
        if not folder or not drive.access.role(folder, uid, include_trash=True):
            root = "Shared files"
            break
        parts.insert(0, folder["name"])
        parent = folder["parent"]
    return {
        "deleted_at": deleted["created"] if deleted else None,
        "deleted_by": deleted["author"] if deleted else None,
        "created_by": creator["author"] if creator else None,
        "original_location": " > ".join([root, *parts]),
    }


def purge(drive, uid, roots):
    """Validate the whole selection before mutating any row, including children."""
    items = {}
    for row in roots:
        if not row["trashed"]:
            raise Problem(
                409, "An item is no longer in the recycle bin. Refresh and try again."
            )
        for item in drive.descendants(row):
            drive.access.require(item, uid, "owner", include_trash=True)
            items[item["id"]] = item
    # Reverse traversal removes child references before parents. De-duplicate
    # selections that contain both a folder and separately deleted descendants.
    ordered, visited = [], set()
    for root in roots:
        for item in reversed(drive.descendants(root)):
            if item["id"] not in visited:
                ordered.append(item)
                visited.add(item["id"])
    for item in ordered:
        for table in (
            "library_recents",
            "library_versions",
            "library_branches",
            "library_history",
            "document_collaboration",
            "collaboration_events",
        ):
            drive.db.execute(f"DELETE FROM {table} WHERE file_id=?", (item["id"],))
        drive.db.execute(
            "UPDATE drive_events SET file_id=NULL WHERE file_id=?", (item["id"],)
        )
        drive.db.execute("DELETE FROM library WHERE id=?", (item["id"],))
    return len(items)


def empty_recycle_bin(drive, user, data):
    org, ids = data.get("organization", "default"), data.get("ids")
    if org != "all":
        drive.access.require_org(user["id"], org)
    if (
        not isinstance(ids, list)
        or not ids
        or len(ids) > 10000
        or any(not isinstance(i, str) for i in ids)
    ):
        raise Problem(400, "Choose the recycled items to delete.")
    roots = [
        drive.row(user["id"], ident, "owner", trash=True)
        for ident in dict.fromkeys(ids)
    ]
    if org != "all" and any(drive.access.location(row)["organization"] != org for row in roots):
        raise Problem(400, "Choose items in the current organization.")
    organizations = {row["id"]: drive.access.location(row)["organization"] for row in roots}
    drive.db.execute("SAVEPOINT empty_recycle_bin")
    try:
        count = purge(drive, user["id"], roots)
        for row in roots:
            drive.access.event(user["id"], organizations[row["id"]], "delete_forever", detail=row["name"])
        drive.db.execute("RELEASE empty_recycle_bin")
        drive.db.commit()
    except Exception:
        drive.db.execute("ROLLBACK TO empty_recycle_bin")
        drive.db.execute("RELEASE empty_recycle_bin")
        raise
    return {"ok": True, "deleted": count}

"""Permission-filtered synchronization inventory. Missing access never means deletion."""

import hashlib

from .state import Problem


def manifest(drive, user, data):
    uid, org, workspace, parent = (
        user["id"],
        data.get("organization", "default"),
        data.get("workspace"),
        data.get("parent"),
    )
    drive.access.require_org(uid, org)
    if workspace and not drive.access.workspace_role(uid, workspace):
        raise Problem(403, "Workspace access is unavailable.")
    if parent:
        root = drive.row(uid, parent)
        if root["kind"] != "folder" or drive.access.location(root) != {
            "organization": org,
            "workspace": workspace,
        }:
            raise Problem(400, "Choose a folder in this library.")
    rows = {
        r["id"]: r
        for r in drive.db.execute(
            "SELECT l.* FROM library l JOIN drive_locations d ON l.id=d.file_id WHERE d.organization=? AND d.workspace IS ?",
            (org, workspace),
        )
    }
    output = []
    for row in rows.values():
        role = drive.access.role(row, uid, include_trash=True)
        if not role or (not workspace and not parent and row["owner"] != uid):
            continue
        parts, cursor, visited, trashed = (
            [row["name"]],
            row,
            {row["id"]},
            bool(row["trashed"]),
        )
        while cursor["parent"] and cursor["parent"] != parent:
            cursor = rows.get(cursor["parent"])
            if (
                not cursor
                or cursor["id"] in visited
                or not drive.access.role(cursor, uid, True)
            ):
                parts = []
                break
            visited.add(cursor["id"])
            parts.insert(0, cursor["name"])
            trashed |= bool(cursor["trashed"])
        if not parts or (parent and (not cursor or cursor["parent"] != parent)):
            continue
        descriptor = (
            drive.storage.descriptor(row["content"]) if row["app"] == "drive" else None
        )
        output.append(
            {
                **drive.metadata(row, uid),
                "path": "/".join(parts),
                "trashed": trashed,
                "sha256": descriptor["aether_drive_blob"]
                if descriptor
                else hashlib.sha256(row["content"] or b"").hexdigest(),
            }
        )
    return {
        "files": sorted(output, key=lambda r: (r["path"].count("/"), r["path"])),
        "organization": org,
        "workspace": workspace,
    }

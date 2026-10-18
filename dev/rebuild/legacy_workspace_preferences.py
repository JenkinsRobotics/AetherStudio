"""Preserve personal workspace preferences without inventing historical events."""
import math


def extract(db, require):
    tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    if "drive_workspace_preferences" not in tables:
        return []
    columns = {r[1] for r in db.execute("PRAGMA table_info(drive_workspace_preferences)")}
    require(columns == {"user_id", "workspace", "favorite", "opened"},
            "Unsupported workspace preference fields.")
    users = {r[0] for r in db.execute("SELECT id FROM users")}
    workspaces = {r[0] for r in db.execute("SELECT id FROM drive_workspaces")}
    result = []
    seen = set()
    for row in db.execute("SELECT user_id,workspace,favorite,opened FROM drive_workspace_preferences"):
        user, workspace, favorite, opened = row
        require(isinstance(user, str) and user in users and isinstance(workspace, str)
                and workspace in workspaces, "Invalid workspace preference owner or workspace.")
        require(type(favorite) is int and favorite in (0, 1), "Invalid workspace favorite state.")
        require(opened is None or (type(opened) in (int, float) and math.isfinite(opened)
                                  and opened >= 0), "Invalid workspace opened timestamp.")
        require((user, workspace) not in seen, "Duplicate workspace preference.")
        seen.add((user, workspace))
        result.append({"user_id": user, "workspace": workspace, "favorite": bool(favorite),
                       "opened": opened, "revision": 0})
    return sorted(result, key=lambda r: (r["user_id"], r["workspace"]))

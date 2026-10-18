"""Organization defaults and per-user workspace-directory preferences."""

import secrets
import time
from .state import Problem


def initialize(db):
    db.executescript("""
        CREATE TABLE IF NOT EXISTS drive_org_workspaces(
          organization TEXT PRIMARY KEY REFERENCES drive_organizations(id) ON DELETE CASCADE,
          workspace TEXT NOT NULL UNIQUE REFERENCES drive_workspaces(id) ON DELETE CASCADE);
        CREATE TABLE IF NOT EXISTS drive_workspace_preferences(
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          workspace TEXT NOT NULL REFERENCES drive_workspaces(id) ON DELETE CASCADE,
          favorite INTEGER NOT NULL DEFAULT 0, opened REAL,
          PRIMARY KEY(user_id,workspace));
        CREATE TABLE IF NOT EXISTS drive_workspace_icons(
          workspace TEXT PRIMARY KEY REFERENCES drive_workspaces(id) ON DELETE CASCADE,
          icon TEXT NOT NULL);
    """)


def ensure_defaults(db):
    for org in db.execute(
        "SELECT * FROM drive_organizations WHERE id NOT IN (SELECT organization FROM drive_org_workspaces)"
    ).fetchall():
        # Keep the original shared workspace and every existing file ID in place.
        ident = "shared" if org["id"] == "default" else secrets.token_hex(12)
        db.execute(
            "INSERT OR IGNORE INTO drive_workspaces VALUES (?,?,?,?)",
            (ident, org["id"], org["name"], time.time()),
        )
        db.execute("INSERT INTO drive_org_workspaces VALUES (?,?)", (org["id"], ident))


def is_default(db, ident):
    return bool(
        db.execute(
            "SELECT 1 FROM drive_org_workspaces WHERE workspace=?", (ident,)
        ).fetchone()
    )


def directory(access, uid):
    return [
        {
            **dict(row),
            "icon": icon_for(access.db, row["id"]),
            "is_default": bool(row["is_default"]),
            "favorite": bool(row["favorite"]),
            "role": role,
        }
        for row in access.db.execute(
            """
            SELECT w.*,d.workspace IS NOT NULL is_default,
            COALESCE(p.favorite,0) favorite,p.opened
            FROM drive_workspaces w LEFT JOIN drive_org_workspaces d ON d.workspace=w.id
            LEFT JOIN drive_workspace_preferences p ON p.workspace=w.id AND p.user_id=?
            ORDER BY w.created
        """,
            (uid,),
        )
        if (role := access.workspace_role(uid, row["id"]))
    ]


def preference(access, action, user, data):
    uid, ident = user["id"], data.get("workspace")
    if not access.workspace_role(uid, ident):
        raise Problem(404, "Workspace not found, or access is unavailable.")
    if action == "workspace_favorite":
        favorite = data.get("favorite")
        if not isinstance(favorite, bool):
            raise Problem(400, "Choose a favorite state.")
        access.db.execute(
            """INSERT INTO drive_workspace_preferences(user_id,workspace,favorite)
            VALUES (?,?,?) ON CONFLICT(user_id,workspace) DO UPDATE SET favorite=excluded.favorite""",
            (uid, ident, int(favorite)),
        )
    else:
        access.db.execute(
            """INSERT INTO drive_workspace_preferences(user_id,workspace,opened)
            VALUES (?,?,?) ON CONFLICT(user_id,workspace) DO UPDATE SET opened=excluded.opened""",
            (uid, ident, time.time()),
        )
    access.db.commit()
    return {"workspaces": directory(access, uid)}

WORKSPACE_ICONS = {"folder", "settings", "group", "camera", "film", "cube", "code", "shield", "star"}


def validate_icon(icon):
    if icon is not None and (not isinstance(icon, str) or icon not in WORKSPACE_ICONS):
        raise Problem(400, "Choose a supported workspace icon.")
    return icon


def icon_for(db, workspace):
    row = db.execute("SELECT icon FROM drive_workspace_icons WHERE workspace=?", (workspace,)).fetchone()
    return row[0] if row else None


def set_icon(db, workspace, icon):
    validate_icon(icon)
    if icon:
        db.execute("INSERT INTO drive_workspace_icons VALUES (?,?) ON CONFLICT(workspace) DO UPDATE SET icon=excluded.icon", (workspace, icon))
    else:
        db.execute("DELETE FROM drive_workspace_icons WHERE workspace=?", (workspace,))

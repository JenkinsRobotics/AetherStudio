"""Organization, workspace and inherited file permissions for Studio's one library."""

import secrets
import time

from .state import Problem
from . import drive_workspaces

ROLES = {"viewer": 1, "editor": 2, "owner": 3}


class DriveAccess:
    def __init__(self, store):
        self.store, self.db = store, store.db
        self.db.executescript("""
          CREATE TABLE IF NOT EXISTS drive_organizations(id TEXT PRIMARY KEY,name TEXT NOT NULL,created REAL NOT NULL);
          CREATE TABLE IF NOT EXISTS drive_members(organization TEXT NOT NULL,user_id TEXT NOT NULL REFERENCES users(id),role TEXT NOT NULL,PRIMARY KEY(organization,user_id));
          CREATE TABLE IF NOT EXISTS drive_enrolled(user_id TEXT PRIMARY KEY);
          CREATE TABLE IF NOT EXISTS drive_workspaces(id TEXT PRIMARY KEY,organization TEXT NOT NULL REFERENCES drive_organizations(id),name TEXT NOT NULL,created REAL NOT NULL);
          CREATE TABLE IF NOT EXISTS drive_workspace_members(workspace TEXT NOT NULL REFERENCES drive_workspaces(id),user_id TEXT NOT NULL REFERENCES users(id),role TEXT NOT NULL,PRIMARY KEY(workspace,user_id));
          CREATE TABLE IF NOT EXISTS drive_locations(file_id TEXT PRIMARY KEY REFERENCES library(id) ON DELETE CASCADE,organization TEXT NOT NULL REFERENCES drive_organizations(id),workspace TEXT REFERENCES drive_workspaces(id));
          CREATE TABLE IF NOT EXISTS drive_grants(file_id TEXT NOT NULL REFERENCES library(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id),role TEXT NOT NULL,PRIMARY KEY(file_id,user_id));
          CREATE TABLE IF NOT EXISTS drive_favorites(user_id TEXT NOT NULL REFERENCES users(id),file_id TEXT NOT NULL REFERENCES library(id) ON DELETE CASCADE,PRIMARY KEY(user_id,file_id));
          CREATE TABLE IF NOT EXISTS drive_events(id INTEGER PRIMARY KEY,organization TEXT NOT NULL,file_id TEXT,actor TEXT NOT NULL,action TEXT NOT NULL,created REAL NOT NULL,detail TEXT NOT NULL DEFAULT '');
          CREATE TABLE IF NOT EXISTS drive_links(id TEXT PRIMARY KEY,file_id TEXT NOT NULL REFERENCES library(id) ON DELETE CASCADE,token_hash TEXT NOT NULL UNIQUE,audience TEXT NOT NULL,role TEXT NOT NULL,expires REAL NOT NULL,created REAL NOT NULL,revoked INTEGER NOT NULL DEFAULT 0);
          CREATE TABLE IF NOT EXISTS drive_link_visits(link_id TEXT NOT NULL REFERENCES drive_links(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id),PRIMARY KEY(link_id,user_id));
        """)
        drive_workspaces.initialize(self.db)
        self.ensure_default()

    def ensure_default(self):
        self.db.execute(
            "INSERT OR IGNORE INTO drive_organizations VALUES ('default',?,?)",
            (self.store.settings()["name"], time.time()),
        )
        self.db.execute(
            "INSERT OR IGNORE INTO drive_workspaces VALUES ('shared','default',?,?)",
            (self.store.settings()["name"], time.time()),
        )
        for user in self.db.execute(
            "SELECT id,role FROM users WHERE role!='service' AND id NOT IN (SELECT user_id FROM drive_enrolled)"
        ).fetchall():
            self.db.execute(
                "INSERT OR IGNORE INTO drive_members VALUES ('default',?,?)",
                (user["id"], "owner" if user["role"] == "admin" else "member"),
            )
            self.db.execute(
                "INSERT OR IGNORE INTO drive_workspace_members VALUES ('shared',?,'viewer')",
                (user["id"],),
            )
            self.db.execute("INSERT INTO drive_enrolled VALUES (?)", (user["id"],))
        # Preserve existing IDs, bytes, named versions and legacy read-only sharing.
        self.db.execute(
            "INSERT OR IGNORE INTO drive_locations SELECT id,'default',CASE WHEN scope='workspace' THEN 'shared' ELSE NULL END FROM library"
        )
        drive_workspaces.ensure_defaults(self.db)
        self.db.commit()

    def membership(self, uid, organization):
        row = self.db.execute(
            "SELECT role FROM drive_members WHERE user_id=? AND organization=?",
            (uid, organization),
        ).fetchone()
        return row[0] if row else None

    def require_org(self, uid, organization, manage=False):
        role = self.membership(uid, organization)
        if not role or (manage and role != "owner"):
            raise Problem(403, "You do not have permission in this organization.")

    def location(self, row):
        found = self.db.execute(
            "SELECT organization,workspace FROM drive_locations WHERE file_id=?",
            (row["id"],),
        ).fetchone()
        return (
            dict(found)
            if found
            else {
                "organization": "default",
                "workspace": "shared" if row["scope"] == "workspace" else None,
            }
        )

    def workspace_role(self, uid, workspace):
        row = self.db.execute(
            "SELECT * FROM drive_workspaces WHERE id=?", (workspace,)
        ).fetchone()
        if not row or not self.membership(uid, row["organization"]):
            return None
        if self.membership(uid, row["organization"]) == "owner":
            return "owner"
        member = self.db.execute(
            "SELECT role FROM drive_workspace_members WHERE workspace=? AND user_id=?",
            (workspace, uid),
        ).fetchone()
        return member[0] if member else "viewer" if workspace != "shared" and drive_workspaces.is_default(self.db, workspace) else None

    def role(self, row, uid, include_trash=False):
        if row is None:
            return None
        place = self.location(row)
        if not self.membership(uid, place["organization"]):
            return None
        if row["trashed"] and not include_trash:
            return None
        # Default shared library preserves its legacy owner-only writes.
        workspace = place["workspace"]
        role = self.workspace_role(uid, workspace) if workspace else None
        if workspace == "shared" and role == "owner" and row["owner"] != uid:
            role = "viewer"
        if row["owner"] == uid and (not workspace or role):
            role = "owner" if not workspace or workspace == "shared" else role
        cursor, seen = row, set()
        while cursor and cursor["id"] not in seen:
            seen.add(cursor["id"])
            if cursor["trashed"] and not include_trash:
                return None
            if cursor["owner"] == uid and not workspace:
                role = "owner"
            grant = self.db.execute(
                "SELECT role FROM drive_grants WHERE file_id=? AND user_id=?",
                (cursor["id"], uid),
            ).fetchone()
            if grant and ROLES[grant[0]] > ROLES.get(role, 0):
                role = grant[0]
            for link in self.db.execute(
                "SELECT l.role FROM drive_links l JOIN drive_link_visits v ON l.id=v.link_id WHERE l.file_id=? AND v.user_id=? AND l.revoked=0 AND l.expires>?",
                (cursor["id"], uid, time.time()),
            ):
                if ROLES[link[0]] > ROLES.get(role, 0):
                    role = link[0]
            cursor = (
                self.db.execute(
                    "SELECT * FROM library WHERE id=?", (cursor["parent"],)
                ).fetchone()
                if cursor["parent"]
                else None
            )
        return role

    def require(self, row, uid, role="viewer", include_trash=False):
        actual = self.role(row, uid, include_trash)
        if ROLES.get(actual, 0) < ROLES[role]:
            raise Problem(404, "File not found, or access is unavailable.")
        return actual

    def destination(self, uid, data):
        if data.get("scope", "personal") not in ("personal", "workspace"):
            raise Problem(400, "Choose a valid file location.")
        organization = data.get("organization") or "default"
        workspace = data.get("workspace") or (
            "shared" if data.get("scope") == "workspace" else None
        )
        parent = data.get("parent") or None
        self.require_org(uid, organization)
        if parent:
            folder = self.db.execute(
                "SELECT * FROM library WHERE id=? AND kind='folder' AND trashed=0",
                (parent,),
            ).fetchone()
            if not folder:
                raise Problem(404, "Destination folder not found.")
            self.require(folder, uid, "editor")
            place = self.location(folder)
            if "scope" in data and data["scope"] != folder["scope"]:
                raise Problem(400, "Choose a folder in the same location.")
            organization, workspace = place["organization"], place["workspace"]
        elif workspace:
            found = self.db.execute(
                "SELECT organization FROM drive_workspaces WHERE id=?", (workspace,)
            ).fetchone()
            if (
                not found
                or found[0] != organization
                or ROLES.get(self.workspace_role(uid, workspace), 0) < 2
            ):
                # Legacy workspace allowed every organization member to create their own files.
                if workspace != "shared" or organization != "default":
                    raise Problem(403, "You cannot add files to this workspace.")
        return {
            "organization": organization,
            "workspace": workspace,
            "parent": parent,
            "scope": "workspace" if workspace else "personal",
        }

    def place(self, file_id, destination):
        self.db.execute(
            "INSERT OR REPLACE INTO drive_locations VALUES (?,?,?)",
            (file_id, destination["organization"], destination["workspace"]),
        )

    def event(self, uid, organization, action, file_id=None, detail=""):
        self.db.execute(
            "INSERT INTO drive_events(organization,file_id,actor,action,created,detail) VALUES (?,?,?,?,?,?)",
            (organization, file_id, uid, action, time.time(), detail),
        )

    def context(self, uid):
        self.ensure_default()
        return {
            "organizations": [
                dict(row)
                for row in self.db.execute(
                    "SELECT o.*,m.role FROM drive_organizations o JOIN drive_members m ON o.id=m.organization WHERE m.user_id=? ORDER BY o.created",
                    (uid,),
                )
            ],
            "workspaces": drive_workspaces.directory(self, uid),
        }

    def administration(self, user):
        if user["role"] != "admin":
            raise Problem(403, "Administrator access required.")
        self.ensure_default()
        return {
            "capabilities": {"workspace_icons": True},
            "organizations": [dict(row) | {"role": "owner"} for row in self.db.execute("SELECT * FROM drive_organizations ORDER BY name")],
            "workspaces": [dict(row) | {"role": "owner", "icon": drive_workspaces.icon_for(self.db, row["id"])} for row in self.db.execute("SELECT w.*, CASE WHEN d.workspace IS NULL THEN 0 ELSE 1 END is_default FROM drive_workspaces w LEFT JOIN drive_org_workspaces d ON d.workspace=w.id ORDER BY w.name")],
            "user": {"id": user["id"], "username": user["username"], "name": user["full_name"] or user["username"], "admin": True},
            "apps": [],
        }

    def manage(self, action, user, data):
        uid, organization = user["id"], data.get("organization", "default")
        if action in ("workspace_open", "workspace_favorite"):
            return drive_workspaces.preference(self, action, user, data)
        if action != "members" and user["role"] != "admin":
            raise Problem(403, "Manage organizations and workspaces in the Admin Center.")
        if action != "organization_create" and user["role"] == "admin":
            if not self.db.execute("SELECT 1 FROM drive_organizations WHERE id=?", (organization,)).fetchone():
                raise Problem(404, "Organization not found.")
        if action == "workspace_icon":
            workspace = data.get("workspace")
            if not self.db.execute("SELECT 1 FROM drive_workspaces WHERE id=? AND organization=?", (workspace, organization)).fetchone():
                raise Problem(404, "Workspace not found.")
            drive_workspaces.set_icon(self.db, workspace, data.get("icon"))
            self.db.commit()
            return {"ok": True}
        name = data.get("name", "")
        if action in ("organization_create", "workspace_create"):
            if not isinstance(name, str) or not 1 <= len(name.strip()) <= 80:
                raise Problem(400, "Enter a name of 1–80 characters.")
            icon = drive_workspaces.validate_icon(data.get("icon"))
            ident = secrets.token_hex(12)
            if action == "organization_create":
                if user["role"] != "admin":
                    raise Problem(
                        403, "A server administrator must create an organization."
                    )
                self.db.execute(
                    "INSERT INTO drive_organizations VALUES (?,?,?)",
                    (ident, name.strip(), time.time()),
                )
                self.db.execute(
                    "INSERT INTO drive_members VALUES (?,?,'owner')", (ident, uid)
                )
            else:
                # Administrative access does not grant access to file contents.
                self.db.execute(
                    "INSERT INTO drive_workspaces VALUES (?,?,?,?)",
                    (ident, organization, name.strip(), time.time()),
                )
                self.db.execute(
                    "INSERT INTO drive_workspace_members VALUES (?,?,'owner')",
                    (ident, uid),
                )
            if action == "workspace_create":
                drive_workspaces.set_icon(self.db, ident, icon)
            drive_workspaces.ensure_defaults(self.db)
            self.db.commit()
            return {"id": ident, **self.context(uid)}
        if user["role"] != "admin":
            self.require_org(uid, organization, manage=action != "members")
        if action == "members":
            workspace = data.get("workspace")
            if workspace:
                location = self.db.execute(
                    "SELECT organization FROM drive_workspaces WHERE id=?", (workspace,)
                ).fetchone()
                if (
                    not location
                    or location[0] != organization
                    or (user["role"] != "admin" and not self.workspace_role(uid, workspace))
                ):
                    raise Problem(404, "Workspace not found.")
            members = [
                dict(row)
                for row in self.db.execute(
                    "SELECT u.id,u.username,COALESCE(NULLIF(u.full_name,''),u.username) name,m.role FROM users u JOIN drive_members m ON u.id=m.user_id WHERE m.organization=? AND u.active=1 ORDER BY name",
                    (organization,),
                )
            ]
            if workspace:
                for member in members:
                    member["workspace_role"] = self.workspace_role(
                        member["id"], workspace
                    )
            return {"members": members}
        target = self.db.execute(
            "SELECT * FROM users WHERE id=? OR username=?",
            (data.get("user"), data.get("user")),
        ).fetchone()
        if not target or not target["active"] or target["role"] == "service":
            raise Problem(400, "Choose an active Studio user.")
        workspace, role = data.get("workspace"), data.get("role")
        table, column, ident = (
            ("drive_workspace_members", "workspace", workspace)
            if workspace
            else ("drive_members", "organization", organization)
        )
        if workspace:
            row = self.db.execute(
                "SELECT organization FROM drive_workspaces WHERE id=?", (workspace,)
            ).fetchone()
            if not row or row[0] != organization:
                raise Problem(404, "Workspace not found.")
            self.require_org(target["id"], organization)
        allowed = (
            ("owner", "editor", "viewer", "remove")
            if workspace
            else ("owner", "member", "remove")
        )
        if role not in allowed:
            raise Problem(400, "Choose a valid member role.")
        previous = self.db.execute(
            f"SELECT role FROM {table} WHERE {column}=? AND user_id=?",
            (ident, target["id"]),
        ).fetchone()
        if (
            previous
            and previous[0] == "owner"
            and role != "owner"
            and self.db.execute(
                f"SELECT count(*) FROM {table} WHERE {column}=? AND role='owner'",
                (ident,),
            ).fetchone()[0]
            == 1
        ):
            raise Problem(409, "Keep at least one owner.")
        self.db.execute(
            f"DELETE FROM {table} WHERE {column}=? AND user_id=?", (ident, target["id"])
        )
        if role != "remove":
            self.db.execute(
                f"INSERT INTO {table} VALUES (?,?,?)", (ident, target["id"], role)
            )
        if role == "remove" and not workspace:
            self.db.execute(
                "DELETE FROM drive_workspace_members WHERE user_id=? AND workspace IN (SELECT id FROM drive_workspaces WHERE organization=?)",
                (target["id"], organization),
            )
            self.db.execute(
                "DELETE FROM drive_grants WHERE user_id=? AND file_id IN (SELECT file_id FROM drive_locations WHERE organization=?)",
                (target["id"], organization),
            )
            self.db.execute(
                "DELETE FROM drive_link_visits WHERE user_id=? AND link_id IN (SELECT l.id FROM drive_links l JOIN drive_locations d ON l.file_id=d.file_id WHERE d.organization=?)",
                (target["id"], organization),
            )
        self.event(uid, organization, "membership_changed", detail=target["username"])
        self.db.commit()
        return {"ok": True}

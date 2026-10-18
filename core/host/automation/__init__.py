"""User-delegated app access for scripts and external agents, separate from chat."""

import json
import secrets
import time

from ..state import Problem
from .commands import catalog, execute, validate

PREFIX = "aether_agent_"


class Automation:
    def __init__(self, host):
        self.host, self.store = host, host.store
        self.db = self.store.db
        self.db.execute("""CREATE TABLE IF NOT EXISTS automation_grants (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
            label TEXT NOT NULL, token_hash TEXT UNIQUE NOT NULL, apps TEXT NOT NULL,
            can_write INTEGER NOT NULL, created REAL NOT NULL, expires REAL NOT NULL,
            revoked INTEGER NOT NULL DEFAULT 0)""")
        if "can_edit_content" not in {
            row[1] for row in self.db.execute("PRAGMA table_info(automation_grants)")
        }:
            self.db.execute(
                "ALTER TABLE automation_grants ADD COLUMN can_edit_content INTEGER NOT NULL DEFAULT 0"
            )
        self.db.commit()

    def available(self, user):
        return [
            app
            for app in self.host.apps(user)
            if app["id"] != "ui" and app["enabled"] and app["installed"]
        ]

    @staticmethod
    def public(row):
        return {
            "id": row["id"],
            "label": row["label"],
            "apps": json.loads(row["apps"]),
            "can_write": bool(row["can_write"]),
            "can_edit_content": bool(row["can_edit_content"]),
            "created": row["created"],
            "expires": row["expires"],
            "active": not row["revoked"] and row["expires"] > time.time(),
        }

    def manage(self, action, user, data):
        if action == "list":
            return {
                "connections": [
                    self.public(row)
                    for row in self.db.execute(
                        "SELECT * FROM automation_grants WHERE user_id=? ORDER BY created DESC",
                        (user["id"],),
                    )
                ],
                "apps": [
                    {"id": app["id"], "name": app["name"]}
                    for app in self.available(user)
                ],
            }
        if action == "create":
            label, apps = data.get("label"), data.get("apps")
            writes, lifetime = (
                data.get("can_write", False),
                data.get("lifetime_hours", 24),
            )
            if not isinstance(label, str) or not 1 <= len(label.strip()) <= 80:
                raise Problem(400, "Give this connection a name of 1–80 characters.")
            edits = data.get("can_edit_content", False)
            known = {app["id"] for app in self.available(user)}
            if (
                not isinstance(apps, list)
                or not apps
                or any(not isinstance(app, str) or app not in known for app in apps)
            ):
                raise Problem(400, "Choose applications available to your account.")
            if (
                type(writes) is not bool
                or type(edits) is not bool
                or edits
                and not writes
                or type(lifetime) is not int
                or not 1 <= lifetime <= 168
            ):
                raise Problem(
                    400, "Choose read or edit access and an expiry within seven days."
                )
            ident, secret, now = (
                secrets.token_hex(16),
                PREFIX + secrets.token_urlsafe(32),
                time.time(),
            )
            self.db.execute(
                "INSERT INTO automation_grants (id,user_id,label,token_hash,apps,can_write,created,expires,can_edit_content) VALUES (?,?,?,?,?,?,?,?,?)",
                (
                    ident,
                    user["id"],
                    label.strip(),
                    self.store.token_hash(secret),
                    json.dumps(sorted(set(apps))),
                    int(writes),
                    now,
                    now + lifetime * 3600,
                    int(edits),
                ),
            )
            self.store.audit(user["username"], "automation_connected", ident)
            row = self.db.execute(
                "SELECT * FROM automation_grants WHERE id=?", (ident,)
            ).fetchone()
            return {"connection": self.public(row), "token": secret}
        if action == "revoke":
            cursor = self.db.execute(
                "UPDATE automation_grants SET revoked=1 WHERE id=? AND user_id=?",
                (data.get("id"), user["id"]),
            )
            if not cursor.rowcount:
                raise Problem(404, "Connection not found.")
            self.store.audit(user["username"], "automation_revoked", data["id"])
            return {"ok": True}
        raise Problem(404, "Unknown connection action.")

    def authorize(self, token):
        row = self.db.execute(
            "SELECT * FROM automation_grants WHERE token_hash=? AND revoked=0 AND expires>?",
            (self.store.token_hash(token), time.time()),
        ).fetchone()
        if not row:
            raise Problem(
                401,
                "Agent connection expired or was revoked. Create a new connection in Studio.",
            )
        user = self.db.execute(
            "SELECT id,username,role,active,must_change FROM users WHERE id=?",
            (row["user_id"],),
        ).fetchone()
        if not user or not user["active"] or user["must_change"]:
            raise Problem(401, "The connection's account is unavailable.")
        return dict(user), row

    def dispatch(self, path, data, token):
        if path.startswith("connections/"):
            if token.startswith(PREFIX):
                raise Problem(403, "Agents cannot create or manage connections.")
            user = self.host.require_user(token)
            if user["role"] == "service":
                raise Problem(403, "Use a personal account to manage connections.")
            return self.manage(path.split("/", 1)[1], user, data)
        if not token.startswith(PREFIX):
            raise Problem(401, "Use an agent connection for command access.")
        user, grant = self.authorize(token)
        allowed = set(json.loads(grant["apps"])) & {
            app["id"] for app in self.available(user)
        }
        commands = catalog(self.host)
        if path == "commands/list":
            return {
                "schema_version": 1,
                "apps": sorted(allowed),
                "commands": [
                    command.public()
                    for command in commands
                    if allowed
                    and (command.app is None or command.app in allowed)
                    and (not command.writes or grant["can_write"])
                    and (
                        not (command.app and command.writes)
                        or grant["can_edit_content"]
                    )
                ],
            }
        if path != "commands/run":
            raise Problem(404, "Unknown automation action.")
        command = next((c for c in commands if c.id == data.get("id")), None)
        if not command:
            raise Problem(404, "Unknown command. Read the command catalog first.")
        arguments = data.get("arguments", {})
        validate(arguments, command.input_schema)
        if (
            arguments["app"] not in allowed
            or (command.app and command.app != arguments["app"])
            or (
                command.writes
                and (
                    not grant["can_write"]
                    or command.app
                    and not grant["can_edit_content"]
                )
            )
        ):
            raise Problem(403, "This command is outside the connection's permissions.")
        self.host.require_app(arguments["app"], user)
        try:
            result = execute(self.host, user, command, arguments)
        except Problem:
            self.store.audit(
                user["username"],
                "automation_command_refused",
                f"{grant['id']}:{command.id}",
            )
            raise
        self.store.audit(
            user["username"], "automation_command", f"{grant['id']}:{command.id}"
        )
        return {"command": command.id, "result": result}

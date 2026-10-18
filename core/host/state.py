"""Persistent local accounts, sessions, settings, and administrative audit trail."""

from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import sqlite3
import time
from pathlib import Path


class Problem(Exception):
    """A refusal the client is meant to act on. `detail` carries structured
    data when the message alone is not enough to act — a merge conflict names
    both heads and what differs, so the client can offer a resolution."""

    def __init__(self, status: int, message: str, detail: dict | None = None):
        super().__init__(status, message, detail)
        self.status, self.message, self.detail = status, message, detail


def password_hash(password: str, salt: str | None = None) -> str:
    if not isinstance(password, str) or not 12 <= len(password) <= 256:
        raise Problem(400, "Use a password between 12 and 256 characters.")
    salt = salt or secrets.token_hex(16)
    digest = hashlib.scrypt(
        password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1
    )
    return f"{salt}:{digest.hex()}"


def password_matches(password: str, stored: str) -> bool:
    try:
        return hmac.compare_digest(
            password_hash(password, stored.split(":")[0]), stored
        )
    except (Problem, ValueError, TypeError):
        return False


DEFAULT_SETTINGS = {
    "name": "Aether Studio",
    "bind_address": "127.0.0.1",
    "port": 8780,
    "public_url": "http://localhost:8780",
    "tls_cert": "",
    "tls_key": "",
    "theme": {"base": "aether-default", "apps": {}},
}


class Store:
    def __init__(self, directory: Path):
        self.directory = directory
        directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        directory.chmod(0o700)
        self.db = sqlite3.connect(directory / "studio.sqlite3", check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        # Team-scale concurrency: WAL lets readers proceed during writes and
        # busy_timeout absorbs short contention across handler threads.
        self.db.executescript(
            "PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA busy_timeout=5000;"
        )
        self.db.executescript("""
            PRAGMA foreign_keys=ON;
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL, role TEXT NOT NULL,
                active INTEGER NOT NULL DEFAULT 1, must_change INTEGER NOT NULL DEFAULT 0);
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id),
                expires REAL NOT NULL, created REAL NOT NULL);
            CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS applications (id TEXT PRIMARY KEY, enabled INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS audit (
                id INTEGER PRIMARY KEY, time REAL NOT NULL, actor TEXT NOT NULL,
                action TEXT NOT NULL, target TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS teams (id TEXT PRIMARY KEY, name TEXT UNIQUE, members TEXT, apps TEXT);
            CREATE TABLE IF NOT EXISTS app_access (id TEXT PRIMARY KEY, restricted INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS services (id TEXT PRIMARY KEY, name TEXT UNIQUE, token TEXT, apps TEXT, expires REAL, active INTEGER);
            CREATE TABLE IF NOT EXISTS setup_sessions (token TEXT PRIMARY KEY, expires REAL NOT NULL);
            CREATE TABLE IF NOT EXISTS recovery_tokens (token TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), expires REAL NOT NULL);
            CREATE TABLE IF NOT EXISTS attempts (key TEXT PRIMARY KEY, count INTEGER, until REAL);
        """)
        columns = {row[1] for row in self.db.execute("PRAGMA table_info(users)")}
        for name, definition in [
            ("full_name", "TEXT NOT NULL DEFAULT ''"),
            ("email", "TEXT NOT NULL DEFAULT ''"),
            ("email_verified", "INTEGER NOT NULL DEFAULT 0"),
            ("theme", "TEXT NOT NULL DEFAULT 'dark'"),
            ("avatar", "TEXT NOT NULL DEFAULT ''"),
            ("theme_id", "TEXT NOT NULL DEFAULT ''"),
        ]:
            if name not in columns:
                self.db.execute(f"ALTER TABLE users ADD COLUMN {name} {definition}")
        self.db.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS users_email ON users(email) WHERE email <> ''"
        )
        for key, value in DEFAULT_SETTINGS.items():
            self.db.execute(
                "INSERT OR IGNORE INTO settings VALUES (?,?)", (key, json.dumps(value))
            )
        self.db.commit()
        (directory / "studio.sqlite3").chmod(0o600)
        self.setup_path = directory / "setup-token"
        if not self.ready() and not self.setup_path.exists():
            self.setup_path.write_text(secrets.token_urlsafe(32))
            self.setup_path.chmod(0o600)
        self.dummy_hash = password_hash(secrets.token_urlsafe(24))

    def seed_applications(self, ids):
        """Register the installed applications. The host's package registry is
        the single source of truth for what exists; this only ever adds rows,
        so an app disabled by an administrator stays disabled."""
        for app in ids:
            self.db.execute("INSERT OR IGNORE INTO applications VALUES (?,1)", (app,))
            self.db.execute("INSERT OR IGNORE INTO app_access VALUES (?,0)", (app,))
        self.db.commit()

    def ready(self):
        return self.db.execute("SELECT 1 FROM users LIMIT 1").fetchone() is not None

    def settings(self):
        return {
            r["key"]: json.loads(r["value"])
            for r in self.db.execute("SELECT * FROM settings")
        }

    def audit(self, actor, action, target=""):
        self.db.execute(
            "INSERT INTO audit(time,actor,action,target) VALUES (?,?,?,?)",
            (time.time(), actor, action, target),
        )
        self.db.commit()

    def users(self):
        return [
            dict(r)
            for r in self.db.execute(
                "SELECT id,username,full_name,email,email_verified,role,active,must_change FROM users ORDER BY username"
            )
        ]

    def create_user(
        self,
        username,
        password,
        role="member",
        must_change=True,
        commit=True,
        full_name="",
        email="",
    ):
        if (
            not isinstance(username, str)
            or not username.isascii()
            or not username.replace("-", "").replace("_", "").replace(".", "").isalnum()
            or not 2 <= len(username) <= 64
        ):
            raise Problem(
                400,
                "Username must be 2–64 letters, numbers, dots, dashes or underscores.",
            )
        if role not in ("admin", "member"):
            raise Problem(400, "Choose Administrator or Member.")
        digest = password_hash(password)
        uid = secrets.token_hex(16)
        try:
            self.db.execute(
                "INSERT INTO users(id,username,password,role,active,must_change,full_name,email) VALUES (?,?,?,?,1,?,?,?)",
                (
                    uid,
                    username.lower(),
                    digest,
                    role,
                    int(must_change),
                    full_name,
                    email.lower(),
                ),
            )
            if commit:
                self.db.commit()
        except sqlite3.IntegrityError:
            self.db.rollback()
            raise Problem(
                409, "That username or email address already exists."
            ) from None
        return uid

    def sign_in(self, username, password, address):
        username = str(username).strip().lower()[:254]
        now = time.time()
        # Loopback is every local user's address, so counting failures against
        # it would let ten bad attempts lock out the whole installation.
        shared_address = address in {"127.0.0.1", "::1", "localhost"}
        keys = ["user:" + username] if shared_address else ["ip:" + address, "user:" + username]
        for key in keys:
            attempt = self.db.execute(
                "SELECT * FROM attempts WHERE key=?", (key,)
            ).fetchone()
            if attempt and attempt["count"] >= 10 and attempt["until"] > now:
                raise Problem(
                    429, "Too many sign-in attempts. Try again in 15 minutes."
                )
        user = self.db.execute(
            "SELECT * FROM users WHERE username=? OR (email<>'' AND email=?)",
            (username, username),
        ).fetchone()
        valid = password_matches(
            password, user["password"] if user else self.dummy_hash
        )
        if not valid or not user or not user["active"]:
            for key in keys:
                self.db.execute(
                    """INSERT INTO attempts VALUES (?,1,?) ON CONFLICT(key)
                    DO UPDATE SET count=CASE WHEN until < ? THEN 1 ELSE count+1 END, until=?""",
                    (key, now + 900, now, now + 900),
                )
            self.audit(username, "sign_in_failed")
            raise Problem(401, "Username or password is incorrect.")
        # Clear every counter this sign-in was throttled by, not just the user
        # one — otherwise the address bucket keeps climbing to a lockout.
        for key in keys:
            self.db.execute("DELETE FROM attempts WHERE key=?", (key,))
        self.db.execute("DELETE FROM sessions WHERE expires<?", (now,))
        token = secrets.token_urlsafe(32)
        self.db.execute(
            "INSERT INTO sessions VALUES (?,?,?,?)",
            (self.token_hash(token), user["id"], now + 43200, now),
        )
        self.audit(username, "sign_in")
        return token

    @staticmethod
    def token_hash(token):
        return hashlib.sha256(token.encode()).hexdigest()

    def user_for(self, token):
        if token.startswith("aether_sa_"):
            service = self.db.execute(
                "SELECT * FROM services WHERE token=? AND active=1 AND expires>?",
                (self.token_hash(token), time.time()),
            ).fetchone()
            if service:
                return {
                    "id": "svc-" + service["id"],
                    "username": service["name"],
                    "role": "service",
                    "active": True,
                    "must_change": False,
                    "apps": json.loads(service["apps"]),
                }
            return None
        row = self.db.execute(
            """SELECT u.id,u.username,u.full_name,u.email,u.email_verified,u.theme,u.theme_id,u.avatar,u.role,u.active,u.must_change
            FROM users u JOIN sessions s ON s.user_id=u.id
            WHERE s.token=? AND s.expires>? AND u.active=1""",
            (self.token_hash(token), time.time()),
        ).fetchone()
        return dict(row) if row else None

    def revoke(self, uid):
        self.db.execute("DELETE FROM sessions WHERE user_id=?", (uid,))
        if self.db.execute("SELECT 1 FROM sqlite_master WHERE name='automation_grants' AND type='table'").fetchone():
            self.db.execute("UPDATE automation_grants SET revoked=1 WHERE user_id=?", (uid,))
        self.db.commit()

    def reset_password(self, uid, password, must_change=True):
        self.db.execute(
            "UPDATE users SET password=?, must_change=? WHERE id=?",
            (password_hash(password), int(must_change), uid),
        )
        self.db.execute("DELETE FROM recovery_tokens WHERE user_id=?", (uid,))
        self.revoke(uid)

    def setup_authorized(self, token):
        return (
            not self.ready()
            and self.db.execute(
                "SELECT 1 FROM setup_sessions WHERE token=? AND expires>?",
                (self.token_hash(token), time.time()),
            ).fetchone()
            is not None
        )

    def authorize_setup(self, code):
        if (
            self.ready()
            or not self.setup_path.exists()
            or not hmac.compare_digest(str(code), self.setup_path.read_text().strip())
        ):
            raise Problem(
                403, "Reopen Aether Studio on the host to authorize first-time setup."
            )
        token = secrets.token_urlsafe(32)
        self.db.execute("DELETE FROM setup_sessions WHERE expires<?", (time.time(),))
        self.db.execute(
            "INSERT INTO setup_sessions VALUES (?,?)",
            (self.token_hash(token), time.time() + 3600),
        )
        self.db.commit()
        return token

    def update_identity(self, uid, full_name, email):
        try:
            old = self.db.execute(
                "SELECT email FROM users WHERE id=?", (uid,)
            ).fetchone()
            self.db.execute(
                "UPDATE users SET full_name=?,email=?,email_verified=CASE WHEN email=? THEN email_verified ELSE 0 END WHERE id=?",
                (full_name, email, email, uid),
            )
            if old and old[0] != email:
                self.db.execute("DELETE FROM recovery_tokens WHERE user_id=?", (uid,))
            self.db.commit()
        except sqlite3.IntegrityError:
            self.db.rollback()
            raise Problem(
                409, "That email address already belongs to another account."
            ) from None

    def throttle_recovery(self, key, maximum):
        now = time.time()
        row = self.db.execute("SELECT * FROM attempts WHERE key=?", (key,)).fetchone()
        if row and row["until"] > now and row["count"] >= maximum:
            return False
        self.db.execute(
            "INSERT INTO attempts VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN until<? THEN 1 ELSE count+1 END,until=CASE WHEN until<? THEN excluded.until ELSE until END",
            (key, now + 900, now, now),
        )
        self.db.commit()
        return True

    def recovery_token(self, uid):
        token = secrets.token_urlsafe(32)
        self.db.execute(
            "DELETE FROM recovery_tokens WHERE user_id=? OR expires<?",
            (uid, time.time()),
        )
        self.db.execute(
            "INSERT INTO recovery_tokens VALUES (?,?,?)",
            (self.token_hash(token), uid, time.time() + 1800),
        )
        self.db.commit()
        return token

    def recover_password(self, token, password):
        user = self.db.execute(
            "SELECT u.* FROM users u JOIN recovery_tokens r ON r.user_id=u.id WHERE r.token=? AND r.expires>? AND u.active=1",
            (self.token_hash(str(token)), time.time()),
        ).fetchone()
        if not user:
            raise Problem(
                400,
                "This reset link has expired or already been used. Request a new link.",
            )
        self.reset_password(user["id"], password, False)
        self.db.execute("UPDATE users SET email_verified=1 WHERE id=?", (user["id"],))
        self.audit(user["username"], "password_recovered")
        return dict(user)

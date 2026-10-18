"""Offline operator bridge from a read-only demo snapshot to empty native storage.

Not a production server dependency. A complete private SQLite/assets recovery copy
is retained; unsupported live semantics fail closed, never silently broaden access.
"""
import argparse
import base64
import binascii
import contextlib
import hashlib
import json
import math
import os
import re
import sqlite3
import subprocess
import tempfile
import time
from pathlib import Path

if __package__:
    from . import legacy_map
else:
    import legacy_map

ROOT = Path(__file__).resolve().parents[2]
ID = re.compile(r"[A-Za-z0-9_.:-]{1,128}\Z")
DIGEST = re.compile(r"[a-f0-9]{64}\Z")
MAX_DATABASE = 256 * 1024 * 1024
# These records require native semantics that have not been implemented yet.
UNSUPPORTED = (
    "services",
    "drive_uploads",
)


class TransferError(Exception):
    pass


def require(ok, message):
    if not ok:
        raise TransferError(message)


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, "Duplicate Map ownership filename.")
        result[key] = value
    return result


def digest(data):
    return hashlib.sha256(data).hexdigest()


def encoded(data):
    return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def private_write(path, data):
    missing = []
    parent = path.parent
    while not parent.exists():
        missing.append(parent)
        parent = parent.parent
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    for directory in missing:
        directory.chmod(0o700)
    with path.open("xb") as stream:
        os.chmod(path, 0o600)
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())


def sync_tree(root):
    for path in [p for p in root.rglob("*") if p.is_dir()] + [root]:
        fd = os.open(path, os.O_RDONLY)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)


def read_db(path):
    require(not path.is_symlink() and path.is_file(), "Expected a regular SQLite snapshot.")
    require(path.stat().st_size <= MAX_DATABASE, "Snapshot exceeds the qualified size limit.")
    db = sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    require(db.execute("PRAGMA integrity_check").fetchone()[0] == "ok", "SQLite integrity failure.")
    require(not db.execute("PRAGMA foreign_key_check").fetchall(), "SQLite reference integrity failure.")
    return db


def rows(db, table):
    # Identifier must come from our fixed schema catalog, never user input.
    require(re.fullmatch(r"[a-z_]+", table), "Invalid schema identifier.")
    return [dict(r) for r in db.execute(f'SELECT * FROM "{table}"')]


def user_preferences(user):
    values = {key: user.get(key, default) for key, default in (("theme", "dark"), ("theme_id", ""), ("avatar", ""))}
    require(values["theme"] in ("dark", "light", "system"), "Unsupported account appearance.")
    require(isinstance(values["theme_id"], str) and "\0" not in values["theme_id"] and len(values["theme_id"]) <= 64,
            "Invalid account theme identifier.")
    avatar = values["avatar"]
    require(isinstance(avatar, str) and len(avatar.encode()) <= 350000, "Invalid account avatar.")
    if avatar:
        try:
            prefix, encoded = avatar.split(",", 1)
            raw = base64.b64decode(encoded, validate=True)
            require(base64.b64encode(raw).decode() == encoded, "Noncanonical avatar encoding.")
            require(len(raw) <= 262144 and (
                (prefix == "data:image/png;base64" and raw.startswith(b"\x89PNG\r\n\x1a\n")) or
                (prefix == "data:image/jpeg;base64" and raw.startswith(b"\xff\xd8\xff"))), "Invalid account avatar.")
        except (ValueError, binascii.Error):
            raise TransferError("Invalid account avatar.") from None
    return values


def server_presentation(db):
    values = {r["key"]: json.loads(r["value"]) for r in rows(db, "settings") if r["key"] in ("name", "theme")}
    name, theme = values.get("name"), values.get("theme")
    require(isinstance(name, str) and name.strip() and len(name) <= 80 and not any(ord(c) < 32 or 127 <= ord(c) <= 159 for c in name), "Unsupported server name.")
    def token(value):
        return isinstance(value, str) and re.fullmatch(r"[A-Za-z0-9_-]{1,64}", value)
    require(isinstance(theme, dict) and set(theme) == {"base", "apps"} and token(theme["base"]), "Unsupported server theme.")
    require(isinstance(theme["apps"], dict) and all(k in ("studio", "drive", "io", "cad", "animation", "ui", "map", "sketch", "vector") and token(v) for k, v in theme["apps"].items()), "Unsupported application theme.")
    return {"schema": 1, "name": name, "theme": theme}


def branch_graph(db):
    if __package__:
        from .legacy_branches import extract
    else:
        from legacy_branches import extract
    return extract(db, require)


def named_versions(db):
    # Kept outside projection.json so already captured recovery archives stay valid.
    tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    if "library_versions" not in tables:
        return []
    versions = rows(db, "library_versions")
    graph = branch_graph(db)
    if __package__:
        from .legacy_branches import reference
    else:
        from legacy_branches import reference
    users = {r[0] for r in db.execute("SELECT id FROM users")}
    revisions = {(r[0], r[1]) for r in db.execute("SELECT file_id,revision FROM library_history")}
    fields = {"file_id", "name", "revision", "author", "created", "message", "branch",
              "status", "origin", "status_updated", "status_note"}
    counts = {}
    for v in versions:
        require(set(v) == fields, "Unsupported named version fields.")
        require((v["file_id"], v["revision"]) in revisions and v["author"] in users,
                "Invalid named version reference.")
        branch_id = reference(graph, v["file_id"], v["branch"], require, "named version branch")
        if branch_id:
            v["branch_id"] = branch_id
        name = v["name"]
        require(isinstance(name, str) and name == name.strip() and 1 <= len(name) <= 80
                and not any(ord(c) < 32 or 127 <= ord(c) <= 159 for c in name),
                "Invalid named version name.")
        for field in ("message", "status_note"):
            require(isinstance(v[field], str) and len(v[field]) <= 500 and "\0" not in v[field],
                    "Invalid named version text.")
        for field in ("created", "status_updated"):
            require(type(v[field]) in (int, float) and math.isfinite(v[field]) and v[field] >= 0,
                    "Invalid named version time.")
        require(v["status"] in ("version", "candidate", "released", "obsolete")
                and v["origin"] in ("user", "automatic"), "Invalid named version state.")
        counts[v["file_id"]] = counts.get(v["file_id"], 0) + 1
        require(counts[v["file_id"]] <= 1000, "Named versions exceed the qualified listing limit.")
    return sorted(versions, key=lambda v: (v["file_id"], v["name"]))


def collaboration(db):
    if __package__:
        from .legacy_collaboration import extract
    else:
        from legacy_collaboration import extract
    return extract(db, require, branch_graph(db))


def workspace_preferences(db):
    if __package__:
        from .legacy_workspace_preferences import extract
    else:
        from legacy_workspace_preferences import extract
    return extract(db, require)


def file_favorites(db):
    if __package__:
        from .legacy_file_favorites import extract
    else:
        from legacy_file_favorites import extract
    return extract(db, require)


def sharing_provenance(db):
    if __package__:
        from .legacy_sharing import extract
    else:
        from legacy_sharing import extract
    return extract(db, require)


def drive_events(db):
    if __package__:
        from .legacy_drive_events import extract
    else:
        from legacy_drive_events import extract
    return extract(db, require)


def sharing_links(db):
    if __package__:
        from .legacy_links import extract
    else:
        from legacy_links import extract
    return extract(db, require)


def project(db, assets):
    server_presentation(db)  # Validate without changing the frozen snapshot projection.
    named_versions(db)
    collaboration(db)
    workspace_preferences(db)
    file_favorites(db)
    sharing_provenance(db)
    sharing_links(db)
    drive_events(db)
    tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    for table in UNSUPPORTED:
        require(table not in tables or not rows(db, table), f"Unsupported nonempty table: {table}.")
    required = ("users", "applications", "app_access", "teams", "library", "library_history",
                "library_blobs", "library_recents", "drive_organizations", "drive_members",
                "drive_enrolled", "drive_workspaces", "drive_org_workspaces",
                "drive_workspace_members", "drive_locations", "drive_grants", "audit")
    require(set(required) <= tables, "Missing required source schema.")
    data = {table: rows(db, table) for table in required}
    users = {u["id"]: u for u in data["users"]}
    for u in users.values():
        user_preferences(u)
        require(ID.fullmatch(u["id"]) and u["role"] in ("admin", "member"), "Unsupported user identity.")
        require(re.fullmatch(r"[a-f0-9]{32}:[a-f0-9]{128}", u["password"]), "Unsupported credential encoding.")
    blobs = {b["hash"]: bytes(b["content"]) for b in data.pop("library_blobs")}
    owners_file = assets.parent / "map-media-owners.json"
    owners = json.loads(owners_file.read_bytes()) if owners_file.exists() else {}
    legacy_map.media(db, assets, owners, require)
    legacy_map.devices(db, require)

    for sha, content in blobs.items():
        require(DIGEST.fullmatch(sha) and digest(content) == sha, "History content hash mismatch.")
        try:
            descriptor = json.loads(content)
        except (ValueError, UnicodeError):
            continue
        if isinstance(descriptor, dict) and "aether_drive_blob" in descriptor:
            key = descriptor["aether_drive_blob"]
            require(isinstance(key, str) and DIGEST.fullmatch(key), "Invalid attachment key.")
            file = assets / "drive" / "blobs" / key
            require(file.is_file() and not file.is_symlink(), "Missing attachment.")
            require(digest(file.read_bytes()) == key, "Attachment hash mismatch.")
            if "size" in descriptor:
                require(file.stat().st_size == descriptor["size"], "Attachment size mismatch.")
    files = {f["id"]: f for f in data["library"]}
    locations = {r["file_id"]: r for r in data["drive_locations"]}
    require(files.keys() == locations.keys(), "Incomplete file locations.")
    histories = {}
    for h in data["library_history"]:
        require(isinstance(h["note"], str) and len(h["note"]) <= 500 and "\0" not in h["note"], "Invalid history note.")
        require(type(h["saved"]) in (int, float) and math.isfinite(h["saved"]) and 0 <= h["saved"] < 9_223_372_036_854_775, "Invalid history time.")
        require(h["event"] in ("create", "save", "rename", "restore", "merge", "baseline", "document_units") and h["author"] in users,
                "Unsupported history event or author.")
        require(h["blob_hash"] in blobs and h["file_id"] in files, "Dangling history reference.")
        histories.setdefault(h["file_id"], []).append(h)
    branch_graph(db)
    for f in files.values():
        for field in ("created", "modified"):
            require(type(f[field]) in (int, float) and math.isfinite(f[field]) and f[field] >= 0,
                    "Invalid file timestamp.")
        require(ID.fullmatch(f["id"]) and f["owner"] in users, "Invalid file identity/owner.")
        require(f["kind"] in ("folder", "file"), "Unsupported file kind.")
        require(f["scope"] in ("personal", "workspace"), "Unsupported scope.")
        loc = locations[f["id"]]
        require((f["scope"] == "workspace") == bool(loc["workspace"]), "File scope/location mismatch.")
        seen = {f["id"]}
        parent = f["parent"]
        while parent:
            require(parent in files and parent not in seen, "Invalid/cyclic folder ancestry.")
            seen.add(parent)
            p = files[parent]
            require(p["kind"] == "folder", "Non-folder parent.")
            require(locations[parent]["organization"] == loc["organization"]
                    and locations[parent]["workspace"] == loc["workspace"], "Cross-location parent.")
            parent = p["parent"]
        if f["kind"] == "folder":
            require(f["id"] not in histories and not f["content"], "Unexpected folder content/history.")
        else:
            history = sorted(histories.get(f["id"], []), key=lambda r: r["revision"])
            require(history, "Missing document history.")
            head = next(h for h in history if h["revision"] == f["revision"])
            require(bytes(f["content"]) == blobs[head["blob_hash"]] and f["name"] == head["name"],
                    "Current file differs from history head.")
        f["content_sha256"] = digest(bytes(f.pop("content") or b""))
    data["library_history"].sort(key=lambda h: (h["file_id"], h["revision"]))
    return data, blobs


def capture(source, destination, media_owners=None):
    source, destination = source.resolve(), destination.absolute()
    require(source != destination and source not in destination.parents, "Snapshot must be outside the original data directory.")
    require(not destination.exists(), "Snapshot destination already exists.")
    media = source / "map-media"
    require(not media.is_symlink(), "Symlink Map media directory refused.")
    require(not media.exists() or media.is_dir(), "Invalid Map media directory.")
    media_inventory = {p.name for p in media.iterdir()} if media.exists() else set()
    for name in media_inventory:
        path = media / name
        require(legacy_map.media_name(name) and path.is_file() and not path.is_symlink(),
                "Unsupported Map media entry; preserve and resolve it before capture.")
        require(1 <= path.stat().st_size <= legacy_map.MAX_MEDIA, "Map media size is outside native limits.")
    destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    with tempfile.TemporaryDirectory(prefix=".capture-", dir=destination.parent) as temp:
        stage = Path(temp)
        (stage / "assets").mkdir(mode=0o700)
        if media_owners is not None:
            require(not media_owners.is_symlink() and media_owners.is_file(), "Invalid Map ownership file.")
            require(media_owners.stat().st_size <= 1024 * 1024, "Map ownership file is too large.")
            ownership = json.loads(media_owners.read_bytes(), object_pairs_hook=unique_object)
            private_write(stage / "map-media-owners.json", encoded(ownership).encode())
        src = source / "studio.sqlite3"
        require(not src.is_symlink() and src.is_file(), "Missing regular source database.")
        with contextlib.closing(sqlite3.connect(src.as_uri() + "?mode=ro", uri=True)) as incoming, contextlib.closing(sqlite3.connect(stage / "studio.sqlite3")) as outgoing:
            incoming.backup(outgoing)
            outgoing.execute("PRAGMA journal_mode=DELETE")
        os.chmod(stage / "studio.sqlite3", 0o600)
        for area in ("workspaces", "drive/blobs", "map-media"):
            base = source / area
            if not base.exists():
                continue
            require(not base.is_symlink(), "Symlink asset root refused.")
            for path in sorted(base.rglob("*")):
                require(not path.is_symlink(), "Symlink asset refused.")
                if path.is_dir():
                    continue
                require(path.is_file(), "Non-regular asset refused.")
                legacy_map.copy_asset(path, stage / "assets" / path.relative_to(source), require)
        require(media_inventory == ({p.name for p in media.iterdir()} if media.exists() else set()),
                "Map media inventory changed during capture; retry.")
        db = read_db(stage / "studio.sqlite3")
        try:
            data, blobs = project(db, stage / "assets")
            counts = {r[0]: db.execute(f'SELECT count(*) FROM "{r[0]}"').fetchone()[0]
                      for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")
                      if re.fullmatch(r"[a-z_]+", r[0])}
        finally:
            db.close()
        private_write(stage / "projection.json", encoded(data).encode())
        for sha, content in blobs.items():
            private_write(stage / "content" / sha, content)
        manifest = {"format": 1, "captured_unix_seconds": time.time(), "source_tables": counts,
                    "files": {str(p.relative_to(stage)): legacy_map.file_digest(p, require)
                              for p in sorted(stage.rglob("*")) if p.is_file()},
                    "source_remains_authority": True,
                    "archive_only": ["network/TLS server settings", "legacy audit context", "workspace assets"],
                    "native_map_media": True, "native_map_devices": True,
                    "native_preferences": True,
                    "native_server_presentation": True,
                    "native_history_annotations": True,
                    "native_named_versions": True,
                    "native_branch_lineage": True,
                    "native_collaboration": True,
                    "native_workspace_preferences": True,
                    "native_file_favorites": True, "native_grant_provenance": True, "native_drive_events": True,
                    "fresh_login_required": True}
        private_write(stage / "manifest.json", encoded(manifest).encode())
        sync_tree(stage)
        os.rename(stage, destination)
        fd = os.open(destination.parent, os.O_RDONLY)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)
    return manifest


def load(snapshot):
    require(not snapshot.is_symlink(), "Symlink snapshot refused.")
    manifest = json.loads((snapshot / "manifest.json").read_bytes())
    require(manifest["format"] == 1, "Unsupported snapshot format.")
    require(not any(p.is_symlink() for p in snapshot.rglob("*")), "Symlink snapshot member refused.")
    actual = {str(p.relative_to(snapshot)) for p in snapshot.rglob("*") if p.is_file() and p != snapshot / "manifest.json"}
    require(actual == set(manifest["files"]), "Snapshot inventory differs.")
    for name, sha in manifest["files"].items():
        path = snapshot / name
        require(not Path(name).is_absolute() and ".." not in Path(name).parts, "Unsafe snapshot path.")
        require(all(not p.is_symlink() for p in [path, *path.parents]), "Symlink snapshot member refused.")
        require(legacy_map.file_digest(path, require) == sha, "Snapshot content hash mismatch.")
    db = read_db(snapshot / "studio.sqlite3")
    try:
        data, blobs = project(db, snapshot / "assets")
        presentation = server_presentation(db)
        versions = named_versions(db)
        graph = branch_graph(db)
        discussions = collaboration(db)
        navigation = workspace_preferences(db)
        favorites = file_favorites(db)
        sharing = sharing_provenance(db)
        links = sharing_links(db)
        activity = drive_events(db)
        owners_file = snapshot / "map-media-owners.json"
        owners = json.loads(owners_file.read_bytes()) if owners_file.exists() else {}
        map_data = legacy_map.media(db, snapshot / "assets", owners, require)
        map_devices = legacy_map.devices(db, require)
    finally:
        db.close()
    require(json.loads((snapshot / "projection.json").read_bytes()) == data, "Snapshot projection mismatch.")
    require(all((snapshot / "content" / k).read_bytes() == v for k, v in blobs.items()), "Snapshot blob mismatch.")
    data["_server_presentation"] = presentation
    data["_named_versions"] = versions
    data["_branch_graph"] = graph
    data["_collaboration"] = discussions
    data["_workspace_preferences"] = navigation
    data["_file_favorites"] = favorites
    data["_sharing_provenance"] = sharing
    data["_sharing_links"] = links
    data["_drive_events"] = activity
    data["_map_media"] = map_data
    data["_map_devices"] = map_devices
    return data, blobs, manifest


def literal(value):
    if isinstance(value, dict):
        return literal(encoded(value)) + "::jsonb"
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        require(math.isfinite(value), "Invalid numeric value.")
        return str(value)
    require(isinstance(value, str) and "\0" not in value, "Invalid text value.")
    # Hex prevents SQL/psql metacommand injection, including embedded newlines.
    return "convert_from(decode('" + value.encode().hex() + "','hex'),'UTF8')"


def pg(psql, dsn, sql):
    result = subprocess.run([str(psql), "-X", "-qAt", "--set", "ON_ERROR_STOP=1", "--dbname", dsn],
                            input=sql, text=True, capture_output=True, check=False)
    require(result.returncode == 0, "Native database operation failed; transaction rolled back. Details withheld to protect credentials.")
    return result.stdout.strip()


def sql_import(data, tenant):
    require(ID.fullmatch(tenant), "Invalid tenant.")
    statements = ["BEGIN; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s';",
                  "SET LOCAL standard_conforming_strings=on;",
                  "LOCK TABLE aether_settings.presentation IN EXCLUSIVE MODE;"]
    # Offline empty-database import only, not a merge into existing accounts.
    statements.append("""DO $$ DECLARE r record; n bigint; BEGIN
      FOR r IN SELECT table_schema,table_name FROM information_schema.tables
        WHERE table_schema IN ('aether_identity','aether_access','aether_store','aether_settings')
          AND table_name<>'schema_state' AND NOT (table_schema='aether_settings' AND table_name='presentation') LOOP
        EXECUTE format('LOCK TABLE %I.%I IN EXCLUSIVE MODE',r.table_schema,r.table_name);
        EXECUTE format('SELECT count(*) FROM %I.%I',r.table_schema,r.table_name) INTO n;
        IF n<>0 THEN RAISE EXCEPTION 'Destination is not empty'; END IF;
      END LOOP;
      IF (SELECT version FROM aether_identity.schema_state)<>4 OR
         (SELECT version FROM aether_access.schema_state)<>21 OR
         (SELECT version FROM aether_store.schema_state)<>3 OR
         (SELECT version FROM aether_settings.schema_state)<>4 THEN
        RAISE EXCEPTION 'Unsupported destination schema'; END IF;
    END $$;""")
    expected = {"aether_access.automation_receipts": [], "aether_identity.agent_connections": [], "aether_access.named_versions": [], "aether_access.version_receipts": [], "aether_access.version_events": []}

    expected.update({"aether_access.map_media": [], "aether_access.map_media_refs": []})
    expected.update({"aether_access.map_devices": [], "aether_access.map_device_limits": [], "aether_access.map_cast": []})

    expected.update({"aether_store." + key: [] for key in ("branches", "branch_operations", "branch_audit")})

    expected.update({"aether_access.collaboration_" + key: [] for key in ("heads", "items", "events", "receipts")})

    expected["aether_access.legacy_file_metadata"] = []
    expected["aether_access.grant_provenance"] = []
    expected.update({"aether_access." + key: [] for key in ("links", "link_credentials", "link_visits")})
    expected["aether_access.legacy_drive_events"] = []
    expected["aether_access.legacy_drive_imported_folders"] = []
    expected.update({"aether_access." + key: [] for key in ("file_favorites", "file_favorite_receipts", "file_favorite_events")})
    expected.update({"aether_access." + key: [] for key in ("workspace_preferences", "workspace_preference_events", "workspace_preference_receipts")})

    def insert(table, values, json_fields=(), timestamps=()):
        values = {"tenant": tenant, **values}
        expected.setdefault(table, []).append(values)
        cols = ",".join(values)
        vals = ",".join(literal(encoded(v)) + "::jsonb" if k in json_fields else f"to_timestamp({literal(v)})" if k in timestamps else literal(v) for k, v in values.items())
        statements.append(f"INSERT INTO {table} ({cols}) VALUES ({vals});")

    # Migration initializes exactly one default settings row. Never overwrite a
    # configured tenant or a previously used destination.
    default = {"schema": 1, "name": "Aether Studio", "theme": {"base": "aether-default", "apps": {}}}
    statements.append(f"DO $$ BEGIN IF (SELECT count(*) FROM aether_settings.presentation)<>1 OR NOT EXISTS (SELECT 1 FROM aether_settings.presentation WHERE tenant={literal(tenant)} AND revision=1 AND value={literal(default)}) THEN RAISE EXCEPTION 'Destination settings are not empty'; END IF; END $$;")
    statements.append("DELETE FROM aether_settings.presentation;")
    insert("aether_settings.presentation", {"revision": 1, "value": data["_server_presentation"]})
    for u in data["users"]:
        insert("aether_identity.users", {k: bool(u[k]) if k in ("active", "must_change", "email_verified") else u[k]
               for k in ("id", "username", "password", "role", "active", "must_change", "full_name", "email", "email_verified")})
    for u in data["users"]:
        insert("aether_identity.preferences", {"user_id": u["id"], **user_preferences(u)})
    for org in data["drive_organizations"]:
        insert("aether_access.organizations", {k: org[k] for k in ("id", "name")})
    defaults = {r["workspace"] for r in data["drive_org_workspaces"]}
    for w in data["drive_workspaces"]:
        insert("aether_access.workspaces", {**{k: w[k] for k in ("id", "organization", "name")}, "is_default": w["id"] in defaults})
    for source, dest, keys in (
        ("drive_members", "members", ("organization", "user_id", "role")),
        ("drive_workspace_members", "workspace_members", ("workspace", "user_id", "role")),
        ("drive_enrolled", "enrolled", ("user_id",)),
    ):
        for row in data[source]:
            insert("aether_access." + dest, {k: row[k] for k in keys})
    restrictions = {r["id"]: bool(r["restricted"]) for r in data["app_access"]}
    for app in data["applications"]:
        insert("aether_access.applications", {"id": app["id"], "enabled": bool(app["enabled"]), "restricted": restrictions.get(app["id"], False)})
    for team in data["teams"]:
        insert("aether_access.teams", {"id": team["id"]})
        insert("aether_access.team_labels", {"team": team["id"], "name": team["name"]})
        for user in json.loads(team["members"]):
            insert("aether_access.team_members", {"team": team["id"], "user_id": user})
        for app in json.loads(team["apps"]):
            insert("aether_access.team_apps", {"team": team["id"], "app": app})
    locations = {r["file_id"]: r for r in data["drive_locations"]}
    for f in data["library"]:
        loc = locations[f["id"]]
        insert("aether_access.resources", {"id": f["id"], "organization": loc["organization"],
               "workspace": loc["workspace"] or None, "parent": None, "owner": f["owner"],
               "kind": "folder" if f["kind"] == "folder" else "document", "app": f["app"],
               "trashed": bool(f["trashed"]), "folder_name": f["name"] if f["kind"] == "folder" else None,
               "structure_revision": f["revision"] if f["kind"] == "folder" else 1})
        if f["kind"] == "folder":
            statements.append(f"INSERT INTO aether_access.audit(tenant,actor,action,target,happened_at) VALUES ({literal(tenant)},{literal(f['owner'])},'create_folder',{literal(f['id'])},to_timestamp({literal(f['created'])}));")
            # Imported structural baseline records the retained modified time;
            # it does not invent the unavailable individual folder operations.
            baseline = {"id": f["id"], "kind": "folder", "app": f["app"], "name": f["name"],
                        "owner": f["owner"], "location": {"organization": loc["organization"],
                        "workspace": loc["workspace"] or None, "parent": f["parent"] or None},
                        "parent_hidden": False, "structure_revision": f["revision"],
                        "document_revision": None, "trashed": bool(f["trashed"])}
            statements.append(f"INSERT INTO aether_access.resource_events(tenant,resource,revision,actor,operation_id,before_state,after_state,happened_at) VALUES ({literal(tenant)},{literal(f['id'])},{f['revision']},{literal(f['owner'])},'legacy-baseline',{literal(baseline)},{literal(baseline)},to_timestamp({literal(f['modified'])}));")
        else:
            insert("aether_store.documents", {"id": f["id"], "app": f["app"], "head_revision": f["revision"]})
    for f, expected_resource in zip(data["library"], expected.get("aether_access.resources", [])):
        expected_resource["parent"] = f["parent"] or None
        if f["parent"]:
            statements.append(f"UPDATE aether_access.resources SET parent={literal(f['parent'])} WHERE tenant={literal(tenant)} AND id={literal(f['id'])};")
    for link in data["_sharing_links"]["links"]:
        entry = {"tenant": tenant, "id": link["id"], "resource": link["file_id"], "role": link["role"], "expires": link["expires"], "revoked": bool(link["revoked"])}
        expected["aether_access.links"].append(entry)
        statements.append(f"INSERT INTO aether_access.links(tenant,id,resource,role,expires,revoked) VALUES({literal(tenant)},{literal(link['id'])},{literal(link['file_id'])},{literal(link['role'])},to_timestamp({literal(link['expires'])}),{literal(bool(link['revoked']))});")
        insert("aether_access.link_credentials", {"link": link["id"], "token_hash": link["token_hash"], "shared_by": link["shared_by"], "created": link["created"]})
    for visit in data["_sharing_links"]["visits"]:
        insert("aether_access.link_visits", visit)
    for grant in data["drive_grants"]:
        insert("aether_access.grants", {"resource": grant["file_id"], "user_id": grant["user_id"], "role": grant["role"]})
    for entry in data["library"]:
        if entry["kind"] == "folder":
            insert("aether_access.legacy_drive_imported_folders", {"resource": entry["id"]})
    for entry in data["_drive_events"]:
        insert("aether_access.legacy_drive_events", entry)
    for entry in data["_sharing_provenance"]:
        insert("aether_access.grant_provenance", entry)
    files = {f["id"]: f for f in data["library"]}
    for cursor, h in enumerate(data["library_history"], 1):
        op = "legacy-" + digest(encoded([h["file_id"], h["revision"]]).encode())
        meta = {"document_id": h["file_id"], "app": files[h["file_id"]]["app"], "name": h["name"],
                "revision": h["revision"], **data["_branch_graph"]["lineage"][h["file_id"], h["revision"]],
                "content_sha256": h["blob_hash"],
                "size_bytes": h["size_bytes"], "actor": h["author"], "operation_id": op,
                "event": h["event"], "saved_unix_ms": int(h["saved"] * 1000)}
        insert("aether_store.revisions", {"document_id": h["file_id"], "revision": h["revision"], "metadata": meta})
        insert("aether_access.legacy_history_annotations", {"document_id": h["file_id"], "revision": h["revision"], "note": h["note"], "saved": h["saved"], "parent_revision": h["parent_revision"]})
        insert("aether_store.operations", {"operation_id": op, "fingerprint": digest(encoded(meta).encode()), "document_id": h["file_id"], "revision": h["revision"], "receipt": meta})
        insert("aether_store.audit", {"operation_id": op, "document_id": h["file_id"], "revision": h["revision"], "actor": h["author"], "event": h["event"], "saved_unix_ms": meta["saved_unix_ms"]})
        insert("aether_store.document_events", {"cursor": cursor, "document_id": h["file_id"], "revision": h["revision"], "kind": "history_backfill"})
    if __package__:
        from .legacy_branches import import_rows
    else:
        from legacy_branches import import_rows
    import_rows(data["_branch_graph"], insert, digest, encoded)
    for f in data["library"]:
        if f["kind"] == "file":
            insert("aether_access.legacy_file_metadata", {"document_id": f["id"], "revision": f["revision"], "created": f["created"], "modified": f["modified"]})
    for v in data["_named_versions"]:
        insert("aether_access.named_versions", {**{("document_id" if k == "file_id" else k): value for k, value in v.items()}, "branch_id": v.get("branch_id")})
    for table, entries in data["_collaboration"].items():
        for entry in entries:
            insert("aether_access.collaboration_" + table, entry, ("before_state", "after_state"))
    for entry in data["_file_favorites"]:
        insert("aether_access.file_favorites", entry)
    for entry in data["_workspace_preferences"]:
        insert("aether_access.workspace_preferences", entry)
    if data["library_history"]:
        insert("aether_store.event_cursors", {"last_cursor": len(data["library_history"])})
    for r in data["library_recents"]:
        statements.append(f"INSERT INTO aether_access.library_recents(tenant,user_id,resource,opened) VALUES ({literal(tenant)},{literal(r['user_id'])},{literal(r['file_id'])},to_timestamp({literal(r['opened'])}));")
    for r in data["audit"]:
        statements.append(f"INSERT INTO aether_identity.audit(tenant,actor,action,target,happened_at) VALUES ({literal(tenant)},{literal(r['actor'])},{literal(r['action'])},{literal(r['target'])},to_timestamp({literal(r['time'])}));")
    for entry in data["_map_media"]["media"]:
        insert("aether_access.map_media", entry, json_fields=("chunks",))
    for entry in data["_map_media"]["refs"]:
        insert("aether_access.map_media_refs", entry)
    for entry in data["_map_devices"]:
        insert("aether_access.map_devices", entry, timestamps=("code_expires", "seen", "deployed"))
    statements.append("COMMIT;")
    return "\n".join(statements), expected


def compare(psql, dsn, expected):
    def comparable(value):
        # PostgreSQL JSON renders integral float8 values (e.g. the legacy
        # status_updated=0.0 default) as integers. Compare numeric values while
        # retaining boolean/string types and exact nonintegral timestamps.
        if type(value) is float and value.is_integer():
            return int(value)
        if isinstance(value, dict):
            return {k: comparable(v) for k, v in value.items()}
        if isinstance(value, list):
            return [comparable(v) for v in value]
        return value

    for table, entries in expected.items():
        if not entries:
            require(pg(psql, dsn, f"SELECT count(*) FROM {table}") == "0", "Imported record comparison failed.")
            continue
        cols = list(entries[0])
        if table == "aether_access.links":
            cols = ["EXTRACT(EPOCH FROM expires)::double precision AS expires" if c == "expires" else c for c in cols]
        if table == "aether_access.map_devices":
            cols = [f"EXTRACT(EPOCH FROM {c})::double precision AS {c}" if c in ("code_expires", "seen", "deployed") else c for c in cols]
        result = pg(psql, dsn, f"SELECT coalesce(json_agg(t),'[]') FROM (SELECT {','.join(cols)} FROM {table}) t;")
        actual = json.loads(result)
        wanted = entries
        if table == "aether_access.links":
            actual = sorted(actual, key=lambda r: r["id"])
            wanted = sorted((dict(r) for r in entries), key=lambda r: r["id"])
            require(len(actual) == len(wanted), "Imported link comparison failed.")
            for a, b in zip(actual, wanted):
                require(abs(a.pop("expires") - b.pop("expires")) <= 0.0000011, "Imported link expiry comparison failed.")
        if table == "aether_access.map_devices":
            actual = sorted(actual, key=lambda r: r["id"])
            wanted = sorted((dict(r) for r in entries), key=lambda r: r["id"])
            require(len(actual) == len(wanted), "Imported device comparison failed.")
            for a, b in zip(actual, wanted):
                for field in ("code_expires", "seen", "deployed"):
                    left, right = a.pop(field), b.pop(field)
                    require(left is None and right is None or left is not None and right is not None and abs(left-right) <= 0.0000011, "Imported device time comparison failed.")
        require(sorted(encoded(comparable(v)) for v in actual) == sorted(encoded(comparable(v)) for v in wanted),
                "Imported record comparison failed: " + table)
    require(pg(psql, dsn, "SELECT count(*) FROM aether_identity.sessions;") == "0", "Legacy sessions must not migrate.")
    require(pg(psql, dsn, "SELECT count(*) FROM aether_identity.agent_connections;") == "0", "Agent connections must be explicitly reissued after migration.")


def import_snapshot(snapshot, objects, tenant, dsn, psql, binary):
    data, blobs, manifest = load(snapshot)
    require(ID.fullmatch(tenant), "Invalid tenant.")
    require(objects.is_dir() and not objects.is_symlink() and not any(objects.iterdir()), "Object destination must be an empty private directory.")
    env = {**os.environ, "AETHER_NATIVE_PG": dsn, "AETHER_NATIVE_TENANT": tenant, "AETHER_NATIVE_OBJECTS": str(objects.resolve())}
    # Rust checks frozen schema checksums as well as version numbers before import.
    checked = subprocess.run([str(binary), "verify-store"], env=env, capture_output=True, check=False)
    require(checked.returncode == 0, "Native schema/integrity preflight failed.")
    for h in data["library_history"]:
        h["size_bytes"] = len(blobs[h["blob_hash"]])
    sql, expected = sql_import(data, tenant)
    for sha, content in blobs.items():
        private_write(objects / "v1" / digest(tenant.encode()) / sha, content)
    legacy_map.write_chunks(snapshot, objects, tenant, data["_map_media"]["media"], require)
    sync_tree(objects)
    pg(psql, dsn, sql)
    compare(psql, dsn, expected)
    checked = subprocess.run([str(binary), "verify-store"], env=env, capture_output=True, check=False)
    require(checked.returncode == 0, "Imported native integrity verification failed; keep original authoritative.")
    return {"users": len(data["users"]), "entries": len(data["library"]), "revisions": len(data["library_history"]),
            "map_media": len(data["_map_media"]["media"]), "map_media_refs": len(data["_map_media"]["refs"]), "map_devices": len(data["_map_devices"]),
            "content_blobs": len(blobs), "branches": len(data["_branch_graph"]["branches"]), "named_versions": len(data["_named_versions"]), "collaboration_events": len(data["_collaboration"]["events"]), "workspace_preferences": len(data["_workspace_preferences"]), "file_favorites": len(data["_file_favorites"]), "sharing_provenance": len(data["_sharing_provenance"]), "drive_events": len(data["_drive_events"]), "native_integrity": "passed", "record_comparison": "passed",
            "snapshot_manifest_sha256": digest(encoded(manifest).encode()), "cutover": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="action", required=True)
    cap = sub.add_parser("capture")
    cap.add_argument("--source", type=Path, required=True)
    cap.add_argument("--destination", type=Path, required=True)
    cap.add_argument("--map-media-owners", type=Path, help="JSON object mapping every stored Map filename to an existing user ID")
    args = parser.parse_args()
    try:
        manifest = capture(args.source, args.destination, args.map_media_owners)
        print(encoded({"snapshot": str(args.destination), "source_tables": manifest["source_tables"]}))
    except (TransferError, OSError, sqlite3.Error, ValueError, KeyError):
        raise SystemExit("Transfer refused or incomplete; original remains authoritative. Inspect with the operator verification tools; no secret details logged.") from None


if __name__ == "__main__":
    main()

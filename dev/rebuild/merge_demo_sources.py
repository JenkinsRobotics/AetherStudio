"""Offline dual-source reconciliation. Never writes either source or a live target.

Requires verified snapshots and an explicit duplicate-account decision. Original
credentials/settings win; development organizations/workspaces remain separate so
merging one identity does not grant other development users original access.
Unknown populated tables or asset/identity conflicts fail closed.
"""

import argparse
import contextlib
import json
import os
import shutil
import sqlite3
import tempfile
from pathlib import Path

if __package__:
    from .legacy_map import file_digest
    from .legacy_transfer import (
        capture,
        digest,
        encoded,
        load,
        private_write,
        require,
        sync_tree,
    )
else:
    from legacy_map import file_digest
    from legacy_transfer import (
        capture,
        digest,
        encoded,
        load,
        private_write,
        require,
        sync_tree,
    )

# Only these documented relationships are rewritten. Opaque document bytes and
# history blobs are never searched/replaced; original hash identities survive.
USER_COLUMNS = {
    "users": ("id",),
    "library": ("owner",),
    "library_history": ("author",),
    "library_recents": ("user_id",),
    "drive_enrolled": ("user_id",),
    "drive_members": ("user_id",),
    "drive_workspace_members": ("user_id",),
    "drive_workspace_preferences": ("user_id",),
    "drive_grants": ("user_id", "shared_by"),
    "drive_events": ("actor",),
}
ORG_COLUMNS = {
    "drive_organizations": ("id",),
    "drive_members": ("organization",),
    "drive_workspaces": ("organization",),
    "drive_org_workspaces": ("organization",),
    "drive_locations": ("organization",),
    "drive_events": ("organization",),
}
WORKSPACE_COLUMNS = {
    "drive_workspaces": ("id",),
    "drive_org_workspaces": ("workspace",),
    "drive_workspace_members": ("workspace",),
    "drive_locations": ("workspace",),
    "drive_workspace_preferences": ("workspace",),
}
MERGED = (
    set(USER_COLUMNS)
    | set(ORG_COLUMNS)
    | set(WORKSPACE_COLUMNS)
    | {"library_blobs", "audit"}
)
ORIGINAL_POLICY = {"applications", "app_access", "settings", "host_storage"}
EXCLUDED_CREDENTIALS = {
    "sessions",
    "attempts",
    "recovery",
    "recovery_tokens",
    "setup_sessions",
    "agent_connections",
}


def records(db, table):
    return [dict(row) for row in db.execute(f'SELECT * FROM "{table}"')]


def merge(
    original,
    development,
    destination,
    *,
    combine_original_identity=False,
    use_original_app_policy=False,
):
    require(
        combine_original_identity,
        "Explicit original-sign-in consolidation is required.",
    )
    original, development, destination = (
        Path(original).resolve(),
        Path(development).resolve(),
        Path(destination).absolute(),
    )
    require(
        original != development
        and not destination.exists()
        and all(p not in destination.parents for p in (original, development)),
        "Choose a new destination outside both snapshots.",
    )
    first, _, first_manifest = load(original)
    second, _, second_manifest = load(development)
    require(
        not (
            {f["id"] for f in first["library"]} & {f["id"] for f in second["library"]}
        ),
        "Overlapping file IDs require a document-level reconciliation.",
    )
    for key in ["app_access"] + ([] if use_original_app_policy else ["applications"]):
        require(
            sorted(first[key], key=lambda r: r["id"])
            == sorted(second[key], key=lambda r: r["id"]),
            "Different app access policies require explicit review.",
        )
    by_name = {u["username"].casefold(): u for u in first["users"]}
    require(len(by_name) == len(first["users"]), "Ambiguous original account names.")
    mapping = {}
    originals = {u["id"] for u in first["users"]}
    for user in second["users"]:
        match = by_name.get(user["username"].casefold())
        require(
            user["id"] not in originals
            or match is not None
            and match["id"] == user["id"],
            "Conflicting account IDs.",
        )
        mapping[user["id"]] = match["id"] if match else user["id"]
        if not match:
            require(
                not user["email"]
                or all(u["email"] != user["email"] for u in first["users"]),
                "Conflicting account email requires review.",
            )
    destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    with tempfile.TemporaryDirectory(
        prefix=".merge-", dir=destination.parent
    ) as temporary:
        source = Path(temporary) / "source"
        source.mkdir(mode=0o700)
        database = source / "studio.sqlite3"
        shutil.copyfile(original / "studio.sqlite3", database)
        database.chmod(0o600)
        with (
            contextlib.closing(sqlite3.connect(database)) as out,
            contextlib.closing(
                sqlite3.connect(
                    (development / "studio.sqlite3").as_uri() + "?mode=ro", uri=True
                )
            ) as incoming,
        ):
            out.row_factory = incoming.row_factory = sqlite3.Row
            # This copy is private and offline. The finished graph is verified by
            # capture/project and SQLite foreign_key_check before publication.
            out.execute("PRAGMA foreign_keys=OFF")
            definitions = {
                r["name"]: r["sql"]
                for r in incoming.execute(
                    "SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
                )
            }
            existing = {
                r[0]
                for r in out.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                )
            }
            for table, definition in definitions.items():
                require(table.isidentifier(), "Unsupported schema identifier.")
                if table not in existing:
                    out.execute(definition)
            tables = existing | set(definitions)
            for table in tables - {"sqlite_sequence"}:
                if table not in MERGED | ORIGINAL_POLICY | EXCLUDED_CREDENTIALS:
                    require(
                        out.execute(f'SELECT count(*) FROM "{table}"').fetchone()[0]
                        == 0
                        and (
                            table not in definitions
                            or incoming.execute(
                                f'SELECT count(*) FROM "{table}"'
                            ).fetchone()[0]
                            == 0
                        ),
                        "Populated table needs a qualified merge adapter: " + table,
                    )
            orgs = {
                r["id"]: "development-" + r["id"] for r in second["drive_organizations"]
            }
            workspaces = {
                r["id"]: "development-" + r["id"] for r in second["drive_workspaces"]
            }
            require(
                not set(orgs.values())
                & {r["id"] for r in first["drive_organizations"]},
                "Organization ID collision.",
            )
            require(
                not set(workspaces.values())
                & {r["id"] for r in first["drive_workspaces"]},
                "Workspace ID collision.",
            )
            for table in sorted(MERGED & definitions.keys()):
                columns = {r[1] for r in out.execute(f'PRAGMA table_info("{table}")')}
                for row in records(incoming, table):
                    require(set(row) <= columns, "Source schema mismatch: " + table)
                    if table == "users" and mapping[row["id"]] in originals:
                        continue
                    for fields, translations in [
                        (USER_COLUMNS, mapping),
                        (ORG_COLUMNS, orgs),
                        (WORKSPACE_COLUMNS, workspaces),
                    ]:
                        for key in fields.get(table, ()):
                            if row.get(key):
                                row[key] = translations.get(row[key], row[key])
                    if table in {"audit", "drive_events"}:
                        row.pop("id", None)
                    if (
                        table == "drive_enrolled"
                        and out.execute(
                            "SELECT 1 FROM drive_enrolled WHERE user_id=?",
                            (row["user_id"],),
                        ).fetchone()
                    ):
                        continue
                    if table == "library_blobs":
                        duplicate = out.execute(
                            "SELECT content FROM library_blobs WHERE hash=?",
                            (row["hash"],),
                        ).fetchone()
                        if duplicate:
                            require(
                                bytes(duplicate[0]) == bytes(row["content"]),
                                "Content hash collision.",
                            )
                            continue
                    keys = list(row)
                    out.execute(
                        f'INSERT INTO "{table}" ({",".join(keys)}) VALUES ({",".join("?" for _ in keys)})',
                        [row[k] for k in keys],
                    )
            for table in EXCLUDED_CREDENTIALS & tables:
                out.execute(f'DELETE FROM "{table}"')
            out.commit()
            require(
                not out.execute("PRAGMA foreign_key_check").fetchall(),
                "Merged references are invalid.",
            )
        ownership = {}
        for snapshot, translate in [(original, {}), (development, mapping)]:
            owner_path = snapshot / "map-media-owners.json"
            if owner_path.exists():
                for filename, owner in json.loads(owner_path.read_text()).items():
                    owner = translate.get(owner, owner)
                    require(
                        filename not in ownership or ownership[filename] == owner,
                        "Conflicting media ownership.",
                    )
                    ownership[filename] = owner
            for path in sorted((snapshot / "assets").rglob("*")):
                if not path.is_file():
                    continue
                relative = path.relative_to(snapshot / "assets")
                parts = list(relative.parts)
                if parts[0] == "workspaces" and len(parts) > 1:
                    parts[1] = translate.get(parts[1], parts[1])
                target = source.joinpath(*parts)
                if target.exists():
                    require(
                        file_digest(target, require) == file_digest(path, require),
                        "Conflicting workspace/media asset path.",
                    )
                    continue
                target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
                shutil.copyfile(path, target)
                target.chmod(0o600)
        owner_path = Path(temporary) / "owners.json"
        private_write(owner_path, encoded(ownership).encode())
        candidate = Path(temporary) / "candidate"
        capture(source, candidate, owner_path)
        merged, _, _ = load(candidate)
        require(
            len(merged["library"]) == len(first["library"]) + len(second["library"]),
            "File count mismatch.",
        )
        require(
            len(merged["library_history"])
            == len(first["library_history"]) + len(second["library_history"]),
            "History count mismatch.",
        )
        report = {
            "schema": 1,
            "source_manifests": {
                "original": digest(encoded(first_manifest).encode()),
                "development": digest(encoded(second_manifest).encode()),
            },
            "account_policy": "original-sign-in",
            "user_id_map": mapping,
            "organization_map": orgs,
            "workspace_map": workspaces,
            "users": len(merged["users"]),
            "library": len(merged["library"]),
            "history": len(merged["library_history"]),
            "settings_policy": "original; both source snapshots retained",
            "app_policy": "original" if use_original_app_policy else "identical",
            "credentials_reissued": ["sessions", "recovery", "agent connections"],
            "cutover_ready": False,
        }
        private_write(candidate / "reconciliation.json", encoded(report).encode())
        manifest_path = candidate / "manifest.json"
        manifest = json.loads(manifest_path.read_text())
        manifest["files"]["reconciliation.json"] = digest(
            (candidate / "reconciliation.json").read_bytes()
        )
        with manifest_path.open("w") as stream:
            stream.write(encoded(manifest))
            stream.flush()
            os.fsync(stream.fileno())
        sync_tree(candidate)
        os.rename(candidate, destination)
        parent_fd = os.open(destination.parent, os.O_RDONLY)
        try:
            os.fsync(parent_fd)
        finally:
            os.close(parent_fd)
        return {
            k: report[k]
            for k in [
                "schema",
                "users",
                "library",
                "history",
                "account_policy",
                "cutover_ready",
            ]
        }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("original", type=Path)
    parser.add_argument("development", type=Path)
    parser.add_argument("destination", type=Path)
    parser.add_argument(
        "--combine-original-identity", action="store_true", required=True
    )
    parser.add_argument("--use-original-app-policy", action="store_true")
    args = parser.parse_args()
    print(
        json.dumps(
            merge(
                args.original,
                args.development,
                args.destination,
                combine_original_identity=args.combine_original_identity,
                use_original_app_policy=args.use_original_app_policy,
            ),
            indent=2,
        )
    )

"""Check native permission fixtures against the actual imported Drive policy.

No running server or installation data: this uses an in-memory SQLite fixture.
Run with --write only when deliberately updating the versioned parity corpus.
"""

import itertools
import json
import random
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from core.host.drive_access import DriveAccess

FIXTURE = ROOT / "crates/server/tests/fixtures/document-policy.json"


def corpus():
    db = sqlite3.connect(":memory:")
    db.row_factory = sqlite3.Row
    db.executescript("""
        CREATE TABLE library(id TEXT,owner TEXT,parent TEXT,trashed INTEGER,scope TEXT);
        CREATE TABLE drive_locations(file_id TEXT,organization TEXT,workspace TEXT);
        CREATE TABLE drive_members(organization TEXT,user_id TEXT,role TEXT);
        CREATE TABLE drive_workspaces(id TEXT,organization TEXT);
        CREATE TABLE drive_workspace_members(workspace TEXT,user_id TEXT,role TEXT);
        CREATE TABLE drive_org_workspaces(organization TEXT,workspace TEXT);
        CREATE TABLE drive_grants(file_id TEXT,user_id TEXT,role TEXT);
        CREATE TABLE drive_links(id TEXT,file_id TEXT,role TEXT,revoked INTEGER,expires REAL);
        CREATE TABLE drive_link_visits(link_id TEXT,user_id TEXT);
    """)
    access = DriveAccess.__new__(DriveAccess)
    access.db = db
    dimensions = list(
        itertools.product(
            [None, "shared", "engineering"],
            [None, "member", "owner"],
            [None, "viewer", "editor", "owner"],
            [False, True],
            [False, True],
            [None, "viewer", "editor"],
            [None, "viewer", "editor"],
            [0, 1, 2],
        )
    )
    # A fixed, broad selection of interactions; replayable without randomness at
    # runtime. Dedicated PostgreSQL tests exercise traversal and link expiration.
    selected = random.Random(20261010).sample(dimensions, 512)
    tables = [
        r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")
    ]
    result = []
    for workspace, member, ws_role, own, parent_own, grant, link, trash in selected:
        for table in tables:
            db.execute(f"DELETE FROM {table}")  # local constant schema names
        if member:
            db.execute(
                "INSERT INTO drive_members VALUES('default','alice',?)", (member,)
            )
        if workspace:
            db.execute("INSERT INTO drive_workspaces VALUES(?,'default')", (workspace,))
            if ws_role:
                db.execute(
                    "INSERT INTO drive_workspace_members VALUES(?,'alice',?)",
                    (workspace, ws_role),
                )
            if workspace == "engineering":
                db.execute(
                    "INSERT INTO drive_org_workspaces VALUES('default','engineering')"
                )
        nodes = []
        for index, owned in enumerate([own, parent_own]):
            ident, parent = ("leaf", "folder") if index == 0 else ("folder", None)
            owner = "alice" if owned else "someone_else"
            trashed = trash == index + 1
            db.execute(
                "INSERT INTO library VALUES(?,?,?,?,?)",
                (
                    ident,
                    owner,
                    parent,
                    trashed,
                    "workspace" if workspace else "personal",
                ),
            )
            db.execute(
                "INSERT INTO drive_locations VALUES(?,'default',?)", (ident, workspace)
            )
            # Folder grants and leaf links exercise inheritance/max-role rules.
            node_grant, node_link = (
                (grant if index == 1 else None),
                (link if index == 0 else None),
            )
            if node_grant:
                db.execute(
                    "INSERT INTO drive_grants VALUES(?,'alice',?)", (ident, node_grant)
                )
            if node_link:
                db.execute(
                    "INSERT INTO drive_links VALUES('link',?,?,0,99999999999)",
                    (ident, node_link),
                )
                db.execute("INSERT INTO drive_link_visits VALUES('link','alice')")
            nodes.append(
                {
                    "owner": owner,
                    "trashed": trashed,
                    "grant": node_grant,
                    "link": node_link,
                }
            )
        row = db.execute("SELECT * FROM library WHERE id='leaf'").fetchone()
        result.append(
            {
                "user": "alice",
                "member": bool(member),
                "workspace": workspace,
                "workspace_role": access.workspace_role("alice", workspace)
                if workspace
                else None,
                "chain": nodes,
                "expected": access.role(row, "alice"),
            }
        )
    db.close()
    return result


def main():
    expected = corpus()
    if sys.argv[1:] == ["--write"]:
        FIXTURE.parent.mkdir(parents=True, exist_ok=True)
        FIXTURE.write_text(json.dumps(expected, separators=(",", ":")) + "\n")
    elif sys.argv[1:]:
        raise SystemExit("Usage: document_policy_check.py [--write]")
    elif json.loads(FIXTURE.read_text()) != expected:
        raise SystemExit("Native permission fixture diverges from current Drive rules")
    print(f"Verified {len(expected)} document policy cases against imported Drive.")


if __name__ == "__main__":
    main()

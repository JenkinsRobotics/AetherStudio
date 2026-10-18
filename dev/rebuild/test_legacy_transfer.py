"""Disposable original-host -> native-storage migration and refusal checks."""
import base64
import json
import os
import shutil
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

import pytest

from core.host.server import StudioHost
from dev.rebuild.legacy_transfer import (
    ROOT,
    TransferError,
    capture,
    compare,
    digest,
    import_snapshot,
    load,
    pg,
    sql_import,
)
from dev.rebuild.native_backup import IDENTITY_CREDENTIAL_EXCLUSIONS
from dev.rebuild.postgres_check import pg_bin

PASSWORD = "migration-fixture-password-2026"


@pytest.fixture
def source(tmp_path):
    root = tmp_path / "original"
    host = StudioHost(root)
    owner = host.store.create_user("owner", PASSWORD, "admin", False)
    viewer = host.store.create_user("reader", PASSWORD, "member", False)
    token = host.store.sign_in("owner", PASSWORD, "local")

    avatar = "data:image/png;base64," + base64.b64encode(b"\x89PNG\r\n\x1a\nfixture").decode()
    host.dispatch("/api/preferences", {"theme": "light", "theme_id": "aether-test", "avatar": avatar}, token, "local")

    host.store.db.execute("UPDATE settings SET value=? WHERE key='name'", (json.dumps("Fixture Workshop"),))
    host.dispatch("/api/admin/theme", {"base": "aether-light", "apps": {"map": "aether-dark"}}, token, "local")

    def call(action, **data):
        return host.dispatch("/api/drive/" + action, data, token, "local")

    call("context")
    call("workspace_favorite", workspace="shared", favorite=True)
    old_workspace = next(w for w in call("workspace_open", workspace="shared")["workspaces"] if w["id"] == "shared")
    folder = call("create", kind="folder", name="Folder ' ; SELECT --")
    # Historical app-labelled folders and file times distinct from save times.
    host.store.db.execute("UPDATE library SET app='map' WHERE id=?", (folder["id"],))
    file = call("create", app="map", parent=folder["id"], name="First.aethermap",
                data_base64=base64.b64encode(b'{"scene":1}').decode())
    host.dispatch("/api/library/save", {"app": "map", "id": file["id"],
                  "expected_revision": 1, "data_base64": base64.b64encode(b'{"scene":2}').decode()}, token, "local")
    host.store.db.execute("UPDATE library SET created=created-123.456,modified=modified-0.123 WHERE id=?", (file["id"],))
    call("grant", id=folder["id"], user=viewer, role="viewer")
    host.store.db.execute("UPDATE drive_grants SET shared_at=12345.125 WHERE file_id=?", (folder["id"],))
    private = call("create", app="cad", name="Private", data_base64="e30=")
    # A real attachment descriptor and immutable external blob.
    blob = b"fixture attachment\0bytes"
    key = digest(blob)
    upload = call("upload_begin", name="attachment.bin", size=len(blob))
    call("upload_chunk", upload=upload["id"], offset=0, data_base64=base64.b64encode(blob).decode())
    attachment = call("upload_finish", upload=upload["id"], sha256=key)
    (root / "workspaces" / owner).mkdir(parents=True, exist_ok=True)
    (root / "workspaces" / owner / "fixture.txt").write_text("retained workspace asset")
    host.store.db.execute("UPDATE library_history SET note=? WHERE file_id=? AND revision=1", ("Original note — keep this", file["id"]))
    host.store.db.commit()
    host.dispatch("/api/library/version", {"app": "map", "id": file["id"], "expected_revision": 2,
                  "name": "V1 — saved", "message": "Original checkpoint"}, token, "local")
    host.store.db.execute("UPDATE library_versions SET created=1000.123456789,status='released',status_updated=1001.125,status_note='Retain release note' WHERE file_id=?", (file["id"],))
    host.store.db.commit()
    def discuss(collection, value, operation="add", item=None):
        current = host.dispatch("/api/library/collaboration", {"app": "map", "id": file["id"]}, token, "local")
        return host.dispatch("/api/library/collaboration_mutate", {"app": "map", "id": file["id"],
            "expected_revision": current["revision"], "collection": collection, "operation": operation,
            "item": item, "value": value}, token, "local")
    comment = discuss("comments", {"text": "Original review — preserve history", "revision": 2,
        "attachments": [{"name": "review.png", "data_url": avatar}]})["comments"][0]["id"]
    discuss("comments", {"text": "Reply survives removal", "parent": comment})
    discuss("comments", {}, "delete", comment)
    task = discuss("tasks", {"text": "Check dimensions", "assignee": viewer, "due": "2028-02-29"})["tasks"][0]["id"]
    discuss("tasks", {"status": "in_progress"}, "update", task)
    discuss("notes", {"text": "Preserved document notes"}, "update")
    old_collaboration = discuss("reminders", {"text": "Review before release", "due": "2026-12-01"})
    call("favorite", id=file["id"], favorite=True)
    call("favorite", id=folder["id"], favorite=True)
    old_history = host.dispatch("/api/library/history", {"app": "map", "id": file["id"]}, token, "local")
    old_revision = host.dispatch("/api/library/read_revision", {"app": "map", "id": file["id"], "revision": 1}, token, "local")
    yield root, host, {"owner": owner, "reader": viewer, "file": file["id"], "folder": folder["id"],
                       "private": private["id"], "attachment": attachment["id"], "blob": key,
                       "old_history": old_history, "old_revision": old_revision, "old_collaboration": old_collaboration, "old_drive_listing": call("list", organization="all", view="search")["files"], "old_drive_activity": call("activity", organization="default")["events"], "old_workspace": old_workspace}
    host.store.db.close()


@pytest.fixture
def native(tmp_path):
    binaries = pg_bin()
    binary = ROOT / "target/debug/aether-native-host"
    assert binary.is_file(), "Build aether-native-host before migration tests"
    with tempfile.TemporaryDirectory(prefix="aether-migrate-", dir="/tmp") as temp:
        root = Path(temp)
        database, objects = root / "database", root / "objects"
        objects.mkdir(mode=0o700)
        command = [str(binaries / "initdb"), "-D", str(database), "-U", "aether_test",
                   "--auth=trust", "--no-locale", "--encoding=UTF8"]
        share = binaries.parent / "share/postgresql"
        if (share / "postgres.bki").is_file():
            command += ["-L", str(share)]
        subprocess.run(command, check=True, capture_output=True)
        # The socket directory is private and there is no network listener.
        subprocess.run([str(binaries / "pg_ctl"), "-D", str(database), "-l", str(root / "pg.log"),
                        "-o", f"-k {root} -h ''", "-w", "start"], check=True, capture_output=True)
        dsn = f"host={root} user=aether_test dbname=postgres"
        env = {**os.environ, "AETHER_NATIVE_PG": dsn, "AETHER_NATIVE_TENANT": "demo",
               "AETHER_NATIVE_OBJECTS": str(objects)}
        try:
            subprocess.run([str(binary), "migrate"], env=env, check=True, capture_output=True)
            yield objects, dsn, binaries / "psql", binary, env, root
        finally:
            subprocess.run([str(binaries / "pg_ctl"), "-D", str(database), "-m", "fast", "-w", "stop"],
                           check=True, capture_output=True)


def test_capture_preserves_live_source_and_detects_tampering(source, tmp_path):
    root, host, ids = source
    before = list(host.store.db.iterdump())
    snapshot = tmp_path / "snapshot"
    capture(root, snapshot)
    data, _, manifest = load(snapshot)
    assert len(data["users"]) == 2
    assert data["_workspace_preferences"] == [{"user_id": ids["owner"], "workspace": "shared", "favorite": True, "opened": ids["old_workspace"]["opened"], "revision": 0}]
    assert "_workspace_preferences" not in json.loads((snapshot / "projection.json").read_text())
    assert len(data["_collaboration"]["events"]) == 7
    assert len(data["_collaboration"]["items"]) == 5
    assert "_collaboration" not in json.loads((snapshot / "projection.json").read_text())
    assert len(data["_named_versions"]) == 1
    assert data["_named_versions"][0]["status"] == "released"
    assert "_named_versions" not in json.loads((snapshot / "projection.json").read_text())
    assert manifest["source_tables"]["sessions"] == 1
    assert list(host.store.db.iterdump()) == before
    assert (snapshot / "studio.sqlite3").stat().st_mode & 0o777 == 0o600
    assert all(not (p.stat().st_mode & 0o077) for p in [snapshot, *snapshot.rglob("*")])
    assert (snapshot / "assets/workspaces" / ids["owner"] / "fixture.txt").read_text() == "retained workspace asset"
    with pytest.raises(TransferError, match="already exists"):
        capture(root, snapshot)
    (snapshot / "projection.json").write_text("{}")
    with pytest.raises(TransferError, match="hash mismatch"):
        load(snapshot)


@pytest.mark.parametrize("damage", ["attachment", "history", "branch", "symlink"])
def test_refuses_incomplete_or_unsupported_source(source, tmp_path, damage):
    root, host, ids = source
    if damage == "attachment":
        (root / "drive/blobs" / ids["blob"]).unlink()
    elif damage == "history":
        host.store.db.execute("DELETE FROM library_history WHERE file_id=? AND revision=1", (ids["file"],))
        host.store.db.commit()
    elif damage == "branch":
        host.store.db.execute("UPDATE library_history SET branch='Other' WHERE file_id=?", (ids["file"],))
        host.store.db.commit()
    else:
        (root / "workspaces/unsafe").symlink_to(root / "studio.sqlite3")
    with pytest.raises(TransferError):
        capture(root, tmp_path / "snapshot")
    assert not (tmp_path / "snapshot").exists()


def test_native_import_login_permissions_restore_and_atomic_refusal(source, tmp_path, native):
    root, _, ids = source
    objects, dsn, psql, binary, env, pg_root = native
    snapshot = tmp_path / "snapshot"
    capture(root, snapshot)
    data, blobs, _ = load(snapshot)
    for h in data["library_history"]:
        h["size_bytes"] = len(blobs[h["blob_hash"]])
    fresh_sql, _ = sql_import(data, "demo")
    pg(psql, dsn, "UPDATE aether_settings.presentation SET revision=2")
    with pytest.raises(TransferError):
        pg(psql, dsn, fresh_sql)
    assert pg(psql, dsn, "SELECT revision FROM aether_settings.presentation") == "2"
    assert pg(psql, dsn, "SELECT count(*) FROM aether_identity.users") == "0"
    pg(psql, dsn, "UPDATE aether_settings.presentation SET revision=1; INSERT INTO aether_settings.presentation SELECT 'other',revision,value FROM aether_settings.presentation")
    with pytest.raises(TransferError):
        pg(psql, dsn, fresh_sql)
    assert pg(psql, dsn, "SELECT count(*) FROM aether_settings.presentation") == "2"
    pg(psql, dsn, "DELETE FROM aether_settings.presentation WHERE tenant='other'")
    report = import_snapshot(snapshot, objects, "demo", dsn, psql, binary)
    assert report["users"] == 2 and report["revisions"] == 4
    assert pg(psql, dsn, "SELECT count(*) FROM aether_identity.sessions") == "0"
    data, blobs, _ = load(snapshot)
    for h in data["library_history"]:
        h["size_bytes"] = len(blobs[h["blob_hash"]])
    sql, expected = sql_import(data, "demo")
    compare(psql, dsn, expected)
    with pytest.raises(TransferError):
        pg(psql, dsn, sql)
    compare(psql, dsn, expected)
    # Exact SQL data + object backup can rebuild another empty native database.
    # A recovery backup must not revive delegated access from the source host.
    pg(psql, dsn, "INSERT INTO aether_identity.agent_connections(tenant,id,user_id,token_hash,label,apps,expires) SELECT tenant,'backup-fixture',id,repeat('a',64),'Fixture',ARRAY['map'],clock_timestamp()+interval '1 day' FROM aether_identity.users LIMIT 1")
    dump = pg_root / "restore.sql"
    with dump.open("wb") as out:
        subprocess.run([str(psql.parent / "pg_dump"), "--dbname", dsn, "--no-owner", "--no-privileges", *IDENTITY_CREDENTIAL_EXCLUSIONS],
                       stdout=out, stderr=subprocess.PIPE, check=True)
    pg(psql, dsn, "CREATE DATABASE restored")
    restored = dsn.replace("dbname=postgres", "dbname=restored")
    pg(psql, restored, dump.read_text())
    compare(psql, restored, expected)
    assert pg(psql, restored, "SELECT count(*) FROM aether_identity.agent_connections") == "0"
    with pytest.raises(TransferError, match="comparison failed"):
        compare(psql, restored, {"aether_access.named_versions": []})
    assert pg(psql, restored, "SELECT status FROM aether_access.named_versions") == "released"
    restored_objects = pg_root / "restored-objects"
    shutil.copytree(objects, restored_objects)
    verified = subprocess.run([str(binary), "verify-store"], check=True, capture_output=True,
                              env={**env, "AETHER_NATIVE_PG": restored, "AETHER_NATIVE_OBJECTS": str(restored_objects)})
    assert json.loads(verified.stdout)["revisions"] == 4
    # Failure at the final insert rolls back users/resources/history together.
    pg(psql, dsn, "CREATE DATABASE rejected")
    rejected = dsn.replace("dbname=postgres", "dbname=rejected")
    subprocess.run([str(binary), "migrate"], env={**env, "AETHER_NATIVE_PG": rejected}, check=True, capture_output=True)
    with pytest.raises(TransferError):
        pg(psql, rejected, sql.replace("COMMIT;", "SELECT 1/0; COMMIT;"))
    assert pg(psql, rejected, "SELECT count(*) FROM aether_identity.users") == "0"
    assert pg(psql, rejected, "SELECT count(*) FROM aether_store.documents") == "0"
    assert pg(psql, rejected, "SELECT value->>'name' FROM aether_settings.presentation") == "Aether Studio"
    # A leftover operator seed must neither silently override imported settings
    # nor mask a saved change on restart.
    seed = tmp_path / "presentation.json"
    seed.write_text(json.dumps({"schema": 1, "name": "Conflicting seed", "theme": {"base": "aether-default", "apps": {}}}))
    refused = subprocess.run([str(binary), "serve"], check=False, env={**env, "AETHER_NATIVE_PRESENTATION": str(seed)}, capture_output=True, timeout=10)
    assert refused.returncode != 0 and b"differs from saved settings" in refused.stderr
    assert pg(psql, dsn, "SELECT value->>'name' FROM aether_settings.presentation") == "Fixture Workshop"
    # Sign in through the actual Rust HTTP boundary with the original password.
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    origin = f"http://127.0.0.1:{port}"
    with subprocess.Popen([str(binary), "serve"], env={**env, "AETHER_NATIVE_LISTEN": f"127.0.0.1:{port}",
                              "AETHER_NATIVE_ATTACHMENTS": str(snapshot / "assets/drive/blobs"),
                              "AETHER_NATIVE_WORKSPACES": str(snapshot / "assets/workspaces")},
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) as server:
        try:
            for _ in range(100):
                try:
                    urllib.request.urlopen(origin + "/api/status", timeout=1).close()
                    break
                except (OSError, urllib.error.URLError):
                    time.sleep(0.05)
            def call(path, payload, cookie=""):
                request = urllib.request.Request(origin + path, data=json.dumps(payload).encode(),
                          headers={"Content-Type": "application/json", "Origin": origin, "Cookie": cookie})
                return urllib.request.urlopen(request, timeout=5)
            with call("/api/login", {"username": "reader", "password": PASSWORD}) as login:
                cookie = login.headers["Set-Cookie"].split(";", 1)[0]
            with call("/api/library/read", {"app": "map", "id": ids["file"]}, cookie) as read:
                result = json.load(read)
                assert result["data_base64"] == base64.b64encode(b'{"scene":2}').decode()
                assert result["writable"] is False
            with call("/api/library/history", {"app": "map", "id": ids["file"]}, cookie) as response:
                assert json.load(response) == {**ids["old_history"], "writable": False, "branch_identity": "stable"}
            with call("/api/library/collaboration", {"app": "map", "id": ids["file"]}, cookie) as response:
                assert json.load(response) == {**ids["old_collaboration"], "actor": ids["reader"], "mutation_replay": "operation_id"}
            with call("/api/library/list", {"app": "map", "view": "personal"}, cookie) as response:
                assert json.load(response)["files"] == []
            with call("/api/library/read_revision", {"app": "map", "id": ids["file"], "revision": 1}, cookie) as response:
                assert json.load(response) == ids["old_revision"]
            with pytest.raises(urllib.error.HTTPError) as denied:
                call("/api/library/read", {"app": "cad", "id": ids["private"]}, cookie)
            assert denied.value.code in (403, 404)
            with call("/api/login", {"username": "owner", "password": PASSWORD}) as login:
                owner_cookie = login.headers["Set-Cookie"].split(";", 1)[0]
            with call("/api/library/list", {"app": "map", "parent": ids["folder"]}, owner_cookie) as response:
                entry = json.load(response)["files"][0]
                assert entry["versions"] == 1 and entry["latest_version"] == "V1 — saved"
            with pytest.raises(urllib.error.HTTPError) as locked:
                call("/api/library/version_delete", {"app": "map", "id": ids["file"],
                     "expected_revision": 2, "operation_id": "delete-released", "name": "V1 — saved"}, owner_cookie)
            assert locked.value.code == 409
            workspace_url = origin + "/map/workspace/fixture.txt"
            with urllib.request.urlopen(urllib.request.Request(workspace_url, headers={"Cookie": owner_cookie})) as response:
                assert response.read() == b"retained workspace asset"
                assert response.headers["X-Aether-Revision"] == digest(b"retained workspace asset")
                assert response.headers["Content-Disposition"] == "attachment"
            with pytest.raises(urllib.error.HTTPError) as denied:
                urllib.request.urlopen(urllib.request.Request(workspace_url, headers={"Cookie": cookie}))
            assert denied.value.code == 404
            with urllib.request.urlopen(urllib.request.Request(origin + "/api/status", headers={"Cookie": owner_cookie})) as response:
                status = json.load(response)
                assert status["name"] == "Fixture Workshop"
                assert status["theme"] == {"base": "aether-light", "apps": {"map": "aether-dark"}}
                user = status["user"]
                assert user["theme"] == "light" and user["theme_id"] == "aether-test"
                assert user["avatar"].startswith("data:image/png;base64,")
            with call("/api/drive/activity", {"organization": "default"}, owner_cookie) as response:
                activity = json.load(response)["events"]
                original = [{**row, "id": int(row["id"].removeprefix("legacy:"))} for row in activity if row["id"].startswith("legacy:")]
                assert sorted(original, key=lambda r: r["id"]) == sorted(ids["old_drive_activity"], key=lambda r: r["id"])
                assert all(row["id"].startswith("legacy:") for row in activity), "Import markers must not invent duplicate activity."
            # Mixed Drive metadata comes from the same imported rows and current ACL.
            with call("/api/drive/list", {"organization": "all", "view": "search"}, owner_cookie) as response:
                listed = json.load(response)
                by_id = {row["id"]: row for row in listed["files"]}
                assert by_id[ids["folder"]]["kind"] == "folder"
                assert by_id[ids["file"]]["revision"] == 2
                assert by_id[ids["attachment"]]["size"] == len(b"fixture attachment\0bytes")
                assert "data_base64" not in by_id[ids["file"]]
                assert set(by_id) == {row["id"] for row in ids["old_drive_listing"]}
                for old in ids["old_drive_listing"]:
                    new = by_id[old["id"]]
                    for key in ["id", "name", "app", "kind", "scope", "parent", "organization", "workspace", "owner_id", "role", "manageable", "writable", "favorite", "versions", "size", "revision"]:
                        assert new[key] == old[key], (key, new[key], old[key])
                    for key in ["created", "modified"]:
                        assert (new[key] == old[key] if old["kind"] == "file" else abs(new[key] - old[key]) < 0.000001)

            for direction, session in [("with",cookie),("by",owner_cookie)]:
                with call("/api/drive/list", {"view":"shared","shared_scope":direction}, session) as response:
                    shared = json.load(response)["files"]
                    assert {f["id"] for f in shared} == {ids["file"],ids["folder"]}
                    assert all(f["shared_by"] == "owner" and f["shared_at"] == 12345.125 for f in shared)

            with call("/api/drive/list", {"view":"favorites"}, owner_cookie) as response:
                assert {f["id"] for f in json.load(response)["files"]} == {ids["file"], ids["folder"]}
            assert pg(psql, dsn, "SELECT count(*) FROM aether_access.file_favorite_events") == "0"
            unstar = {"id":ids["file"], "favorite":False, "operation_id":"after-import-unstar"}
            with call("/api/drive/favorite", unstar, owner_cookie) as response:
                changed = json.load(response)
                assert changed == {"ok":True,"applied_revision":1,"favorite":False,"replayed":False}
            with call("/api/drive/favorite", unstar, owner_cookie) as response:
                assert json.load(response) == {**changed,"replayed":True}
            assert pg(psql, dsn, "SELECT count(*) FROM aether_access.file_favorite_events") == "1"
            with call("/api/drive/details", {"id": ids["folder"]}, cookie) as response:
                folder = json.load(response)
                assert folder["app"] == "map" and folder["kind"] == "folder"
                assert folder["writable"] is False
            with call("/api/drive/open", {"id": ids["file"]}, cookie) as response:
                opened = json.load(response)
                assert opened["revision"] == 2 and opened["writable"] is False
                assert "data_base64" not in opened
            with call("/api/drive/list", {"parent": ids["folder"]}, cookie) as response:
                listed = json.load(response)
                assert [row["id"] for row in listed["files"]] == [ids["file"]]
                assert listed["files"][0]["writable"] is False
            with call("/api/drive/context", {}, owner_cookie) as response:
                workspace = next(w for w in json.load(response)["workspaces"] if w["id"] == "shared")
                assert workspace["favorite"] is True
                assert workspace["opened"] == ids["old_workspace"]["opened"]
                assert workspace["preference_revision"] == 0
            request = {"workspace": "shared", "favorite": False, "operation_id": "after-import-favorite"}
            with call("/api/drive/workspace_favorite", request, owner_cookie) as response:
                preference = json.load(response)
                assert preference["applied_revision"] == 1 and preference["replayed"] is False
            with call("/api/drive/workspace_favorite", request, owner_cookie) as response:
                assert json.load(response) == {**preference, "replayed": True}
            assert pg(psql, dsn, "SELECT count(*) FROM aether_access.workspace_preference_events") == "1"
            with call("/api/preferences", {"theme": "system"}, owner_cookie) as changed:
                assert json.load(changed)["ok"]
            with urllib.request.urlopen(urllib.request.Request(origin + "/api/status", headers={"Cookie": owner_cookie})) as response:
                assert json.load(response)["user"] == {**user, "theme": "system"}
            # Imported descriptors resolve to their original bytes through the
            # current user's native permissions, including preview/range requests.
            download = origin + "/api/drive/download?id=" + ids["attachment"] + "&revision=1&preview=1"
            with urllib.request.urlopen(urllib.request.Request(download, headers={"Cookie": owner_cookie})) as response:
                assert response.read() == b"fixture attachment\0bytes"
                assert response.headers["Content-Type"] == "application/octet-stream"
                assert response.headers["Content-Disposition"].startswith("attachment;")
            with urllib.request.urlopen(urllib.request.Request(download, headers={"Cookie": owner_cookie, "Range": "bytes=8-17"})) as response:
                assert response.status == 206
                assert response.read() == b"attachment"
            with pytest.raises(urllib.error.HTTPError) as denied:
                urllib.request.urlopen(urllib.request.Request(download, headers={"Cookie": cookie}))
            assert denied.value.code == 404
            discussion_request = {"app": "map", "id": ids["file"], "expected_revision": 7,
                "operation_id": "after-import-comment", "collection": "comments", "operation": "add",
                "value": {"text": "New native contribution", "revision": 2}}
            with call("/api/library/collaboration_mutate", discussion_request, cookie) as response:
                discussion = json.load(response)
                assert discussion["revision"] == 8 and discussion["replayed"] is False
                assert discussion["comments"][-1]["reference_name"] == "V1 — saved"
            with call("/api/library/collaboration_mutate", discussion_request, cookie) as response:
                assert json.load(response) == {**discussion, "replayed": True}
            assert pg(psql, dsn, "SELECT count(*) FROM aether_access.collaboration_events") == "8"
            assert pg(psql, dsn, "SELECT count(*) FROM aether_access.collaboration_receipts") == "1"
            with call("/api/library/save", {"app": "map", "id": ids["file"],
                      "expected_revision": 2, "operation_id": "after-import-save",
                      "data_base64": "e30="}, owner_cookie) as saved:
                assert json.load(saved)["revision"] == 3
            checked = subprocess.run([str(binary), "verify-store"], env=env,
                                     capture_output=True, check=True)
            assert json.loads(checked.stdout)["revisions"] == 5
        finally:
            server.terminate()
            server.wait(timeout=10)


def test_sql_literals_cannot_escape_values():
    from dev.rebuild.legacy_transfer import literal
    value = "'); DROP SCHEMA aether_identity CASCADE; --\n\\! touch forbidden"
    assert value not in literal(value)
    assert value.encode().hex() in literal(value)


@pytest.mark.parametrize("change", [{"theme": "invalid"}, {"theme_id": "x" * 65}, {"avatar": "https://example.test/p.png"}, {"avatar": "data:image/svg+xml;base64,PHN2Zz4="}])
def test_import_refuses_invalid_preferences(source, tmp_path, change):
    root, host, ids = source
    key, value = next(iter(change.items()))
    host.store.db.execute(f"UPDATE users SET {key}=? WHERE id=?", (value, ids["owner"]))
    host.store.db.commit()
    with pytest.raises(TransferError):
        capture(root, tmp_path / "snapshot")


@pytest.mark.parametrize("key,value", [("name", ""), ("name", "bad\nname"), ("theme", {"base": "https://theme.invalid", "apps": {}})])
def test_import_refuses_invalid_server_presentation(source, tmp_path, key, value):
    root, host, _ = source
    host.store.db.execute("UPDATE settings SET value=? WHERE key=?", (json.dumps(value), key))
    host.store.db.commit()
    with pytest.raises(TransferError, match="Unsupported server"):
        capture(root, tmp_path / "snapshot")
    assert not (tmp_path / "snapshot").exists()


@pytest.mark.parametrize("column,value", [("note", "x" * 501), ("note", "bad\0note"), ("saved", -1)])
def test_import_refuses_invalid_history_annotations(source, tmp_path, column, value):
    root, host, _ = source
    assert column in ("note", "saved")
    host.store.db.execute(f"UPDATE library_history SET {column}=?", (value,))
    host.store.db.commit()
    with pytest.raises(TransferError, match="Invalid history"):
        capture(root, tmp_path / "snapshot")
    assert not (tmp_path / "snapshot").exists()


@pytest.mark.parametrize("column,value", [
    ("name", "bad\nname"), ("message", "x" * 501), ("branch", "Other"),
    ("status", "unknown"), ("origin", "unknown"), ("created", -1),
    ("status_updated", float("inf")), ("status_note", "x" * 501),
])
def test_import_refuses_invalid_named_versions(source, tmp_path, column, value):
    root, host, _ = source
    host.store.db.execute(f"UPDATE library_versions SET {column}=?", (value,))
    host.store.db.commit()
    with pytest.raises(TransferError, match="named version"):
        capture(root, tmp_path / "refused")
    assert not (tmp_path / "refused").exists()


@pytest.mark.parametrize("damage", ["missing_event", "orphan_event", "before", "after", "branch", "state", "author", "image", "due", "notes", "unknown_field", "author_type", "assignee_type"])
def test_import_refuses_incomplete_collaboration(source, tmp_path, damage):
    root, host, _ids = source
    db = host.store.db
    if damage == "missing_event":
        db.execute("DELETE FROM collaboration_events WHERE revision=2")
    elif damage == "orphan_event":
        db.execute("DELETE FROM document_collaboration")
    elif damage == "before":
        db.execute("UPDATE collaboration_events SET before_json='{}' WHERE revision=3")
    elif damage == "state":
        db.execute("UPDATE document_collaboration SET content='{}'")
    else:
        revision = 4 if damage in ("due", "assignee_type") else 6 if damage == "notes" else 1
        v = json.loads(db.execute("SELECT after_json FROM collaboration_events WHERE revision=?", (revision,)).fetchone()[0])
        if damage == "after":
            v["text"] = "Altered historical text"
        elif damage == "branch":
            v["branch"] = "Other"
        elif damage == "author":
            v["author"] = "missing"
        elif damage == "author_type":
            v["author"] = []
        elif damage == "assignee_type":
            v["assignee"] = {}
        elif damage == "image":
            v["attachments"][0]["data_url"] = "data:image/svg+xml;base64,PHN2Zz4="
        elif damage == "due":
            v["due"] = "2026-02-30"
        elif damage == "notes":
            v["text"] = "x" * 50001
        else:
            v["unexpected"] = True
        db.execute("UPDATE collaboration_events SET after_json=? WHERE revision=?", (json.dumps(v), revision))
    db.commit()
    with pytest.raises(TransferError, match="[Cc]ollaboration"):
        capture(root, tmp_path / "snapshot")
    assert not (tmp_path / "snapshot").exists()


@pytest.mark.parametrize("field,value", [("created", -1), ("modified", float("inf")), ("created", "invalid")])
def test_import_refuses_invalid_file_timestamps(source, tmp_path, field, value):
    root, host, ids = source
    host.store.db.execute(f"UPDATE library SET {field}=? WHERE id=?", (value, ids["file"]))
    host.store.db.commit()
    with pytest.raises(TransferError, match="Invalid file timestamp"):
        capture(root, tmp_path / "invalid-time")


def test_original_sharing_links_and_visits_survive_import_and_restore(source, tmp_path, native):
    root, host, ids = source
    objects, dsn, psql, binary, env, _pg_root = native
    owner = host.store.sign_in('owner', PASSWORD, 'local')
    made = []
    for index in range(3):
        link = host.dispatch('/api/drive/link_create', {'id': ids['private'], 'role': 'viewer', 'days': 7}, owner, 'local')
        made.append(link)
    host.store.db.execute('INSERT INTO drive_link_visits VALUES (?,?)', (made[0]['id'], ids['reader']))
    host.store.db.execute('UPDATE drive_links SET revoked=1 WHERE id=?', (made[1]['id'],))
    host.store.db.execute('UPDATE drive_links SET expires=1 WHERE id=?', (made[2]['id'],))
    host.store.db.commit()
    snapshot = tmp_path / 'snapshot-links'
    capture(root, snapshot)
    data, blobs, _ = load(snapshot)
    assert len(data['_sharing_links']['links']) == 3
    assert len(data['_sharing_links']['visits']) == 1
    import_snapshot(snapshot, objects, 'demo', dsn, psql, binary)
    for history in data['library_history']:
        history['size_bytes'] = len(blobs[history['blob_hash']])
    _, expected = sql_import(data, 'demo')
    compare(psql, dsn, expected)
    dump = subprocess.check_output([str(psql.parent / 'pg_dump'), '--dbname', dsn, '--no-owner', '--no-privileges'], text=True)
    pg(psql, dsn, 'CREATE DATABASE links_restored')
    restored = dsn.replace('dbname=postgres', 'dbname=links_restored')
    pg(psql, restored, dump)
    compare(psql, restored, expected)
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0)); port = sock.getsockname()[1]
    origin = f'http://127.0.0.1:{port}'
    with subprocess.Popen([str(binary), 'serve'], env={**env, 'AETHER_NATIVE_PG': restored,
            'AETHER_NATIVE_LISTEN': f'127.0.0.1:{port}'}, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) as server:
        try:
            for _ in range(100):
                try:
                    urllib.request.urlopen(origin + '/api/status', timeout=1).close(); break
                except OSError:
                    time.sleep(.05)
            def call(action, data, cookie=''):
                return urllib.request.urlopen(urllib.request.Request(origin + '/api/' + action,
                    data=json.dumps(data).encode(), headers={'Content-Type': 'application/json', 'Origin': origin, 'Cookie': cookie}), timeout=10)
            with call('login', {'username': 'reader', 'password': PASSWORD}) as reply:
                cookie = reply.headers['Set-Cookie'].split(';', 1)[0]
            with call('drive/details', {'id': ids['private']}, cookie) as reply:
                assert json.load(reply)['role'] == 'viewer'
            for index, link in enumerate(made):
                secret = link['url'].split('share=')[1]
                if index == 0:
                    with call('drive/redeem', {'token': secret}, cookie) as reply:
                        assert json.load(reply)['id'] == ids['private']
                else:
                    with pytest.raises(urllib.error.HTTPError) as denied:
                        call('drive/redeem', {'token': secret}, cookie)
                    assert denied.value.code == 404
            with call('login', {'username': 'owner', 'password': PASSWORD}) as reply:
                owner_cookie = reply.headers['Set-Cookie'].split(';', 1)[0]
            with call('drive/link_revoke', {'id': ids['private'], 'link': made[0]['id'], 'operation_id': 'revoke-imported'}, owner_cookie) as reply:
                assert json.load(reply)['ok']
            with pytest.raises(urllib.error.HTTPError) as denied:
                call('drive/details', {'id': ids['private']}, cookie)
            assert denied.value.code == 404
        finally:
            server.terminate(); server.wait(timeout=10)


@pytest.mark.parametrize('field,value', [('audience','public'), ('role','owner'), ('token_hash','weak'), ('expires',-1), ('shared_by','missing')])
def test_import_refuses_invalid_link_authority(source, tmp_path, field, value):
    root, host, ids = source
    owner = host.store.sign_in('owner', PASSWORD, 'local')
    host.dispatch('/api/drive/link_create', {'id': ids['file'], 'role':'viewer','days':7}, owner, 'local')
    host.store.db.execute(f'UPDATE drive_links SET {field}=?', (value,))
    host.store.db.commit()
    with pytest.raises(TransferError):
        capture(root, tmp_path / 'invalid-links')


def test_capture_refuses_to_silently_drop_unowned_map_media(source, tmp_path):
    root, _, _ = source
    media = root / "map-media"
    media.mkdir()
    (media / "retained.png").write_bytes(b"original media")
    with pytest.raises(TransferError, match="Map media ownership"):
        capture(root, tmp_path / "refused-media")
    assert (media / "retained.png").read_bytes() == b"original media"
    assert not (tmp_path / "refused-media").exists()


def test_capture_refuses_history_only_map_media_until_binding_import(source, tmp_path):
    root, host, ids = source
    token = host.store.sign_in("owner", PASSWORD, "local")
    for revision, content in [(2, b'{"media":[{"file":"historic.png"}]}'), (3, b'{"media":[]}')]:
        host.dispatch("/api/library/save", {
            "app": "map", "id": ids["file"], "expected_revision": revision,
            "data_base64": base64.b64encode(content).decode(),
        }, token, "local")
    with pytest.raises(TransferError, match="Map revision references media"):
        capture(root, tmp_path / "refused-history-media")
    assert not (tmp_path / "refused-history-media").exists()

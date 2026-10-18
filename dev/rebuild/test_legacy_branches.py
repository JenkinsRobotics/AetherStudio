"""Real legacy DAG capture, native adoption, continued editing and recovery."""
import base64
import json
import shutil
import socket
import subprocess
import time
import urllib.error
import urllib.request

import pytest

from dev.rebuild import test_legacy_transfer as legacy_fixtures
from dev.rebuild.legacy_transfer import (
    TransferError,
    capture,
    compare,
    import_snapshot,
    load,
    pg,
    sql_import,
)

PASSWORD = legacy_fixtures.PASSWORD
source = legacy_fixtures.source
native = legacy_fixtures.native


@pytest.fixture
def branched(source):
    root, host, ids = source
    token = host.store.sign_in("owner", PASSWORD, "local")

    def call(action, **data):
        return host.dispatch("/api/library/" + action, {"app": "map", "id": ids["file"], **data}, token, "local")

    def save(branch, expected, value):
        return call("save", branch=branch, expected_revision=expected,
                    data_base64=base64.b64encode(json.dumps(value).encode()).decode())

    call("branch_create", name="Working", from_revision=2, expected_revision=2)
    save("Working", 2, {"scene": 3})
    save("Main", 2, {"scene": 4})
    call("merge", source="Main", target="Working", expected_revision=3,
         expected_source_revision=4, resolution="source")
    call("restore", branch="Working", revision=3, expected_revision=5)
    call("version", branch="Working", name="Branch checkpoint", expected_revision=6)
    call("branch_rename", name="Working", new_name="Renamed", branch="Working", expected_revision=6)

    def comment(branch, revision):
        current = call("collaboration")
        call("collaboration_mutate", branch=branch, expected_revision=current["revision"],
             collection="comments", operation="add", value={"text": "Review " + branch, "branch": branch, "revision": revision})

    comment("Renamed", 6)
    call("branch_create", name="Archived", from_revision=3, expected_revision=4)
    save("Archived", 3, {"scene": 7})
    call("version", branch="Archived", name="Retained checkpoint", expected_revision=7)
    comment("Archived", 7)
    call("branch_delete", name="Archived", branch="Archived", expected_revision=7, force=True)
    call("branch_create", name="Empty", from_revision=4, expected_revision=4)
    call("merge", source="Renamed", target="Main", expected_revision=4, expected_source_revision=6)
    save("Renamed", 6, {"scene": 9})
    # Older writers left restore parents implicit; History.parents derives the
    # prior revision on the same branch. Preserve that original NULL on import.
    host.store.db.execute("UPDATE library_history SET parent_revision=NULL WHERE file_id=? AND revision=6", (ids["file"],))
    host.store.db.commit()
    return root, host, ids, call, save


def test_capture_keeps_original_dag_and_frozen_projection(branched, tmp_path):
    root, host, ids, _, _ = branched
    before = list(host.store.db.iterdump())
    snapshot = tmp_path / "snapshot"
    capture(root, snapshot)
    data, _, _ = load(snapshot)
    graph = data["_branch_graph"]
    branches = {b["name"]: b for b in graph["branches"]}
    assert len(branches) == 3
    assert branches["Renamed"]["head_revision"] == 9
    assert branches["Empty"]["head_revision"] == 4
    assert branches["Archived"]["deleted"] is True
    assert branches["Archived"]["recovered_creation"] is True
    assert branches["Archived"]["created_from"] == 3
    lineage = graph["lineage"]
    assert lineage[ids["file"], 5]["merge_parent_revision"] == 4
    assert lineage[ids["file"], 6]["restored_from_revision"] == 3
    assert lineage[ids["file"], 6]["parent_revision"] == 5
    assert lineage[ids["file"], 8]["parent_revision"] == 4
    assert lineage[ids["file"], 8]["merge_parent_revision"] == 6
    assert all(v["branch_id"] == branches[v["branch"]]["id"] for v in data["_named_versions"] if v["branch"] != "Main")
    comments = [r["value"] for r in data["_collaboration"]["items"] if r["collection"] == "comments" and r["value"]["branch"] != "Main"]
    assert len(comments) == 2
    assert all(c["branch_id"] == branches[c["branch"]]["id"] for c in comments)
    assert "_branch_graph" not in json.loads((snapshot / "projection.json").read_text())
    assert list(host.store.db.iterdump()) == before
    assert load(snapshot)[0]["_branch_graph"] == graph


@pytest.mark.parametrize("damage", ["origin", "head", "parent", "merge", "merge_parentless", "restore", "missing", "reused", "dangling_version", "unprovable_deleted", "root"])
def test_refuse_ambiguous_or_damaged_branch_lineage(branched, tmp_path, damage):
    root, host, _ids, _, _ = branched
    db = host.store.db
    db.execute("PRAGMA foreign_keys=OFF")
    sql = {
        "origin": "UPDATE library_branches SET created_from=1 WHERE name='Renamed'",
        "head": "UPDATE library_branches SET head_revision=6 WHERE name='Renamed'",
        "parent": "UPDATE library_history SET parent_revision=4 WHERE branch='Renamed' AND revision=9",
        "merge": "UPDATE library_history SET merge_parent_revision=99 WHERE event='merge'",
        "merge_parentless": "UPDATE library_history SET parent_revision=NULL WHERE event='merge'",
        "restore": "UPDATE library_history SET note='Restored revision 4' WHERE event='restore'",
        "missing": "DELETE FROM library_history WHERE branch='Archived'",
        "reused": "UPDATE library_branches SET created=created+100000 WHERE name='Renamed'",
        "dangling_version": "UPDATE library_versions SET branch='Unknown' WHERE name='Branch checkpoint'",
        "unprovable_deleted": "UPDATE library_history SET parent_revision=NULL WHERE branch='Archived'",
        "root": "UPDATE library_history SET branch='Renamed' WHERE revision=1",
    }[damage]
    db.execute(sql)
    db.commit()
    with pytest.raises(TransferError):
        capture(root, tmp_path / "snapshot")
    assert not (tmp_path / "snapshot").exists()


def test_real_deleted_name_reuse_is_not_silently_rebound(branched, tmp_path):
    root, _, _, call, save = branched
    call("branch_create", name="Archived", from_revision=8, expected_revision=8)
    save("Archived", 8, {"new": "unrelated work"})
    with pytest.raises(TransferError, match="reused"):
        capture(root, tmp_path / "snapshot")


def test_unrecorded_comment_rename_alias_requires_review(branched, tmp_path):
    root, _, _, call, _ = branched
    # Legacy rename rewrites revision/version labels, but not old comments.
    # The old schema retained no alias map, so do not guess based on a name.
    call("branch_rename", name="Renamed", new_name="Again", branch="Renamed", expected_revision=9)
    with pytest.raises(TransferError, match="collaboration branch"):
        capture(root, tmp_path / "snapshot")


def test_import_restore_and_continue_branch_work(branched, native, tmp_path):
    root, _, ids, _, _ = branched
    objects, dsn, psql, binary, env, pg_root = native
    snapshot = tmp_path / "snapshot"
    capture(root, snapshot)
    report = import_snapshot(snapshot, objects, "demo", dsn, psql, binary)
    assert report["branches"] == 3 and report["revisions"] == 11
    data, blobs, _ = load(snapshot)
    for h in data["library_history"]:
        h["size_bytes"] = len(blobs[h["blob_hash"]])
    sql, expected = sql_import(data, "demo")
    compare(psql, dsn, expected)
    with pytest.raises(TransferError):
        pg(psql, dsn, sql)
    compare(psql, dsn, expected)
    dump = subprocess.check_output([str(psql.parent / "pg_dump"), "--dbname", dsn, "--no-owner", "--no-privileges"], text=True)
    pg(psql, dsn, "CREATE DATABASE branch_restored")
    restored = dsn.replace("dbname=postgres", "dbname=branch_restored")
    pg(psql, restored, dump)
    compare(psql, restored, expected)
    restored_objects = pg_root / "restored-objects"
    shutil.copytree(objects, restored_objects)
    recovered_env = {**env, "AETHER_NATIVE_PG": restored, "AETHER_NATIVE_OBJECTS": str(restored_objects)}
    verified = subprocess.run([str(binary), "verify-store"], check=True, capture_output=True, env=recovered_env)
    assert json.loads(verified.stdout)["revisions"] == 11
    branches = {b["name"]: b["id"] for b in data["_branch_graph"]["branches"]}
    pg(psql, restored, "UPDATE aether_access.named_versions SET branch_id='" + branches["Empty"] + "' WHERE name='Branch checkpoint'")
    with pytest.raises(TransferError, match="named_versions"):
        compare(psql, restored, expected)
    pg(psql, restored, "UPDATE aether_access.named_versions SET branch_id='" + branches["Renamed"] + "' WHERE name='Branch checkpoint'")
    compare(psql, restored, expected)
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    origin = f"http://127.0.0.1:{port}"
    with subprocess.Popen([str(binary), "serve"], env={**recovered_env, "AETHER_NATIVE_LISTEN": f"127.0.0.1:{port}"},
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) as server:
        try:
            for _ in range(100):
                try:
                    urllib.request.urlopen(origin + "/api/status", timeout=1).close()
                    break
                except (OSError, urllib.error.URLError):
                    time.sleep(0.05)
            def request(path, data, cookie=""):
                return urllib.request.urlopen(urllib.request.Request(origin + path, data=json.dumps(data).encode(),
                    headers={"Content-Type": "application/json", "Origin": origin, "Cookie": cookie}), timeout=5)
            with request("/api/login", {"username": "owner", "password": PASSWORD}) as response:
                cookie = response.headers["Set-Cookie"].split(";", 1)[0]
            def call(action, **value):
                with request("/api/library/" + action, {"app": "map", "id": ids["file"], **value}, cookie) as response:
                    return json.load(response)
            assert call("read")["revision"] == 8
            selected = call("read", branch=branches["Renamed"])
            assert selected["revision"] == 9 and selected["branch_label"] == "Renamed"
            assert json.loads(base64.b64decode(selected["data_base64"])) == {"scene": 9}
            history = call("history")
            assert len(history["revisions"]) == 9
            assert next(r for r in history["revisions"] if r["revision"] == 6)["parent_revision"] == 5
            assert pg(psql, restored, "SELECT parent_revision IS NULL FROM aether_access.legacy_history_annotations WHERE revision=6") == "t"
            assert next(v for v in history["versions"] if v["name"] == "Retained checkpoint")["branch_id"] == branches["Archived"]
            comments = call("collaboration")["comments"]
            assert next(c for c in comments if c["text"] == "Review Archived")["branch_id"] == branches["Archived"]
            call("branch_rename", branch=branches["Renamed"], operation_id="rename-imported", expected_revision=9, new_name="Continued")
            saved = call("save", branch=branches["Renamed"], operation_id="save-imported", expected_revision=9, data_base64="e30=")
            assert saved["revision"] == 10 and saved["branch_label"] == "Continued"
            assert call("read")["revision"] == 8
            assert next(c for c in call("collaboration")["comments"] if c["text"] == "Review Renamed")["branch"] == "Continued"
            with pytest.raises(urllib.error.HTTPError) as refused:
                call("read", branch=branches["Archived"])
            assert refused.value.code == 404
        finally:
            server.terminate()
            server.wait(timeout=10)
    verified = subprocess.run([str(binary), "verify-store"], check=True, capture_output=True, env=recovered_env)
    assert json.loads(verified.stdout)["revisions"] == 12

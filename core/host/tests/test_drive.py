import base64
import pytest
from core.host.server import StudioHost
from core.host.state import Problem


@pytest.fixture
def drive(tmp_path):
    host = StudioHost(tmp_path / "data")
    users = [
        host.store.create_user(
            n, "drive-test-password-2026", "admin" if n == "owner" else "member", False
        )
        for n in ("owner", "editor", "reader")
    ]
    tokens = [
        host.store.sign_in(n, "drive-test-password-2026", "local")
        for n in ("owner", "editor", "reader")
    ]

    def call(action, data=None, who=0, library=False):
        with host.lock:
            return host.dispatch(
                ("/api/library/" if library else "/api/drive/") + action,
                data or {},
                tokens[who],
                "local",
            )

    call("context")
    return host, users, call


def create(call, **data):
    return call(
        "create",
        {
            "name": "Design.txt",
            "data_base64": base64.b64encode(b"original").decode(),
            **data,
        },
    )


def test_drive_and_editors_share_identity_and_permissions(drive):
    _, users, call = drive
    file = create(call, app="cad")
    assert call("list", who=1)["files"] == []
    call("grant", {"id": file["id"], "user": users[1], "role": "editor"})
    assert call("list", {"view": "shared"}, who=1)["files"][0]["id"] == file["id"]
    assert call("read", {"id": file["id"], "app": "cad"}, who=1, library=True)[
        "writable"
    ]
    saved = call(
        "save",
        {
            "id": file["id"],
            "app": "cad",
            "expected_revision": 1,
            "data_base64": base64.b64encode(b"edited").decode(),
        },
        who=1,
        library=True,
    )
    assert saved["revision"] == 2
    call("grant", {"id": file["id"], "user": users[1], "role": "remove"})
    with pytest.raises(Problem):
        call("read", {"id": file["id"], "app": "cad"}, who=1, library=True)


def test_organizations_workspaces_and_removal_are_enforced(drive):
    _, users, call = drive
    org = call("organization_create", {"name": "Robotics"})["id"]
    ws = call("workspace_create", {"organization": org, "name": "Train"})["id"]
    call("member_update", {"organization": org, "user": users[1], "role": "member"})
    call(
        "member_update",
        {"organization": org, "workspace": ws, "user": users[1], "role": "editor"},
    )
    file = create(call, organization=org, workspace=ws)
    assert call("read", {"id": file["id"]}, who=1)["writable"]
    with pytest.raises(Problem):
        call("list", {"organization": org}, who=2)
    call("member_update", {"organization": org, "user": users[1], "role": "remove"})
    call("context", who=1)
    with pytest.raises(Problem):
        call("read", {"id": file["id"]}, who=1)
    with pytest.raises(Problem):
        call("member_update", {"organization": org, "user": users[0], "role": "remove"})


def test_folder_inheritance_revocation_and_cycle_protection(drive):
    _, users, call = drive
    folder = call("create", {"kind": "folder", "name": "Mixed"})
    a = create(call, parent=folder["id"], app="cad")
    b = create(call, parent=folder["id"], app="map", name="Show.aethermap")
    call("grant", {"id": folder["id"], "user": users[1], "role": "viewer"})
    assert (
        len(call("list", {"view": "shared", "parent": folder["id"]}, who=1)["files"])
        == 2
    )
    with pytest.raises(Problem):
        call("rename", {"id": a["id"], "name": "No", "expected_revision": 1}, who=1)
    with pytest.raises(Problem):
        call("move", {"id": folder["id"], "destination": {"parent": folder["id"]}})
    call("grant", {"id": folder["id"], "user": users[1], "role": "remove"})
    with pytest.raises(Problem):
        call("read", {"id": b["id"]}, who=1)


def test_links_expire_and_revocation_removes_editor_access(drive):
    host, _, call = drive
    file = create(call)
    link = call("link_create", {"id": file["id"], "role": "editor", "days": 1})
    token = link["url"].split("share=")[1]
    assert call("redeem", {"token": token}, who=1)["writable"]
    call("link_revoke", {"id": file["id"], "link": link["id"]})
    with pytest.raises(Problem):
        call("read", {"id": file["id"]}, who=1)
    with pytest.raises(Problem):
        call("redeem", {"token": token}, who=2)
    assert token not in str(
        [tuple(r) for r in host.store.db.execute("SELECT * FROM drive_links")]
    )


def test_copy_move_trash_restore_and_favorites(drive):
    _, _, call = drive
    folder = call("create", {"name": "Project", "kind": "folder"})
    file = create(call, parent=folder["id"])
    call("favorite", {"id": file["id"], "favorite": True})
    assert call("list", {"view": "favorites"})["files"][0]["id"] == file["id"]
    copied = call("copy", {"id": folder["id"], "destination": {}})
    child = call("list", {"parent": copied["id"]})["files"][0]
    assert child["id"] != file["id"]
    call("trash", {"id": folder["id"]})
    with pytest.raises(Problem):
        call("read", {"id": file["id"]})
    assert call("list", {"view": "trash"})["files"][0]["id"] == folder["id"]
    call("restore", {"id": folder["id"]})
    assert (
        call("read", {"id": file["id"]})["data_base64"]
        == base64.b64encode(b"original").decode()
    )
    call("move", {"id": file["id"], "destination": {}, "name": "Moved.txt"})
    assert call("details", {"id": file["id"]})["parent"] is None
    call("trash", {"id": copied["id"]})
    call("delete_forever", {"id": copied["id"]})
    with pytest.raises(Problem):
        call("details", {"id": child["id"]})


def test_shared_editor_can_create_versions_not_manage_sharing(drive):
    _, users, call = drive
    file = create(call)
    call("grant", {"id": file["id"], "user": users[1], "role": "editor"})
    history = call("document", {"id": file["id"], "action": "history"}, who=1)
    assert history["writable"]
    assert history["versions"] == []
    with pytest.raises(Problem):
        call("grant", {"id": file["id"], "user": users[2], "role": "editor"}, who=1)


def test_resumable_upload_integrity_and_backup(drive, tmp_path):
    import hashlib
    from core.host.backup import restore

    host, _, call = drive
    payload = b"large file content\n" * 100000
    upload = call("upload_begin", {"name": "Reference.bin", "size": len(payload)})
    first = payload[: 1024 * 1024]
    result = call(
        "upload_chunk",
        {
            "upload": upload["id"],
            "offset": 0,
            "data_base64": base64.b64encode(first).decode(),
        },
    )
    assert result["offset"] == len(first)
    with pytest.raises(Problem):
        call(
            "upload_chunk", {"upload": upload["id"], "offset": 0, "data_base64": "YQ=="}
        )
    with pytest.raises(Problem):
        call("upload_status", {"upload": upload["id"]}, who=1)
    assert call("upload_status", {"upload": upload["id"]})["offset"] == len(first)
    rest = payload[len(first) :]
    call(
        "upload_chunk",
        {
            "upload": upload["id"],
            "offset": len(first),
            "data_base64": base64.b64encode(rest).decode(),
        },
    )
    with pytest.raises(Problem):
        call("upload_finish", {"upload": upload["id"], "sha256": "bad"})
    file = call(
        "upload_finish",
        {"upload": upload["id"], "sha256": hashlib.sha256(payload).hexdigest()},
    )
    assert file["size"] == len(payload)
    assert base64.b64decode(call("read", {"id": file["id"]})["data_base64"]) == payload
    with pytest.raises(Problem):
        create(
            call,
            name="Forged.json",
            data_base64=base64.b64encode(
                host.drive.row(host.store.users()[0]["id"], file["id"])["content"]
            ).decode(),
        )
    archive = host.backup()
    destination = tmp_path / "restored"
    restore(host.store.directory / "backups" / archive, destination)
    assert (
        destination / "drive/blobs" / hashlib.sha256(payload).hexdigest()
    ).read_bytes() == payload


def test_workspace_member_creation_has_shared_ownership(drive):
    _, users, call = drive
    ws = call("workspace_create", {"name": "Workshop"})["id"]
    call("member_update", {"workspace": ws, "user": users[1], "role": "editor"})
    file = call(
        "create",
        {"name": "Member notes.txt", "workspace": ws, "data_base64": "eA=="},
        who=1,
    )
    assert file["writable"] and not file["manageable"]
    assert call("details", {"id": file["id"]})["manageable"]
    call("member_update", {"workspace": ws, "user": users[1], "role": "remove"})
    with pytest.raises(Problem):
        call("read", {"id": file["id"]}, who=1)


def test_folder_sync_preserves_conflicts_and_revoked_copies(drive, tmp_path):
    from core.host.drive_sync import sync_once

    host, users, call = drive
    root = tmp_path / "sync"

    class Client:
        def call(self, action, data):
            return call(action, data)

        def download(self, entry, path):
            path.write_bytes(
                base64.b64decode(call("read", {"id": entry["id"]})["data_base64"])
            )

        def upload(self, path, destination, entry=None):
            if entry:
                return call(
                    "document",
                    {
                        "id": entry["id"],
                        "action": "save",
                        "expected_revision": entry["revision"],
                        "data_base64": base64.b64encode(path.read_bytes()).decode(),
                    },
                )
            return create(
                call,
                name=path.name,
                **destination,
                data_base64=base64.b64encode(path.read_bytes()).decode(),
            )

    client = Client()
    destination = {"organization": "default", "workspace": None, "parent": None}
    file = create(call, name="Sync.txt")
    sync_once(client, root, destination, lambda _: None)
    assert (root / "Sync.txt").read_bytes() == b"original"
    (root / "Sync.txt").write_bytes(b"local update")
    sync_once(client, root, destination, lambda _: None)
    assert (
        base64.b64decode(call("read", {"id": file["id"]})["data_base64"])
        == b"local update"
    )
    (root / "Sync.txt").write_bytes(b"conflicting local")
    call(
        "document",
        {
            "id": file["id"],
            "action": "save",
            "expected_revision": 2,
            "data_base64": base64.b64encode(b"conflicting remote").decode(),
        },
    )
    sync_once(client, root, destination, lambda _: None)
    assert (root / "Sync.txt").read_bytes() == b"conflicting remote"
    assert next(root.glob("*.local-conflict-*")).read_bytes() == b"conflicting local"
    (root / "Sync.txt").unlink()
    sync_once(client, root, destination, lambda _: None)
    assert call("list", {"view": "trash"})["files"][0]["id"] == file["id"]
    # Arbitrary missing inventory (including revoked access) must retain local data.
    other = create(call, name="Retain.txt")
    sync_once(client, root, destination, lambda _: None)
    host.store.db.execute(
        "UPDATE library SET owner=? WHERE id=?", (users[1], other["id"])
    )
    host.store.db.commit()
    sync_once(client, root, destination, lambda _: None)
    assert (root / "Retain.txt").read_bytes() == b"original"


def test_sync_and_blob_replacement_guard_remote_changes(drive):
    _, _, call = drive
    file = create(call)
    upload = call(
        "upload_begin",
        {"id": file["id"], "expected_revision": 1, "name": file["name"], "size": 3},
    )
    call("upload_chunk", {"upload": upload["id"], "offset": 0, "data_base64": "bmV3"})
    call(
        "document",
        {
            "id": file["id"],
            "action": "save",
            "expected_revision": 1,
            "data_base64": "d2Vi",
        },
    )
    with pytest.raises(Problem):
        call("upload_finish", {"upload": upload["id"]})
    assert base64.b64decode(call("read", {"id": file["id"]})["data_base64"]) == b"web"


def test_sync_rejects_paths_and_symlinks(tmp_path):
    from core.host.drive_sync import safe_file

    root = tmp_path / "local"
    root.mkdir()
    (root / "escape").symlink_to(tmp_path)
    for path in (
        "../secret",
        "/etc/passwd",
        "escape/secret",
        "a\\b",
        "C:secret",
        ".aether-drive-sync.json",
    ):
        with pytest.raises(ValueError):
            safe_file(root, path)


def test_archive_snapshot_excludes_trashed_files(drive):
    import zipfile
    from core.host.drive_download import snapshot, archive

    host, users, call = drive
    folder = create(call, name="Designs", kind="folder")
    create(call, parent=folder["id"], name="Keep.txt")
    removed = create(call, parent=folder["id"], name="Removed.txt")
    call("trash", {"id": removed["id"]})
    zip_path = archive(
        snapshot(host.drive, users[0], host.drive.row(users[0], folder["id"]))
    )
    try:
        with zipfile.ZipFile(zip_path) as result:
            assert result.namelist() == ["Designs/", "Designs/Keep.txt"]
            assert result.read("Designs/Keep.txt") == b"original"
    finally:
        zip_path.unlink()


def test_sync_folders_and_source_identity(drive, tmp_path):
    import json
    import shutil
    from core.host.drive_sync import sync_once, STATE

    _, _, call = drive

    class Client:
        identity = "host-and-user"

        def call(self, action, data):
            return call(action, data)

        def download(self, entry, path):
            path.write_bytes(
                base64.b64decode(call("read", {"id": entry["id"]})["data_base64"])
            )

        def upload(self, *args):
            raise AssertionError("Unexpected upload")

    client = Client()
    root = tmp_path / "sync"
    dest = {"organization": "default", "workspace": None, "parent": None}
    folder = create(call, kind="folder", name="Before")
    file = create(call, parent=folder["id"])
    sync_once(client, root, dest, lambda _: None)
    call("rename", {"id": folder["id"], "name": "After", "expected_revision": 1})
    sync_once(client, root, dest, lambda _: None)
    assert not (root / "Before").exists()
    assert (root / "After/Design.txt").read_bytes() == b"original"
    (root / "After").rename(root / "Local rename")
    sync_once(client, root, dest, lambda _: None)
    assert call("details", {"id": folder["id"]})["name"] == "Local rename"
    assert call("details", {"id": file["id"]})["parent"] == folder["id"]
    (root / "Local rename").rename(root / "After")
    sync_once(client, root, dest, lambda _: None)
    shutil.rmtree(root / "After")
    sync_once(client, root, dest, lambda _: None)
    assert call("list", {"view": "trash"})["files"][0]["id"] == folder["id"]
    call("restore", {"id": folder["id"]})
    sync_once(client, root, dest, lambda _: None)
    assert (root / "After/Design.txt").read_bytes() == b"original"
    state = json.loads((root / STATE).read_text())
    assert state["files"][file["id"]]["path"] == "After/Design.txt"
    client.identity = "another-user"
    with pytest.raises(ValueError, match="another Drive location"):
        sync_once(client, root, dest)


def test_workspace_roles_and_shared_folder_owner(drive):
    _, users, call = drive
    ws = call("workspace_create", {"name": "Team"})["id"]
    call("member_update", {"workspace": ws, "user": users[1], "role": "editor"})
    members = call("members", {"workspace": ws})["members"]
    assert next(m for m in members if m["id"] == users[1])["workspace_role"] == "editor"
    folder = create(call, kind="folder", name="Shared project")
    call("grant", {"id": folder["id"], "user": users[1], "role": "editor"})
    child = call(
        "create",
        {"name": "Member.txt", "parent": folder["id"], "data_base64": "eA=="},
        who=1,
    )
    assert call("details", {"id": child["id"]})["manageable"]
    call("trash", {"id": folder["id"]})
    call("restore", {"id": folder["id"]})
    assert call("details", {"id": child["id"]})["writable"]


@pytest.mark.parametrize(
    "name,app",
    [("Map.aethermap", "map"), ("Circuit.aetherio", "io"), ("Part.acpart", "cad")],
)
def test_uploaded_native_files_keep_their_editor_type(drive, name, app):
    _, _, call = drive
    upload = call("upload_begin", {"name": name, "size": 2})
    call("upload_chunk", {"upload": upload["id"], "offset": 0, "data_base64": "e30="})
    file = call("upload_finish", {"upload": upload["id"]})
    assert file["app"] == app
    assert (
        call("read", {"id": file["id"], "app": app}, library=True)["data_base64"]
        == "e30="
    )


def test_desktop_client_syncs_through_authenticated_http(drive, tmp_path, monkeypatch):
    import threading
    from http.server import ThreadingHTTPServer
    from core.host.server import make_handler
    from core.host.drive_sync import DriveClient, sync_once

    host, _, call = drive
    file = create(call, name="Connected.txt")
    server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(host))
    server.daemon_threads = True
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    monkeypatch.setattr("getpass.getpass", lambda _: "drive-test-password-2026")
    try:
        client = DriveClient(
            f"http://127.0.0.1:{server.server_port}", "owner", tmp_path / "credentials"
        )
        client.login("owner")
        root = tmp_path / "local"
        dest = {"organization": "default", "workspace": None, "parent": None}
        sync_once(client, root, dest, lambda _: None)
        assert (root / "Connected.txt").read_bytes() == b"original"
        (root / "Connected.txt").write_bytes(b"Offline changes")
        sync_once(client, root, dest, lambda _: None)
        assert (
            base64.b64decode(call("read", {"id": file["id"]})["data_base64"])
            == b"Offline changes"
        )
        assert (
            call("document", {"id": file["id"], "action": "history"})["versions"] == []
        )
        (root / "New.txt").write_bytes(b"New desktop file")
        sync_once(client, root, dest, lambda _: None)
        assert {f["name"] for f in call("list")["files"]} == {
            "Connected.txt",
            "New.txt",
        }
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


def test_individual_editor_can_replace_a_file_without_access_to_its_parent(drive):
    _, users, call = drive
    folder = create(call, kind="folder", name="Private")
    file = create(call, parent=folder["id"])
    call("grant", {"id": file["id"], "user": users[1], "role": "editor"})
    upload = call(
        "upload_begin",
        {"id": file["id"], "name": file["name"], "size": 3, "expected_revision": 1},
        who=1,
    )
    call(
        "upload_chunk",
        {"upload": upload["id"], "offset": 0, "data_base64": "bmV3"},
        who=1,
    )
    updated = call("upload_finish", {"upload": upload["id"]}, who=1)
    assert updated["id"] == file["id"]
    assert updated["revision"] == 2
    assert base64.b64decode(call("read", {"id": file["id"]})["data_base64"]) == b"new"


def test_file_table_metadata_tracks_editor_and_inherited_sharing(drive):
    _, users, call = drive
    folder = call("create", {"kind": "folder", "name": "Table folder"})
    file = create(call, parent=folder["id"])
    deleted = create(call, parent=folder["id"], name="Deleted.txt")
    call("trash", {"id": deleted["id"]})
    root = call("list")["files"][0]
    assert root["child_count"] == 1
    assert root["sharing"] == "Private"
    assert root["modified_by"] == "owner"
    call("grant", {"id": folder["id"], "user": users[1], "role": "editor"})
    child = call("create", {"name": "Team-created.txt", "parent": folder["id"],
                            "data_base64": base64.b64encode(b"team").decode()}, who=1)
    listed = call("list", {"parent": folder["id"]})["files"]
    assert next(f for f in listed if f["id"] == child["id"])["sharing"] == "Shared"
    call("save", {"id": file["id"], "app": "drive", "expected_revision": 1,
                  "data_base64": base64.b64encode(b"team edit").decode()}, who=1, library=True)
    # A later grant by the owner is activity, not a new content modifier.
    call("grant", {"id": file["id"], "user": users[2], "role": "viewer"})
    entry = call("list", {"parent": folder["id"]})["files"][0]
    assert entry["modified_by"] == "editor"
    assert entry["sharing"] == "Shared"
    assert entry["activity"]["author"] == "owner"
    assert entry["activity"]["action"] == "grant"
    assert entry["child_count"] is None
    call("grant", {"id": folder["id"], "user": users[1], "role": "remove"})
    call("grant", {"id": file["id"], "user": users[2], "role": "remove"})
    assert call("list", {"parent": folder["id"]})["files"][0]["sharing"] == "Private"


def test_file_table_sharing_ignores_expired_links_and_unknown_modifiers(drive):
    host, _, call = drive
    file = create(call)
    link = call("link_create", {"id": file["id"], "role": "viewer", "days": 1})
    assert call("list")["files"][0]["sharing"] == "Shared"
    host.store.db.execute("UPDATE drive_links SET expires=0")
    host.store.db.execute("DELETE FROM drive_events WHERE file_id=?", (file["id"],))
    host.store.db.execute("UPDATE library_history SET event='baseline' WHERE file_id=?", (file["id"],))
    host.store.db.commit()
    entry = call("list")["files"][0]
    assert entry["sharing"] == "Private"
    assert entry["modified_by"] is None
    assert entry["activity"] is None
    assert link["url"]


def test_shared_tabs_and_search_use_active_sharing_provenance(drive):
    host, users, call = drive
    folder = call("create", {"kind": "folder", "name": "Shared folder"})
    child = create(call, name="Shared child.txt", parent=folder["id"])
    private = create(call, name="Private.txt")
    call("grant", {"id": folder["id"], "user": users[1], "role": "viewer"})
    received = call("list", {"view": "shared"}, who=1)["files"]
    assert {f["id"] for f in received} == {folder["id"], child["id"]}
    assert all(f["shared_by"] == "owner" and f["shared_at"] for f in received)
    call("grant", {"id": folder["id"], "user": users[1], "role": "editor"})
    assert call("list", {"view": "shared"}, who=1)["files"][0]["shared_at"] == received[0]["shared_at"]
    sent = call("list", {"view": "shared", "shared_scope": "by"})["files"]
    assert {f["id"] for f in sent} == {folder["id"], child["id"]}
    # Search must not turn the chosen sharing scope into all accessible files.
    assert call("list", {"view": "shared", "query": "Private"})["files"] == []
    assert call("list", {"view": "shared", "shared_scope": "by", "query": "Private"})["files"] == []
    assert call("list", {"view": "shared", "query": "Shared child"}, who=1)["files"][0]["id"] == child["id"]
    call("grant", {"id": folder["id"], "user": users[1], "role": "remove"})
    assert call("list", {"view": "shared"}, who=1)["files"] == []
    assert call("list", {"view": "shared", "shared_scope": "by"})["files"] == []
    # Legacy grants still work, but no fabricated date or attribution.
    host.store.db.execute("INSERT INTO drive_grants(file_id,user_id,role) VALUES (?,?,'viewer')", (private["id"], users[1]))
    host.store.db.commit()
    legacy = call("list", {"view": "shared"}, who=1)["files"][0]
    assert legacy["shared_by"] is None and legacy["shared_at"] is None


def test_shared_link_tabs_track_redeemed_links_and_expiry(drive):
    host, _, call = drive
    file = create(call)
    link = call("link_create", {"id": file["id"], "role": "viewer", "days": 1})
    assert call("list", {"view": "shared"}, who=1)["files"] == []
    call("redeem", {"token": link["url"].split("share=")[1]}, who=1)
    received = call("list", {"view": "shared"}, who=1)["files"][0]
    assert received["shared_by"] == "owner" and received["shared_at"]
    assert call("list", {"view": "shared", "shared_scope": "by"})["files"][0]["id"] == file["id"]
    host.store.db.execute("UPDATE drive_links SET expires=0")
    host.store.db.commit()
    assert call("list", {"view": "shared"}, who=1)["files"] == []
    assert call("list", {"view": "shared", "shared_scope": "by"})["files"] == []
    with pytest.raises(Problem):
        call("list", {"view": "shared", "shared_scope": "other"})


def test_sharing_provenance_migration_preserves_legacy_records():
    import sqlite3
    from core.host.drive_sharing import migrate_sharing

    db = sqlite3.connect(":memory:")
    try:
        db.executescript("""
            CREATE TABLE drive_grants(file_id TEXT,user_id TEXT,role TEXT);
            INSERT INTO drive_grants VALUES ('file','reader','viewer');
            CREATE TABLE drive_links(id TEXT,created REAL);
            INSERT INTO drive_links VALUES ('link',123);
        """)
        migrate_sharing(db)
        migrate_sharing(db)
        assert db.execute("SELECT * FROM drive_grants").fetchone() == ("file", "reader", "viewer", None, None)
        assert db.execute("SELECT * FROM drive_links").fetchone() == ("link", 123, None)
    finally:
        db.close()


def test_recycle_metadata_preserves_creation_deletion_and_parent_location(drive):
    _, users, call = drive
    workspace = call("workspace_create", {"name": "Workshop"})["id"]
    call("member_update", {"workspace": workspace, "user": users[1], "role": "owner"})
    folder = call("create", {"kind": "folder", "name": "Documents", "workspace": workspace})
    file = create(call, name="Review.txt", parent=folder["id"])
    call("trash", {"id": file["id"]}, who=1)
    entry = call("list", {"view": "trash"})["files"][0]
    assert entry["deleted_by"] == "editor"
    assert entry["created_by"] == "owner"
    assert entry["deleted_at"] > 0
    assert entry["original_location"] == "Workshop > Documents"
    call("restore", {"id": file["id"]}, who=1)
    assert call("list", {"view": "workspace", "workspace": workspace, "parent": folder["id"]})["files"][0]["id"] == file["id"]


def test_empty_bin_uses_reviewed_ids_and_checks_every_item_before_deleting(drive):
    host, _, call = drive
    first = create(call, name="First.txt")
    second = create(call, name="Second.txt")
    call("trash", {"id": first["id"]})
    call("trash", {"id": second["id"]})
    call("restore", {"id": second["id"]})
    with pytest.raises(Problem):
        call("empty_trash", {"ids": [first["id"], second["id"]]})
    assert host.store.db.execute("SELECT 1 FROM library WHERE id=?", (first["id"],)).fetchone()
    call("trash", {"id": second["id"]})
    # Newly recycled items after confirmation are never swept into the request.
    third = create(call, name="Newly deleted.txt")
    call("trash", {"id": third["id"]})
    result = call("empty_trash", {"ids": [first["id"], second["id"]]})
    assert result["deleted"] == 2
    assert [f["id"] for f in call("list", {"view": "trash"})["files"]] == [third["id"]]
    with pytest.raises(Problem):
        call("empty_trash", {"ids": [third["id"]]}, who=1)
    assert call("list", {"view": "trash"})["files"][0]["id"] == third["id"]


def test_empty_bin_removes_folder_contents_and_validates_organization(drive):
    host, _, call = drive
    folder = call("create", {"kind": "folder", "name": "Folder"})
    child = create(call, parent=folder["id"])
    call("trash", {"id": folder["id"]})
    other = call("organization_create", {"name": "Other"})["id"]
    with pytest.raises(Problem):
        call("empty_trash", {"organization": other, "ids": [folder["id"]]})
    assert call("empty_trash", {"ids": [folder["id"]]})["deleted"] == 2
    assert not host.store.db.execute("SELECT 1 FROM library WHERE id IN (?,?)", (folder["id"], child["id"])).fetchone()


def test_restore_requires_all_containing_folders_to_be_live(drive):
    _, _, call = drive
    top = call("create", {"kind": "folder", "name": "Top"})
    nested = call("create", {"kind": "folder", "name": "Nested", "parent": top["id"]})
    file = create(call, parent=nested["id"])
    call("trash", {"id": file["id"]})
    call("trash", {"id": top["id"]})
    with pytest.raises(Problem, match="Restore the containing folder first"):
        call("restore", {"id": file["id"]})
    call("restore", {"id": top["id"]})
    with pytest.raises(Problem):
        call("read", {"id": file["id"]})
    call("restore", {"id": file["id"]})
    assert call("read", {"id": file["id"]})["parent"] == nested["id"]


def test_each_organization_gets_one_default_workspace_and_preserves_legacy_access(drive):
    host, users, call = drive
    original = call("context")
    default = next(w for w in original["workspaces"] if w["organization"] == "default" and w["is_default"])
    assert default["id"] == "shared"
    org = call("organization_create", {"name": "Robotics"})["id"]
    call("member_update", {"organization": org, "user": users[1], "role": "member"})
    workspaces = [w for w in call("context", who=1)["workspaces"] if w["organization"] == org]
    assert len(workspaces) == 1
    workspace = workspaces[0]
    assert workspace["name"] == "Robotics" and workspace["is_default"]
    assert workspace["role"] == "viewer"
    file = create(call, organization=org, workspace=workspace["id"])
    assert call("read", {"id": file["id"]}, who=1)["writable"] is False
    with pytest.raises(Problem):
        create(lambda action, data: call(action, data, who=1), organization=org, workspace=workspace["id"])
    call("member_update", {"organization": org, "workspace": workspace["id"], "user": users[1], "role": "editor"})
    assert call("read", {"id": file["id"]}, who=1)["writable"]
    call("member_update", {"organization": org, "user": users[1], "role": "remove"})
    assert not any(w["organization"] == org for w in call("context", who=1)["workspaces"])
    for _ in range(3):
        call("context")
    assert host.store.db.execute("SELECT COUNT(*) FROM drive_org_workspaces WHERE organization=?", (org,)).fetchone()[0] == 1
    # An explicitly revoked legacy workspace membership is not re-enrolled.
    call("member_update", {"workspace": "shared", "user": users[1], "role": "remove"})
    assert not any(w["id"] == "shared" for w in call("context", who=1)["workspaces"])


@pytest.mark.parametrize("transport", [{}, {"operation_id": "native-client-compatibility"}])
def test_workspace_favorites_and_recents_are_personal_and_permission_checked(drive, transport):
    _, users, call = drive
    workspace = call("workspace_create", {"name": "Project"})["id"]
    with pytest.raises(Problem):
        call("workspace_favorite", {"workspace": workspace, "favorite": True, **transport}, who=1)
    call("member_update", {"workspace": workspace, "user": users[1], "role": "viewer"})
    call("workspace_favorite", {"workspace": workspace, "favorite": True, **transport}, who=1)
    call("workspace_open", {"workspace": workspace, **transport}, who=1)
    mine = next(w for w in call("context", who=1)["workspaces"] if w["id"] == workspace)
    other = next(w for w in call("context")["workspaces"] if w["id"] == workspace)
    assert mine["favorite"] and mine["opened"] > 0
    assert not other["favorite"] and other["opened"] is None
    call("member_update", {"workspace": workspace, "user": users[1], "role": "remove"})
    assert not any(w["id"] == workspace for w in call("context", who=1)["workspaces"])
    with pytest.raises(Problem):
        call("workspace_open", {"workspace": workspace, **transport}, who=1)


def test_organization_default_backfill_does_not_move_existing_workspace_files(drive):
    host, users, call = drive
    db = host.store.db
    db.execute("INSERT INTO drive_organizations VALUES ('legacy-org','Legacy team',0)")
    db.execute("INSERT INTO drive_members VALUES ('legacy-org',?,'owner')", (users[0],))
    db.execute("INSERT INTO drive_workspaces VALUES ('legacy-project','legacy-org','Project',0)")
    db.execute("INSERT INTO library(id,owner,app,scope,name,kind,content,created,modified) VALUES ('legacy-file',?,'drive','workspace','Original.txt','file',?,0,0)", (users[0], b"original content"))
    db.execute("INSERT INTO drive_locations VALUES ('legacy-file','legacy-org','legacy-project')")
    db.commit()
    spaces = [w for w in call("context")["workspaces"] if w["organization"] == "legacy-org"]
    assert len(spaces) == 2
    default = next(w for w in spaces if w["is_default"])
    assert default["name"] == "Legacy team" and default["id"] != "legacy-project"
    assert next(w for w in spaces if w["id"] == "legacy-project")["name"] == "Project"
    original = call("read", {"id": "legacy-file"})
    assert original["workspace"] == "legacy-project"
    assert base64.b64decode(original["data_base64"]) == b"original content"


def test_administration_is_separate_from_file_membership(drive):
    host, users, call = drive
    org = call('organization_create', {'name': 'Admin-only setup'})['id']
    call('member_update', {'organization': org, 'user': users[1], 'role': 'owner'})
    # Even an organization owner uses the Admin Center only with a server admin role.
    for action, data in [
        ('administration', {}),
        ('workspace_create', {'organization': org, 'name': 'Unauthorized'}),
        ('member_update', {'organization': org, 'user': users[2], 'role': 'member'}),
    ]:
        with pytest.raises(Problem) as failure:
            call(action, data, who=1)
        assert failure.value.status == 403
    # Server administrators can manage all organizations without gaining file access.
    call('member_update', {'organization': org, 'user': users[0], 'role': 'remove'})
    result = call('administration')
    assert org in {item['id'] for item in result['organizations']}
    ws = call('workspace_create', {'organization': org, 'name': 'Managed space'})['id']
    assert ws in {item['id'] for item in call('administration')['workspaces']}
    assert org not in {item['id'] for item in call('context')['organizations']}
    call('member_update', {'organization': org, 'user': users[2], 'role': 'member'})
    assert users[2] in {item['id'] for item in call('members', {'organization': org})['members']}


def test_all_organizations_listing_and_recycle_keep_file_access_checks(drive):
    host, users, call = drive
    org = call('organization_create', {'name': 'Second organization'})['id']
    first = create(call, name='Personal first.txt')
    second = create(call, name='Personal second.txt', organization=org)
    outsider = create(lambda action, data: call(action, data, who=1), name='Someone else.txt')
    result = call('list', {'organization': 'all', 'view': 'personal'})['files']
    assert {first['id'], second['id']} <= {item['id'] for item in result}
    assert outsider['id'] not in {item['id'] for item in result}
    assert second['id'] not in {item['id'] for item in call('list', {'organization': 'all', 'view': 'search', 'query': 'Personal'}, who=1)['files']}
    for item in (first, second):
        call('trash', {'id': item['id']})
    assert len(call('list', {'organization': 'all', 'view': 'trash'})['files']) == 2
    call('empty_trash', {'organization': 'all', 'ids': [first['id'], second['id']]})
    assert not call('list', {'organization': 'all', 'view': 'trash'})['files']
    assert host.store.db.execute("SELECT organization FROM drive_events WHERE action='delete_forever' AND detail='Personal second.txt'").fetchone()[0] == org


def test_activity_can_be_read_for_one_file(drive):
    """A details pane asks for one file's history, not the organization's feed."""
    _, _, call = drive
    first = create(call, name="Watched.txt")
    second = create(call, name="Other.txt")
    call("rename", {"id": first["id"], "name": "Watched again.txt", "expected_revision": 1})
    call("rename", {"id": second["id"], "name": "Other renamed.txt", "expected_revision": 1})
    everything = call("activity")["events"]
    assert {e["file_id"] for e in everything} == {first["id"], second["id"]}
    one = call("activity", {"file": first["id"]})["events"]
    assert [e["file_id"] for e in one] == [first["id"], first["id"]]
    # Newest first, so a pane shows the latest change at the top.
    assert one[0]["action"] == "rename"
    assert one[0]["author"] == "owner"

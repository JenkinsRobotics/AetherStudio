"""Upgraded browser payloads remain usable before the native host cutover."""

import pytest

from core.host.server import StudioHost
from core.host.state import Problem


@pytest.mark.parametrize("app", ["map", "cad"])
def test_operation_ids_do_not_break_existing_editor_file_calls(tmp_path, app):
    host = StudioHost(tmp_path / "private-fixture")
    password = "transport-fixture-password-only"
    host.store.create_user("editor", password, "admin", False)
    token = host.store.sign_in("editor", password, "local")

    def call(action, **payload):
        with host.lock:
            return host.dispatch(
                "/api/library/" + action, {"app": app, **payload}, token, "local"
            )

    created = call(
        "create", operation_id="create-fixture", kind="file", scope="personal",
        name="Document", data_base64="e30=",
    )
    assert created["revision"] == 1
    assert created["writable"] is True
    opened = call("read", id=created["id"], branch="Main")
    assert opened["data_base64"] == "e30="
    saved = call(
        "save", operation_id="save-fixture", id=created["id"],
        expected_revision=1, branch="Main", data_base64="eyJhIjoxfQ==",
    )
    assert saved["revision"] == 2
    renamed = call(
        "rename", operation_id="rename-fixture", id=created["id"],
        expected_revision=2, name="Renamed",
    )
    assert renamed["revision"] == 3
    assert renamed["name"] == "Renamed"
    with pytest.raises(Problem) as conflict:
        call("save", operation_id="stale-fixture", id=created["id"], expected_revision=1, data_base64="e30=")
    assert conflict.value.status == 409
    restored = call("restore", operation_id="restore-fixture", id=created["id"], expected_revision=3, revision=1, branch="Main")
    assert restored == {"ok": True, "revision": 4, "branch": "Main"}
    reopened = call("read", id=created["id"])
    assert reopened["name"] == "Renamed" and reopened["data_base64"] == "e30="
    old = call("read_revision", id=created["id"], revision=3)
    assert old["name"] == "Renamed" and old["data_base64"] == "eyJhIjoxfQ=="
    history = call("history", id=created["id"])
    assert len(history["revisions"]) == 4
    assert history["revisions"][0]["note"] == "Restored revision 1"
    with pytest.raises(Problem) as conflict:
        call("restore", operation_id="restore-stale", id=created["id"], expected_revision=3, revision=1, branch="Main")
    assert conflict.value.status == 409
    checkpoint = call("version", operation_id="checkpoint", id=created["id"], expected_revision=4,
                      branch="Main", name=" V1 ", message=" First checkpoint ")
    assert checkpoint == {"ok": True, "revision": 4}
    versions = call("history", id=created["id"])["versions"]
    assert len(versions) == 1 and versions[0]["name"] == "V1"
    assert versions[0]["message"] == "First checkpoint"
    assert call("version_update", operation_id="rename-checkpoint", id=created["id"],
                expected_revision=4, name="V1", new_name="V2") == {"ok": True, "name": "V2"}
    assert call("history", id=created["id"])["versions"][0]["message"] == "First checkpoint"
    assert call("version_delete", operation_id="delete-checkpoint", id=created["id"],
                expected_revision=4, name="V2") == {"ok": True}
    assert call("history", id=created["id"])["versions"] == []
    assert call("read", id=created["id"])["revision"] == 4
    call("version", operation_id="release-label", id=created["id"], expected_revision=4,
         name="Release review", branch="Main")
    for status in ("candidate", "version", "candidate", "released", "obsolete"):
        prior = call("history", id=created["id"])["versions"][0]
        result = call("version_status", operation_id="release-" + status,
                      id=created["id"], name=prior["name"], expected_revision=4,
                      expected_status=prior["status"],
                      expected_status_updated=prior["status_updated"], status=status,
                      note="Superseded after review" if status == "obsolete" else "")
        assert result == {"ok": True, "status": status}
    assert call("read", id=created["id"])["revision"] == 4
    assert len(call("history", id=created["id"])["revisions"]) == 4


@pytest.mark.parametrize("app", ["map", "cad"])
def test_existing_home_listing_contract(tmp_path, app):
    """Pin the home payload semantics also exercised by native HTTP tests."""
    host = StudioHost(tmp_path / "private-list-fixture")
    password = "listing-fixture-password-only"
    host.store.create_user("editor", password, "admin", False)
    token = host.store.sign_in("editor", password, "local")

    def call(action, **payload):
        with host.lock:
            return host.dispatch(
                "/api/library/" + action, {"app": app, **payload}, token, "local"
            )

    folder = call("create", kind="folder", scope="personal", name="Models")
    root = call("create", name="Show", scope="personal", data_base64="e30=")
    nested = call(
        "create", name="Nested Show", scope="personal", parent=folder["id"],
        data_base64="e30=",
    )

    def ids(**payload):
        return [f["id"] for f in call("list", **payload)["files"]]

    assert ids(view="personal", parent=None, query="") == [folder["id"], root["id"]]
    assert ids(view="personal", parent=folder["id"], query="") == [nested["id"]]
    assert ids(view="personal", parent=None, query="  SHOW  ") == [nested["id"], root["id"]]
    assert ids(view="recent", parent=None, query="") == [nested["id"], root["id"]]
    call("read", id=root["id"])
    assert ids(view="recent", parent=None, query="") == [root["id"], nested["id"]]
    call("rename", id=nested["id"], expected_revision=1, name="100%_Show")
    assert ids(view="recent", parent=None, query="") == [root["id"], nested["id"]]
    assert ids(view="personal", parent=None, query="%_") == [nested["id"]]
    assert ids(view="workspace", parent=None, query="") == []
    assert all("data_base64" not in row for row in call("list")["files"])


def test_application_catalog_preserves_legacy_names_paths_and_preview_flags():
    from core.host.projects import project_path
    from core.host.server import APPLICATION_CATALOG, COMING_SOON_APPS, PACKAGES, REPO

    ids = [app["id"] for app in APPLICATION_CATALOG]
    assert ids == ["drive", "io", "cad", "animation", "ui", "map", "sketch", "vector"]
    assert len(set(ids)) == len(ids)
    assert COMING_SOON_APPS == {"sketch", "vector"}
    assert [app["id"] for app in APPLICATION_CATALOG if app["admin_only"]] == ["ui"]
    for app in APPLICATION_CATALOG:
        name, description, path = PACKAGES[app["id"]]
        assert name == app["name"] and description == app["description"]
        expected = (REPO / "core/ui/dist" if app["id"] == "ui" else
                    project_path(app["id"]) / ("web/dist" if app["id"] == "animation" else "dist"))
        assert path == expected


@pytest.mark.parametrize("app", ["map", "cad"])
def test_legacy_history_and_revision_read_shapes(tmp_path, app):
    host = StudioHost(tmp_path / "history-fixture")
    password = "history-fixture-password-only"
    host.store.create_user("editor", password, "admin", False)
    token = host.store.sign_in("editor", password, "local")
    def call(action, **payload):
        return host.dispatch("/api/library/" + action, {"app": app, **payload}, token, "local")
    try:
        file = call("create", kind="file", name="Before", data_base64="e30=")
        call("save", id=file["id"], expected_revision=1, data_base64="eyJhIjoyfQ==")
        call("rename", id=file["id"], expected_revision=2, name="After")
        value = call("history", id=file["id"], branch="Main")
        assert set(value) == {"writable", "scope", "revisions", "versions", "branches"}
        assert [r["revision"] for r in value["revisions"]] == [3, 2, 1]
        assert all(set(r) == {"revision", "name", "saved", "event", "note", "blob_hash", "branch", "parent_revision", "merge_parent_revision", "author"} for r in value["revisions"])
        assert value["branches"] == [{"name": "Main", "head_revision": 3, "created_from": None, "created": None}]
        assert call("read_revision", id=file["id"], revision=1) == {"id": file["id"], "name": "Before", "revision": 1, "data_base64": "e30=", "writable": False}
        assert call("read", id=file["id"])["revision"] == 3
    finally:
        host.store.db.close()


def test_legacy_file_favorite_accepts_new_transport_operation_ids_without_revising_file(tmp_path):
    host = StudioHost(tmp_path / "favorite-compatibility")
    password = "favorite-compatibility-password-only"
    host.store.create_user("editor", password, "admin", False)
    token = host.store.sign_in("editor", password, "local")
    try:
        file = host.dispatch("/api/library/create", {"app":"map","name":"Favorite fixture","data_base64":"e30="}, token, "local")
        for favorite in (True, False):
            result = host.dispatch("/api/drive/favorite", {"id":file["id"],"favorite":favorite,"operation_id":"star" if favorite else "unstar"}, token, "local")
            assert result == {"ok":True}
            listing = host.dispatch("/api/drive/list", {"view":"favorites"}, token, "local")
            assert bool(listing["files"]) is favorite
        assert host.dispatch("/api/library/read", {"app":"map","id":file["id"]}, token, "local")["revision"] == 1
    finally:
        host.store.db.close()

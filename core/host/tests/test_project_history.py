import base64
import pytest
from core.host.state import Problem
from core.host.tests.test_library import create
from aether_animation.aether_workspace import AetherWorkspace

pytest_plugins = ["core.host.tests.test_library"]


def test_history_restore_retains_future_and_current_permissions(library):
    host, _, _, _, call = library
    f = create(call)
    call("save", {"id": f["id"], "expected_revision": 1, "data_base64": "bmV3"})
    call("version", {"id": f["id"], "expected_revision": 2, "name": "Design review"})
    call("restore", {"id": f["id"], "expected_revision": 2, "revision": 1})
    assert (
        call("read", {"id": f["id"]})["data_base64"]
        == base64.b64encode(b"original").decode()
    )
    assert (
        call("read_revision", {"id": f["id"], "revision": 2})["data_base64"] == "bmV3"
    )
    history = call("history", {"id": f["id"]})
    assert [r["revision"] for r in history["revisions"]] == [3, 2, 1]
    assert history["versions"][0]["revision"] == 2
    assert (
        host.store.db.execute("SELECT count(*) FROM library_blobs").fetchone()[0] == 2
    )
    with pytest.raises(Problem):
        call("read_revision", {"id": f["id"], "revision": 1}, who=1)
    with pytest.raises(Problem) as err:
        call("restore", {"id": f["id"], "expected_revision": 2, "revision": 1})
    assert err.value.status == 409


def test_project_parts_assemblies_roundtrip_and_restore(library):
    _, _, _, _, call = library
    f = call("project_create", {"name": "Wheel project"})
    p = call("project_read", {"id": f["id"]})["project"]
    assert len(p["parts"]) == len(p["assemblies"]) == 1
    first = p["parts"][0]
    assert first["document"]["documentId"] == first["id"]
    call(
        "project_edit",
        {
            "id": f["id"],
            "expected_revision": 1,
            "operation": "add_part",
            "name": "Axle",
        },
    )
    p = call(
        "project_edit",
        {
            "id": f["id"],
            "expected_revision": 2,
            "operation": "add_assembly",
            "name": "Wheel assembly",
        },
    )["project"]
    assert len(p["parts"]) == len(p["assemblies"]) == 2
    assert p["parts"][0] == first
    archive = base64.b64decode(call("read", {"id": f["id"]})["data_base64"])
    reopened = AetherWorkspace.from_bytes(archive)
    assert len(reopened.part_definitions) == 2
    call("restore", {"id": f["id"], "expected_revision": 3, "revision": 1})
    assert len(call("project_read", {"id": f["id"]})["project"]["parts"]) == 1
    assert (
        len(call("project_read", {"id": f["id"], "revision": 3})["project"]["parts"])
        == 2
    )
    with pytest.raises(Problem):
        call(
            "project_edit",
            {"id": f["id"], "expected_revision": 4, "operation": "add_part"},
            who=1,
        )


def test_linked_part_pins_revision_and_export_retains_snapshot(library):
    import json

    _, _, _, _, call = library
    doc = {
        "format": "aether-part",
        "formatVersion": 3,
        "documentId": "source",
        "name": "Wheel",
        "units": "millimeter",
        "features": [],
    }
    source = create(
        call,
        name="Wheel.acpart",
        data_base64=base64.b64encode(json.dumps(doc).encode()).decode(),
    )
    project = call("project_create", {"name": "Linked wheel"})
    linked = call(
        "project_edit",
        {
            "id": project["id"],
            "expected_revision": 1,
            "operation": "link_part",
            "source_id": source["id"],
            "source_revision": 1,
        },
    )["project"]
    part = linked["parts"][-1]
    assert part["source"]["asset_ref"].endswith("@1")
    call(
        "save",
        {
            "id": source["id"],
            "expected_revision": 1,
            "data_base64": base64.b64encode(
                json.dumps({**doc, "name": "Changed source"}).encode()
            ).decode(),
        },
    )
    assert (
        call("project_read", {"id": project["id"]})["project"]["parts"][-1]["document"][
            "name"
        ]
        == "Wheel"
    )
    with pytest.raises(Problem):
        call(
            "project_edit",
            {
                "id": project["id"],
                "expected_revision": 2,
                "operation": "save_part",
                "part_id": part["id"],
                "document": doc,
            },
        )
    assembly = linked["assemblies"][0]
    call(
        "project_edit",
        {
            "id": project["id"],
            "expected_revision": 2,
            "operation": "insert_part",
            "part_id": part["id"],
            "assembly_id": assembly["id"],
            "name": "Wheel instance",
        },
    )
    archive = AetherWorkspace.from_bytes(
        base64.b64decode(call("read", {"id": project["id"]})["data_base64"])
    )
    assert next(iter(archive.instances.values()))["definition_id"] == part["id"]
    assert archive.part_definitions[part["id"]]["feature_document"]["name"] == "Wheel"


def test_standalone_assembly_uses_same_container_and_explicit_link_update(library):
    import json

    _, _, _, _, call = library
    assembly = call(
        "project_create", {"name": "Independent assembly", "packaging": "assembly"}
    )
    assert assembly["name"].endswith(".acasm")
    assert not call("project_read", {"id": assembly["id"]})["project"]["parts"]
    doc = {
        "format": "aether-part",
        "formatVersion": 3,
        "documentId": "standalone",
        "name": "Original",
        "units": "millimeter",
        "features": [],
    }
    source = create(
        call,
        name="Original.acpart",
        data_base64=base64.b64encode(json.dumps(doc).encode()).decode(),
    )
    linked = call(
        "project_edit",
        {
            "id": assembly["id"],
            "expected_revision": 1,
            "operation": "link_part",
            "source_id": source["id"],
            "source_revision": 1,
        },
    )["project"]["parts"][0]
    call(
        "save",
        {
            "id": source["id"],
            "expected_revision": 1,
            "data_base64": base64.b64encode(
                json.dumps({**doc, "name": "Updated"}).encode()
            ).decode(),
        },
    )
    updated = call(
        "project_edit",
        {
            "id": assembly["id"],
            "expected_revision": 2,
            "operation": "update_link",
            "part_id": linked["id"],
            "source_id": source["id"],
            "source_revision": 2,
        },
    )["project"]["parts"][0]
    assert updated["id"] == linked["id"]
    assert updated["document"]["name"] == "Updated"
    assert updated["source"]["asset_ref"].endswith("@2")
    old = call("project_read", {"id": assembly["id"], "revision": 2})["project"][
        "parts"
    ][0]
    assert old["document"]["name"] == "Original"


def test_project_edits_on_a_branch_leave_main_unchanged(library):
    _, _, _, _, call = library
    file = call('project_create', {'name': 'Branch project'})
    call('branch_create', {'id': file['id'], 'name': 'Design B', 'expected_revision': 1})
    changed = call('project_edit', {'id': file['id'], 'branch': 'Design B', 'expected_revision': 1, 'operation': 'add_part', 'name': 'Branch-only bracket'})
    assert changed['revision'] == 2
    main = call('project_read', {'id': file['id']})
    branch = call('project_read', {'id': file['id'], 'branch': 'Design B'})
    assert len(main['project']['parts']) == 1
    assert len(branch['project']['parts']) == 2
    assert branch['revision'] == 2 and main['revision'] == 1
    with pytest.raises(Problem) as exc:
        call('project_edit', {'id': file['id'], 'branch': 'Design B', 'expected_revision': 1, 'operation': 'add_part', 'name': 'Stale part'})
    assert exc.value.status == 409


def test_branch_description_persists_without_creating_a_version(library):
    host, _, _, _, call = library
    f = create(call)
    call("branch_create", {"id": f["id"], "name": "Experiment", "message": "  Try new mounting  ", "expected_revision": 1, "from_revision": 1})
    history = call("history", {"id": f["id"]})
    assert history["versions"] == []
    assert len(history["revisions"]) == 1
    assert next(b for b in history["branches"] if b["name"] == "Experiment")["message"] == "Try new mounting"
    call("branch_rename", {"id": f["id"], "name": "Experiment", "new_name": "Mounting", "expected_revision": 1})
    assert next(b for b in call("history", {"id": f["id"]})["branches"] if b["name"] == "Mounting")["message"] == "Try new mounting"
    with pytest.raises(Problem) as error:
        call("branch_create", {"id": f["id"], "name": "Too long", "message": "x" * 501, "expected_revision": 1})
    assert error.value.status == 400


def test_document_release_states_are_guarded_and_do_not_make_saves(library):
    _, _, _, _, call = library
    f = create(call)
    fid = f["id"]
    call("version", {"id": fid, "expected_revision": 1, "name": "Reviewed"})
    def version():
        return call("history", {"id": fid})["versions"][0]
    def transition(status, note="", **extra):
        current = version()
        return call("version_status", {"id": fid, "name": "Reviewed", "expected_revision": 1,
                    "expected_status": current["status"], "expected_status_updated": current["status_updated"],
                    "status": status, "note": note, **extra})
    with pytest.raises(Problem):
        transition("released")
    transition("candidate")
    candidate = version()
    for action in ("version_delete", "version_update"):
        with pytest.raises(Problem) as error:
            call(action, {"id": fid, "name": "Reviewed", "new_name": "Wrong", "expected_revision": 1})
        assert error.value.status == 409
    transition("version")
    transition("candidate")
    with pytest.raises(Problem) as error:
        transition("released", expected_status_updated=candidate["status_updated"])
    assert error.value.status == 409
    transition("released")
    with pytest.raises(Problem):
        transition("obsolete")
    transition("obsolete", "Superseded by a new connector")
    assert version()["status_note"] == "Superseded by a new connector"
    with pytest.raises(Problem):
        transition("version")
    history = call("history", {"id": fid})
    assert len(history["revisions"]) == len(history["versions"]) == 1
    assert history["versions"][0]["revision"] == 1


def test_release_state_requires_owner_and_current_head(library):
    _, _, _, _, call = library
    fid = create(call)["id"]
    call("version", {"id": fid, "name": "V1", "expected_revision": 1})
    call("share", {"id": fid, "scope": "workspace", "expected_revision": 1})
    head = call("history", {"id": fid})["branches"][0]["head_revision"]
    request = {"id": fid, "name": "V1", "expected_revision": head, "expected_status": "version", "expected_status_updated": 0, "status": "candidate"}
    with pytest.raises(Problem) as error:
        call("version_status", request, who=1)
    assert error.value.status == 403
    call("save", {"id": fid, "expected_revision": head, "data_base64": "bmV3"})
    with pytest.raises(Problem) as error:
        call("version_status", request)
    assert error.value.status == 409


def test_explicit_merge_checkpoints_are_distinct_from_autosaves(library):
    _, _, _, _, call = library
    fid = create(call)["id"]
    call("branch_create", {"id": fid, "name": "Experiment", "expected_revision": 1})
    # A named version at a fork belongs to the new branch even before its first save.
    call("version", {"id": fid, "name": "Fork", "branch": "Experiment", "expected_revision": 1})
    assert call("history", {"id": fid})["versions"][0]["branch"] == "Experiment"
    call("save", {"id": fid, "branch": "Experiment", "expected_revision": 1, "data_base64": "bmV3"})
    assert len(call("history", {"id": fid})["versions"]) == 1
    result = call("merge", {"id": fid, "source": "Experiment", "expected_revision": 1})
    h = call("history", {"id": fid})
    automatic = [v for v in h["versions"] if v["origin"] == "automatic"]
    assert len(automatic) == 1
    assert automatic[0]["revision"] == result["revision"]
    call("merge", {"id": fid, "source": "Experiment", "expected_revision": result["revision"]})
    assert len(call("history", {"id": fid})["versions"]) == 2

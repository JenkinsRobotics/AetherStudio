import base64
import json
from pathlib import Path

import pytest
from aether_cad_service.document import CADDocument, defaults

from core.host.projects import project_path
from core.host.state import Problem

pytest_plugins = ("core.host.tests.test_library",)


def native(call):
    content = (
        project_path("cad") / "examples/Train-Cart-Wheel.acpart"
    ).read_bytes()
    return call(
        "create",
        {"name": "Wheel.acpart", "data_base64": base64.b64encode(content).decode()},
    )


def edit(call, file, operation, **data):
    return call(
        "cad_operation",
        {
            "id": file["id"],
            "expected_revision": file["revision"],
            "operation": operation,
            **data,
        },
    )


def test_settings_are_portable_revisioned_and_authorized(library):
    _, _, _, _, call = library
    file = native(call)
    file = edit(
        call, file, "details", description="Wheel specification", revisionManaged=False
    )
    units = defaults()["units"]
    units["length"] = {"unit": "in", "decimals": 4}
    file = edit(call, file, "units", units=units)
    meta = call("cad_metadata", {"id": file["id"]})
    assert meta["settings"]["description"] == "Wheel specification"
    assert meta["settings"]["units"]["length"]["unit"] == "in"
    call("version", {"id": file["id"], "expected_revision": file["revision"], "name": "V1"})
    assert len(call("history", {"id": file["id"]})["revisions"]) == 3
    old = call("cad_metadata", {"id": file["id"], "revision": 1})
    assert old["settings"]["description"] == "" and not old["writable"]
    with pytest.raises(Problem):
        edit(call, file, "details", description="x", revisionManaged=True, revision=1)
    with pytest.raises(Problem):
        call(
            "cad_operation",
            {
                "id": file["id"],
                "operation": "rename",
                "name": "No",
                "expected_revision": 1,
            },
        )
    file = call(
        "share",
        {"id": file["id"], "expected_revision": file["revision"], "scope": "workspace"},
    )
    with pytest.raises(Problem):
        call(
            "cad_operation",
            {
                "id": file["id"],
                "operation": "rename",
                "name": "No",
                "expected_revision": file["revision"],
            },
            who=1,
        )
    snapshot = call("read", {"id": file["id"]})
    assert (
        CADDocument(base64.b64decode(snapshot["data_base64"])).settings["units"]
        == units
    )


def test_move_copy_rename_and_body_properties(library):
    _, _, _, _, call = library
    file = native(call)
    folder = call("create", {"kind": "folder", "name": "Wheels"})
    file = edit(call, file, "move", parent=folder["id"])
    assert file["parent"] == folder["id"]
    file = edit(call, file, "rename", name="Train wheel")
    assert file["name"] == "Train wheel.acpart"
    meta = call("cad_metadata", {"id": file["id"]})
    body = next(i for i in meta["items"] if i["kind"] == "body")
    file = edit(
        call,
        file,
        "properties",
        item_id=body["id"],
        name="Wheel body",
        description="Machined",
        category="Wheel",
    )
    copy = edit(call, file, "copy", name="Wheel variant", parent=folder["id"])
    assert copy["id"] != file["id"] and copy["parent"] == folder["id"]
    assert len(call("history", {"id": copy["id"]})["revisions"]) == 1
    assert (
        next(
            i
            for i in call("cad_metadata", {"id": copy["id"]})["items"]
            if i["kind"] == "body"
        )["description"]
        == "Machined"
    )
    before = call("read", {"id": file["id"]})["data_base64"]
    with pytest.raises(Problem):
        edit(call, file, "units", units={"length": {"unit": "bad", "decimals": 3}})
    assert call("read", {"id": file["id"]})["data_base64"] == before


def test_project_deleted_tabs_restore_and_settings_roundtrip(library):
    _, _, _, _, call = library
    file = call("project_create", {"name": "Wheel project"})
    project = call("project_read", {"id": file["id"]})["project"]
    part = project["parts"][0]["id"]
    file = edit(
        call,
        file,
        "properties",
        item_id="workspace",
        name="Development",
        description="Working model",
        category="Workspace",
    )
    file = edit(call, file, "delete_item", item_id=part)
    meta = call("cad_metadata", {"id": file["id"]})
    assert meta["deleted"][0]["id"] == part
    assert not any(i["id"] == part for i in meta["items"])
    file = edit(call, file, "restore_item", item_id=part)
    meta = call("cad_metadata", {"id": file["id"]})
    assert not meta["deleted"] and any(i["id"] == part for i in meta["items"])
    assert meta["settings"]["workspaceName"] == "Development"
    # Engine project edits must not discard metadata.
    file = call(
        "project_edit",
        {
            "id": file["id"],
            "expected_revision": file["revision"],
            "operation": "add_part",
            "name": "Extra",
        },
    )
    assert (
        call("cad_metadata", {"id": file["id"]})["settings"]["workspaceName"]
        == "Development"
    )


def test_upgrade_legacy_feature_version(library):
    _, _, _, _, call = library
    data = {
        "format": "aether-part",
        "formatVersion": 1,
        "documentId": "legacy",
        "name": "Legacy",
        "units": "millimeter",
        "features": [],
    }
    file = call(
        "create",
        {
            "name": "Legacy.acpart",
            "data_base64": base64.b64encode(json.dumps(data).encode()).decode(),
        },
    )
    assert call("cad_metadata", {"id": file["id"]})["upgradeNeeded"]
    file = edit(
        call,
        file,
        "update",
        parts=[],
        upgraded_documents={"part": {**data, "formatVersion": 3}},
    )
    assert not call("cad_metadata", {"id": file["id"]})["upgradeNeeded"]


def test_link_updates_are_explicit_and_deleted_dependencies_are_rejected(library):
    _, _, _, _, call = library
    source = native(call)
    project = call("project_create", {"name": "Linked wheel"})
    project = call(
        "project_edit",
        {
            "id": project["id"],
            "expected_revision": project["revision"],
            "operation": "link_part",
            "source_id": source["id"],
            "source_revision": source["revision"],
        },
    )
    part_id = next(
        p["id"] for p in project["project"]["parts"] if p["source"]["kind"] == "linked"
    )
    source = edit(
        call,
        source,
        "properties",
        item_id="part",
        name="Updated wheel",
        description="New source",
        category="Part",
        quantities={"mass": 0.45359237},
    )
    meta = call("cad_metadata", {"id": project["id"]})
    assert (
        meta["updates"][0]["latest"] == source["revision"]
        and meta["updates"][0]["current"] == 1
    )
    project = edit(call, project, "update", parts=[part_id])
    graph = call("project_read", {"id": project["id"]})["project"]
    assert (
        next(p for p in graph["parts"] if p["id"] == part_id)["document"]["name"]
        == "Updated wheel"
    )
    project = call(
        "project_edit",
        {
            "id": project["id"],
            "expected_revision": project["revision"],
            "operation": "insert_part",
            "part_id": part_id,
            "assembly_id": graph["assemblies"][0]["id"],
            "name": "Wheel",
        },
    )
    with pytest.raises(Problem):
        edit(call, project, "delete_item", item_id=part_id)
    assert any(
        p["id"] == part_id
        for p in call("project_read", {"id": project["id"]})["project"]["parts"]
    )
    assert (
        call("cad_metadata", {"id": source["id"]})["settings"]["itemQuantities"][
            "part"
        ]["mass"]
        == 0.45359237
    )


def test_move_does_not_bypass_folder_permissions_or_sharing_scope(library):
    _, _, _, _, call = library
    file = native(call)
    foreign = call("create", {"kind": "folder", "name": "Other owner"}, who=1)
    shared = call(
        "create", {"kind": "folder", "name": "Shared folder", "scope": "workspace"}
    )
    for folder in (foreign, shared):
        with pytest.raises(Problem):
            edit(call, file, "move", parent=folder["id"])
    assert call("cad_metadata", {"id": file["id"]})["parent"] is None


def test_legacy_settings_do_not_apply_a_branch_request_to_main(library):
    _, _, _, _, call = library
    file = native(call)
    for branch in ("Design", "branch-" + "a" * 64):
        for action in ("cad_metadata", "cad_operation"):
            with pytest.raises(Problem) as failure:
                call(action, {"id": file["id"], "branch": branch,
                              "operation": "rename", "name": "Wrong branch",
                              "expected_revision": file["revision"]})
            assert failure.value.status == 501
    current = call("read", {"id": file["id"]})
    assert current["name"] == file["name"]
    assert current["revision"] == file["revision"]

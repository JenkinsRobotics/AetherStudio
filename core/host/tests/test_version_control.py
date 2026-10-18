"""Version control comparable to Onshape and git (Jonathan, 2026-10-02).

Every document in Aether Studio flows through this, so each operation gets the
case that proves it and the case that proves its refusal. The fixture is the
library's own: `call(action, data, who=0)` is the owner, `who=1` a member.
"""

import base64
import json

import pytest

from core.host.state import Problem
from core.host.tests.test_library import create

pytest_plugins = ["core.host.tests.test_library"]


def part(*feature_ids, **extra):
    """A minimal native CAD part, so compare has features to diff."""
    doc = {"format": "aether-part", "features": [{"id": i, "type": "extrude", "name": f"Feature {i}", **extra.get(i, {})} for i in feature_ids]}
    return base64.b64encode(json.dumps(doc).encode()).decode()


def setup(call):
    """A part on Main, a version, and a branch one save ahead of Main."""
    f = call("create", {"name": "bracket.acpart", "scope": "personal", "parent": None, "data_base64": part("a", "b")})
    fid = f["id"]
    call("version", {"id": fid, "name": "V1", "expected_revision": 1})
    call("branch_create", {"id": fid, "name": "feature-c", "expected_revision": 1})
    saved = call("save", {"id": fid, "branch": "feature-c", "expected_revision": 1, "data_base64": part("a", "b", "c")})
    return fid, saved["revision"]


def main_content(call, fid):
    return json.loads(base64.b64decode(call("read", {"id": fid})["data_base64"]))


# ---- merge --------------------------------------------------------------

def test_merge_brings_a_branch_into_main_as_a_two_parent_revision(library):
    _, _, _, _, call = library
    fid, branch_head = setup(call)
    result = call("merge", {"id": fid, "source": "feature-c", "expected_revision": 1})
    assert result["merged"] and result["fast_forward"]
    assert [f["id"] for f in main_content(call, fid)["features"]] == ["a", "b", "c"]
    merge = next(r for r in call("history", {"id": fid})["revisions"] if r["event"] == "merge")
    assert (merge["parent_revision"], merge["merge_parent_revision"]) == (1, branch_head)
    assert merge["branch"] == "Main"
    # Merging again is a no-op, not a second merge revision.
    again = call("merge", {"id": fid, "source": "feature-c", "expected_revision": result["revision"]})
    assert again["merged"] is False and again["reason"] == "already"


def test_merge_of_diverged_branches_is_a_conflict_until_a_side_is_chosen(library):
    _, _, _, _, call = library
    fid, branch_head = setup(call)
    # Main moves too, so the branch no longer descends from Main's head.
    call("save", {"id": fid, "expected_revision": 1, "data_base64": part("a", "b", "d")})
    with pytest.raises(Problem) as err:
        call("merge", {"id": fid, "source": "feature-c", "expected_revision": 3})
    assert err.value.status == 409
    detail = err.value.detail
    assert detail["conflict"] and detail["base"] == 1
    assert {f["id"] for f in detail["features"]["added"]} == {"c"}
    assert {f["id"] for f in detail["features"]["removed"]} == {"d"}

    result = call("merge", {"id": fid, "source": "feature-c", "expected_revision": 3, "resolution": "source"})
    assert result["merged"] and not result["fast_forward"]
    assert [f["id"] for f in main_content(call, fid)["features"]] == ["a", "b", "c"]
    merge = next(r for r in call("history", {"id": fid})["revisions"] if r["event"] == "merge")
    assert (merge["parent_revision"], merge["merge_parent_revision"]) == (3, branch_head)


def test_merge_guards_the_target_head_and_refuses_a_branch_into_itself(library):
    _, _, _, _, call = library
    fid, _ = setup(call)
    with pytest.raises(Problem) as err:
        call("merge", {"id": fid, "source": "feature-c", "expected_revision": 99})
    assert err.value.status == 409
    with pytest.raises(Problem) as err:
        call("merge", {"id": fid, "source": "Main", "expected_revision": 1})
    assert err.value.status == 400


# ---- restore ------------------------------------------------------------

def test_restore_from_a_branch_moves_the_branch_and_leaves_main_alone(library):
    _, _, _, _, call = library
    fid, branch_head = setup(call)
    before = main_content(call, fid)
    result = call("restore", {"id": fid, "branch": "feature-c", "expected_revision": branch_head, "revision": 1})
    assert result["branch"] == "feature-c"
    assert main_content(call, fid) == before, "restore in a branch must not rewrite Main"
    on_branch = json.loads(base64.b64decode(call("read", {"id": fid, "branch": "feature-c"})["data_base64"]))
    assert [f["id"] for f in on_branch["features"]] == ["a", "b"]
    assert call("history", {"id": fid})["branches"][1]["head_revision"] == result["revision"]


# ---- compare ------------------------------------------------------------

def test_compare_reports_the_base_each_side_and_the_feature_diff(library):
    _, _, _, _, call = library
    fid, branch_head = setup(call)
    call("save", {"id": fid, "expected_revision": 1, "data_base64": part("a", "b", "d", b={"name": "Feature b (wider)"})})
    result = call("compare", {"id": fid, "from": 3, "to": branch_head})
    assert result["base"] == 1 and not result["same_content"]
    assert [r["revision"] for r in result["from_only"]] == [3]
    assert [r["revision"] for r in result["to_only"]] == [branch_head]
    assert {f["id"] for f in result["features"]["added"]} == {"c"}
    assert {f["id"] for f in result["features"]["removed"]} == {"d"}
    assert {f["id"] for f in result["features"]["changed"]} == {"b"}
    # Reading history is not owner-only; a member who can see the file can compare.
    call("share", {"id": fid, "expected_revision": 3, "scope": "workspace"})
    assert call("compare", {"id": fid, "from": 1, "to": 3}, who=1)["base"] == 1


def test_compare_of_a_non_cad_file_still_says_whether_the_bytes_differ(library):
    _, _, _, _, call = library
    f = create(call)
    call("save", {"id": f["id"], "expected_revision": 1, "data_base64": "bmV3"})
    result = call("compare", {"id": f["id"], "from": 1, "to": 2})
    assert result["features"] is None and not result["same_content"]
    assert call("compare", {"id": f["id"], "from": 2, "to": 2})["same_content"]


# ---- branches -----------------------------------------------------------

def test_branch_delete_refuses_unmerged_work_unless_forced_and_never_main(library):
    _, _, _, _, call = library
    fid, _ = setup(call)
    with pytest.raises(Problem) as err:
        call("branch_delete", {"id": fid, "name": "feature-c", "expected_revision": 1})
    assert err.value.status == 409
    with pytest.raises(Problem) as err:
        call("branch_delete", {"id": fid, "name": "Main", "expected_revision": 1})
    assert err.value.status == 400
    merged = call("merge", {"id": fid, "source": "feature-c", "expected_revision": 1})
    assert call("branch_delete", {"id": fid, "name": "feature-c", "expected_revision": merged["revision"]})["merged"]
    assert [b["name"] for b in call("history", {"id": fid})["branches"]] == ["Main"]


def test_branch_delete_with_force_discards_unmerged_work(library):
    _, _, _, _, call = library
    fid, _ = setup(call)
    assert call("branch_delete", {"id": fid, "name": "feature-c", "expected_revision": 1, "force": True})["merged"] is False


def test_branch_rename_carries_its_history_rows_along(library):
    _, _, _, _, call = library
    fid, branch_head = setup(call)
    call("branch_rename", {"id": fid, "name": "feature-c", "new_name": "wider-flange", "expected_revision": 1})
    history = call("history", {"id": fid})
    assert [b["name"] for b in history["branches"]] == ["Main", "wider-flange"]
    assert next(r for r in history["revisions"] if r["revision"] == branch_head)["branch"] == "wider-flange"
    with pytest.raises(Problem):
        call("branch_rename", {"id": fid, "name": "wider-flange", "new_name": "Main", "expected_revision": 1})


# ---- versions -----------------------------------------------------------

def test_versions_can_be_renamed_described_and_deleted(library):
    _, _, _, _, call = library
    fid, _ = setup(call)
    call("version_update", {"id": fid, "name": "V1", "new_name": "Design review", "message": "Signed off", "expected_revision": 1})
    versions = call("history", {"id": fid})["versions"]
    assert [(v["name"], v["message"]) for v in versions] == [("Design review", "Signed off")]
    with pytest.raises(Problem) as err:
        call("version_update", {"id": fid, "name": "missing", "new_name": "x", "expected_revision": 1})
    assert err.value.status == 404
    call("version_delete", {"id": fid, "name": "Design review", "expected_revision": 1})
    assert call("history", {"id": fid})["versions"] == []


def test_a_version_made_in_a_branch_marks_the_branch_head(library):
    _, _, _, _, call = library
    fid, branch_head = setup(call)
    result = call("version", {"id": fid, "branch": "feature-c", "name": "C1", "expected_revision": branch_head})
    assert result["revision"] == branch_head


def test_only_the_owner_mutates_history(library):
    _, _, _, _, call = library
    fid, _ = setup(call)
    call("share", {"id": fid, "expected_revision": 1, "scope": "workspace"})
    for action, data in [
        ("merge", {"source": "feature-c"}), ("branch_delete", {"name": "feature-c", "force": True}),
        ("branch_rename", {"name": "feature-c", "new_name": "x"}), ("version_delete", {"name": "V1"}),
    ]:
        with pytest.raises(Problem) as err:
            call(action, {"id": fid, "expected_revision": 1, **data}, who=1)
        assert err.value.status == 403, action


# ---- over HTTP: the conflict's structure must reach the client ------------

def test_merge_conflict_detail_crosses_the_wire(tmp_path):
    """The panel offers a resolution only if the 409 carries the conflict's
    structure. The dispatch layer passes it as an exception; this proves the
    JSON reply does too."""
    import json as _json
    import threading
    import urllib.error
    import urllib.request
    from http.server import ThreadingHTTPServer

    from core.host.server import StudioHost, make_handler

    password = "Correct-Horse-9-Battery"
    instance = StudioHost(tmp_path / "data")
    instance.store.create_user("owner", password, "admin", False)
    token = instance.store.sign_in("owner", password, "127.0.0.1")
    def api(action, data):
        return instance.dispatch("/api/library/" + action, {"app": "cad", **data}, token, "127.0.0.1")

    fid = api("create", {"name": "b.acpart", "scope": "personal", "parent": None, "data_base64": part("a")})["id"]
    api("branch_create", {"id": fid, "name": "side", "expected_revision": 1})
    api("save", {"id": fid, "branch": "side", "expected_revision": 1, "data_base64": part("a", "s")})
    api("save", {"id": fid, "expected_revision": 1, "data_base64": part("a", "m")})

    server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(instance))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    origin = f"http://127.0.0.1:{server.server_port}"
    try:
        login = urllib.request.urlopen(urllib.request.Request(
            origin + "/api/login", data=_json.dumps({"username": "owner", "password": password}).encode(),
            headers={"Origin": origin, "Content-Type": "application/json"}))
        cookie = login.headers["Set-Cookie"].split(";")[0]
        with pytest.raises(urllib.error.HTTPError) as err:
            urllib.request.urlopen(urllib.request.Request(
                origin + "/api/library/merge",
                data=_json.dumps({"app": "cad", "id": fid, "source": "side", "expected_revision": 3}).encode(),
                headers={"Origin": origin, "Content-Type": "application/json", "Cookie": cookie}))
        assert err.value.code == 409
        body = _json.loads(err.value.read())
        assert body["detail"]["conflict"] is True
        assert body["detail"]["source_head"] == 2 and body["detail"]["target_head"] == 3
        assert {f["id"] for f in body["detail"]["features"]["added"]} == {"s"}
    finally:
        server.shutdown()


# ---- what the library calls a version ------------------------------------

def test_the_library_counts_named_versions_not_autosaves(library):
    """A file edited all afternoon is still V1 until someone names a state.
    The panel shows this number, so it must not track the save counter."""
    _, _, _, _, call = library
    fid = call("create", {"name": "bracket.acpart", "scope": "personal", "parent": None, "data_base64": part("a")})["id"]
    for n in range(2, 8):
        call("save", {"id": fid, "expected_revision": n - 1, "data_base64": part("a", f"f{n}")})

    listed = next(f for f in call("list", {"view": "personal"})["files"] if f["id"] == fid)
    assert listed["revision"] == 7, "autosaves still advance the revision"
    assert listed["versions"] == 0 and listed["latest_version"] is None

    call("version", {"id": fid, "name": "V1", "expected_revision": 7})
    listed = next(f for f in call("list", {"view": "personal"})["files"] if f["id"] == fid)
    assert listed["versions"] == 1 and listed["latest_version"] == "V1"

    call("save", {"id": fid, "expected_revision": 7, "data_base64": part("a", "later")})
    call("version", {"id": fid, "name": "Design review", "expected_revision": 8})
    listed = next(f for f in call("list", {"view": "personal"})["files"] if f["id"] == fid)
    assert listed["versions"] == 2 and listed["latest_version"] == "Design review"


def test_merge_refuses_a_source_changed_since_conflict_review(library):
    _, _, _, _, call = library
    fid, source_head = setup(call)
    call('save', {'id': fid, 'branch': 'feature-c', 'expected_revision': source_head, 'data_base64': part('a', 'b', 'c', 'new')})
    with pytest.raises(Problem) as err:
        call('merge', {'id': fid, 'source': 'feature-c', 'expected_revision': 1, 'expected_source_revision': source_head, 'resolution': 'source'})
    assert err.value.status == 409
    assert [f['id'] for f in main_content(call, fid)['features']] == ['a', 'b']

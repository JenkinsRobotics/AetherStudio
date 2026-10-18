import pytest

from core.host.server import StudioHost
from dev.rebuild.legacy_transfer import TransferError, capture, digest, load
from dev.rebuild.merge_demo_sources import merge


@pytest.fixture
def pair(tmp_path):
    snapshots = []
    for label in ["original", "development"]:
        root = tmp_path / label
        host = StudioHost(root)
        uid = host.store.create_user(
            "owner", label + "-fixture-password-2026", "admin", False
        )
        token = host.store.sign_in("owner", label + "-fixture-password-2026", "local")
        host.dispatch("/api/drive/context", {}, token, "local")
        host.dispatch(
            "/api/drive/create",
            {"app": "map", "name": label, "data_base64": "e30="},
            token,
            "local",
        )
        (root / "workspaces" / uid).mkdir(parents=True, exist_ok=True)
        (root / "workspaces" / uid / (label + ".txt")).write_text(label)
        host.store.db.commit()
        snapshot = tmp_path / (label + "-snapshot")
        capture(root, snapshot)
        snapshots.append(snapshot)
        host.store.db.close()
    return snapshots


def test_merges_original_identity_and_every_history_without_source_changes(
    pair, tmp_path
):
    before = [digest((p / "studio.sqlite3").read_bytes()) for p in pair]
    first, _, _ = load(pair[0])
    second, _, _ = load(pair[1])
    destination = tmp_path / "merged"
    result = merge(*pair, destination, combine_original_identity=True)
    data, _, _ = load(destination)
    assert result["users"] == 1 and result["library"] == 2 and result["history"] == 2
    assert data["users"] == first["users"]
    assert {r["id"] for r in data["library"]} == {
        r["id"] for s in [first, second] for r in s["library"]
    }
    assert all(r["owner"] == first["users"][0]["id"] for r in data["library"])
    assert all(r["author"] == first["users"][0]["id"] for r in data["library_history"])
    assert {r["id"] for r in data["drive_workspaces"]} == {
        "shared",
        "development-shared",
    }
    assert (
        len(
            list(
                (destination / "assets/workspaces" / first["users"][0]["id"]).glob(
                    "*.txt"
                )
            )
        )
        == 2
    )
    assert before == [digest((p / "studio.sqlite3").read_bytes()) for p in pair]
    assert result["cutover_ready"] is False


def test_requires_explicit_identity_mapping_and_refuses_same_source(pair, tmp_path):
    with pytest.raises(TransferError):
        merge(*pair, tmp_path / "bad")
    with pytest.raises(TransferError):
        merge(pair[0], pair[0], tmp_path / "bad", combine_original_identity=True)
    assert not (tmp_path / "bad").exists()


def test_overlapping_document_ids_refuse_before_publication(pair, tmp_path):
    # Distinct verified snapshots of the same authority must not double its files.
    import shutil

    copy = tmp_path / "copy"
    shutil.copytree(pair[0], copy)
    with pytest.raises(TransferError, match="Overlapping file IDs"):
        merge(pair[0], copy, tmp_path / "bad", combine_original_identity=True)
    assert not (tmp_path / "bad").exists()


def test_custom_cad_units_event_is_preserved(tmp_path):
    host = StudioHost(tmp_path / "source")
    owner = host.store.create_user(
        "owner", "original-fixture-password-2026", "admin", False
    )
    token = host.store.sign_in("owner", "original-fixture-password-2026", "local")
    file = host.dispatch(
        "/api/drive/create",
        {"app": "cad", "name": "Units", "data_base64": "e30="},
        token,
        "local",
    )
    host.dispatch(
        "/api/library/save",
        {
            "app": "cad",
            "id": file["id"],
            "expected_revision": 1,
            "data_base64": "eyJ1bml0cyI6ImluIn0=",
        },
        token,
        "local",
    )
    host.store.db.execute(
        "UPDATE library_history SET event='document_units' WHERE revision=2"
    )
    host.store.db.commit()
    capture(tmp_path / "source", tmp_path / "snapshot")
    data, _, _ = load(tmp_path / "snapshot")
    assert data["library_history"][1]["event"] == "document_units"
    assert data["library_history"][1]["author"] == owner
    host.store.db.close()


def test_different_workspace_bytes_at_the_same_path_stop_merge(pair, tmp_path):
    # Rebuild the snapshots using the real captured databases with conflicting
    # paths under the account selected for consolidation.
    import shutil

    from dev.rebuild.legacy_transfer import load

    snapshots = []
    for index, old in enumerate(pair):
        data, _, _ = load(old)
        source = tmp_path / f"conflict-source-{index}"
        source.mkdir()
        shutil.copyfile(old / "studio.sqlite3", source / "studio.sqlite3")
        file = source / "workspaces" / data["users"][0]["id"] / "conflict.txt"
        file.parent.mkdir(parents=True)
        file.write_text(str(index))
        snapshot = tmp_path / f"conflict-snapshot-{index}"
        capture(source, snapshot)
        snapshots.append(snapshot)
    with pytest.raises(TransferError, match="Conflicting workspace/media"):
        merge(*snapshots, tmp_path / "bad", combine_original_identity=True)
    assert not (tmp_path / "bad").exists()

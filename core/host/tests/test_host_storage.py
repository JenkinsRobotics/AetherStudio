import shutil
import time
import zipfile

import pytest

from core.host.backup import restore
from core.host.server import StudioHost
from core.host.state import Problem


@pytest.fixture
def host(tmp_path):
    instance = StudioHost(tmp_path / "data")
    instance.store.create_user("owner", "server-test-password-2026", "admin", False)
    yield instance
    instance.store.db.close()


def test_completed_archive_export_and_restore(host, tmp_path):
    export = tmp_path / "OneDrive - Team/Studio backups"
    host.storage.configure({"interval_hours": 24, "export_directory": str(export)})
    workspace = host.store.directory / "workspaces/owner"
    workspace.mkdir(parents=True)
    (workspace / "part.txt").write_text("saved team work")
    with host.lock:
        name = host.backup()
    assert (export / name).read_bytes() == (
        host.store.directory / "backups" / name
    ).read_bytes()
    assert list(export.iterdir()) == [export / name]
    with zipfile.ZipFile(export / name) as archive:
        assert archive.testzip() is None
    restored = tmp_path / "restored"
    restore(export / name, restored)
    assert (restored / "workspaces/owner/part.txt").read_text() == "saved team work"
    second = StudioHost(restored)
    assert second.storage.read()["export_directory"] == ""
    assert second.storage.read()["last_backup"] == ""
    second.store.db.close()


def test_delivery_failure_preserves_local_archive_and_reports(host, tmp_path):
    export = tmp_path / "external-backups"
    host.storage.configure({"interval_hours": 24, "export_directory": str(export)})
    shutil.rmtree(export)
    name = host.backup()
    assert not export.exists()  # Don't recreate a disconnected volume's path.
    assert (host.store.directory / "backups" / name).is_file()
    assert "Local backup is safe" in host.storage.read()["error"]
    assert not host.storage.read()["last_export"]


def test_scheduler_runs_once_when_due_then_respects_disabled(host):
    assert host.storage.tick()
    assert len(list((host.store.directory / "backups").glob("*.zip"))) == 1
    assert not host.storage.tick(time.time() + 60)
    host.storage.configure({"interval_hours": 0, "export_directory": ""})
    assert not host.storage.tick(time.time() + 1000000)


def test_snapshot_failure_never_publishes_partial_zip(host, monkeypatch):
    def fail(*args, **kwargs):
        raise OSError("Disk full")

    monkeypatch.setattr(zipfile.ZipFile, "write", fail)
    assert host.storage.tick()
    assert not list((host.store.directory / "backups").glob("*.zip"))
    assert not list((host.store.directory / "backups").glob(".backup-*"))
    assert "Scheduled backup failed" in host.storage.read()["error"]


def test_policy_requires_admin_and_rejects_overlap(host):
    host.store.create_user("member", "server-test-password-2026", "member", False)
    token = host.store.sign_in("member", "server-test-password-2026", "127.0.0.1")
    with pytest.raises(Problem) as error:
        host.dispatch("/api/admin/storage", {"interval_hours": 0}, token, "127.0.0.1")
    assert error.value.status == 403
    for path in (
        host.store.directory,
        host.store.directory / "backups",
        host.store.directory.parent,
    ):
        with pytest.raises(Problem, match="separate backup folder"):
            host.storage.configure(
                {"interval_hours": 24, "export_directory": str(path)}
            )
    for hours in (True, -1, 5, "24"):
        with pytest.raises(Problem):
            host.storage.configure({"interval_hours": hours})

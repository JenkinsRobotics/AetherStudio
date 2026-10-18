import hashlib
import json
import plistlib
from pathlib import Path

import pytest
from native_installation import InstallationError, copy_backup, plan, private


def backup(root, name="native.sql", content=b"test fixture"):
    root.mkdir(mode=0o700)
    (root / name).parent.mkdir(parents=True, exist_ok=True)
    (root / name).write_bytes(content)
    manifest = {
        "schema": 1,
        "tenant": "test",
        "sessions_restored": False,
        "delegated_credentials_restored": False,
        "files": {
            name: {"size": len(content), "sha256": hashlib.sha256(content).hexdigest()}
        },
    }
    (root / "manifest.json").write_text(json.dumps(manifest))
    return manifest


def test_snapshot_copies_only_verified_files_and_refuses_corruption(tmp_path):
    source, target = tmp_path / "source", tmp_path / "target"
    backup(source)
    target.mkdir()
    copy_backup(source, target)
    assert (target / "native.sql").read_bytes() == b"test fixture"
    assert (target / "native.sql").stat().st_mode & 0o777 == 0o600
    (source / "native.sql").write_bytes(b"tampered")
    with pytest.raises(InstallationError, match="integrity"):
        copy_backup(source, tmp_path / "failed")


@pytest.mark.parametrize(
    "name",
    [
        "../outside",
        "/absolute",
        "objects/../outside",
        "objects//bad",
        "unexpected/path",
        "objects\\bad",
    ],
)
def test_snapshot_refuses_unsafe_manifest_paths(tmp_path, name):
    source = tmp_path / "source"
    manifest = backup(source)
    manifest["files"][name] = {"size": 0, "sha256": hashlib.sha256(b"").hexdigest()}
    (source / "manifest.json").write_text(json.dumps(manifest))
    with pytest.raises(InstallationError):
        copy_backup(source, tmp_path / "failed")
    assert not (tmp_path / "outside").exists()


def test_snapshot_refuses_symlink_and_no_partial_report(tmp_path):
    source = tmp_path / "source"
    backup(source)
    (source / "native.sql").unlink()
    secret = tmp_path / "private.sql"
    secret.write_text("never copy this")
    (source / "native.sql").symlink_to(secret)
    with pytest.raises(OSError):
        copy_backup(source, tmp_path / "failed")
    assert not (tmp_path / "failed/recovery-report.json").exists()


def test_service_plan_is_private_pins_binary_and_never_embeds_credentials(tmp_path):
    tmp_path.chmod(0o700)
    db = tmp_path / "database"
    db.mkdir(mode=0o700)
    (db / "PG_VERSION").write_text("17")
    # Short paths are required for macOS Unix sockets.
    import tempfile

    with tempfile.TemporaryDirectory(prefix="aether-plan-", dir="/tmp") as sock:
        socket = Path(sock)
        socket.chmod(0o700)
        config = tmp_path / "config.json"
        config.write_text(
            json.dumps(
                {
                    "schema": 1,
                    "environment": {
                        "AETHER_NATIVE_PG": f"host={socket} user=fixture dbname=postgres password=do-not-leak",
                        "AETHER_NATIVE_TENANT": "fixture",
                        "AETHER_NATIVE_OBJECTS": str(tmp_path / "objects"),
                    },
                }
            )
        )
        config.chmod(0o600)
        bins = tmp_path / "tools"
        bins.mkdir()
        (bins / "postgres").symlink_to("/bin/echo")
        destination = tmp_path / "generation"
        result = plan(
            "/bin/echo", config, bins, db, socket, destination, "com.aether.studio.test"
        )
        assert result["services_started"] is False
        for name in ["database", "server"]:
            raw = (destination / f"{name}.plist").read_bytes()
            assert b"do-not-leak" not in raw and b"password=" not in raw
            item = plistlib.loads(raw)
            assert item["KeepAlive"] is True and item["ThrottleInterval"] >= 10
            assert item["ProcessType"] == "Interactive"
            assert item["Umask"] == 0o077
            assert item["EnvironmentVariables"]["LC_ALL"] == "C"
        args = plistlib.loads((destination / "server.plist").read_bytes())[
            "ProgramArguments"
        ]
        assert args == [
            str(destination / "bin/aether-native-host"),
            "serve",
            "--config",
            str(destination / "installation.json"),
        ]
        private(destination / "installation.json")
        original = (destination / "plan.json").read_bytes()
        with pytest.raises(InstallationError, match="absent"):
            plan(
                "/bin/echo",
                config,
                bins,
                db,
                socket,
                destination,
                "com.aether.studio.test",
            )
        assert (destination / "plan.json").read_bytes() == original
        config.chmod(0o644)
        with pytest.raises(InstallationError, match="owner-only"):
            plan(
                "/bin/echo",
                config,
                bins,
                db,
                socket,
                tmp_path / "refused",
                "com.aether.studio.test",
            )


def test_backup_nested_directory_symlink_is_not_followed(tmp_path):
    source = tmp_path / "source"
    manifest = backup(source)
    outside = tmp_path / "outside"
    outside.mkdir()
    (outside / "secret").write_bytes(b"secret")
    (source / "objects").symlink_to(outside, target_is_directory=True)
    manifest["files"]["objects/secret"] = {
        "size": 6,
        "sha256": hashlib.sha256(b"secret").hexdigest(),
    }
    (source / "manifest.json").write_text(json.dumps(manifest))
    with pytest.raises(OSError):
        copy_backup(source, tmp_path / "failed")
    assert not (tmp_path / "failed/objects/secret").exists()

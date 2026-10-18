import json
import plistlib
import shlex
import subprocess
import sys
import threading
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

import pytest

from core.host import maintenance
from core.host.install_macos import launch_agent
from core.host.server import StudioHost, make_handler


def test_preview_does_not_modify_installation(tmp_path):
    target = tmp_path / "uncreated"
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "core.host.maintenance",
            "uninstall",
            "--data",
            str(target),
        ],
        capture_output=True,
        check=True,
    )
    assert json.loads(result.stdout)["preview_only"] is True
    assert not target.exists()


def test_commands_quote_user_paths(tmp_path):
    root = tmp_path / "Aether's Studio $(touch nope)"
    data = tmp_path / "data; with spaces"
    plan = maintenance.installation_plan(data, root)
    arguments = shlex.split(plan["commands"]["uninstall"]["apply"])
    assert arguments[-3:] == ["--data", str(data), "--apply"]
    assert arguments[0] == str(root / ".venv/bin/python")


@pytest.fixture
def installation(tmp_path, monkeypatch):
    root = tmp_path / "source"
    root.mkdir()
    (root / "keep-source.txt").write_text("source code")
    data = tmp_path / "server-data"
    instance = StudioHost(data)
    instance.store.create_user("admin", "maintenance-test-password", "admin", False)
    instance.store.db.close()
    home = tmp_path / "home"
    monkeypatch.setattr(maintenance.sys, "platform", "darwin")
    monkeypatch.setattr(Path, "home", lambda: home)
    plist = home / "Library/LaunchAgents/studio.aether.host.plist"
    plist.parent.mkdir(parents=True)
    plist.write_bytes(plistlib.dumps(launch_agent(root, data)))
    bundle = root / "Aether Studio.app"
    (bundle / "Contents").mkdir(parents=True)
    (bundle / "Contents/Info.plist").write_bytes(
        plistlib.dumps({"CFBundleIdentifier": "studio.aether.browser.studio"})
    )
    calls = []

    def run(arguments, **kwargs):
        calls.append(arguments)
        return subprocess.CompletedProcess(
            arguments,
            0,
            f"\nworking directory = {root}\n\t--data\n\t{data}\n".encode(),
            b"",
        )

    monkeypatch.setattr(maintenance.subprocess, "run", run)
    return root, data, plist, bundle, calls


def test_uninstall_removes_only_generated_service_and_shortcut(installation):
    root, data, plist, bundle, calls = installation
    before = (data / "studio.sqlite3").read_bytes()
    result = maintenance.apply("uninstall", data, root)
    assert not plist.exists() and not bundle.exists()
    assert (root / "keep-source.txt").read_text() == "source code"
    assert (data / "studio.sqlite3").read_bytes() == before
    assert result["data_preserved"] == str(data)
    assert any(call[:2] == ["launchctl", "bootout"] for call in calls)


def test_uninstall_refuses_unrelated_bundle_before_stopping(installation):
    root, data, plist, bundle, calls = installation
    (bundle / "Contents/Info.plist").write_bytes(
        plistlib.dumps({"CFBundleIdentifier": "another.application"})
    )
    with pytest.raises(ValueError, match="Not a generated"):
        maintenance.apply("uninstall", data, root)
    assert not calls and plist.exists() and bundle.exists()


def test_uninstall_refuses_unrelated_service(installation):
    root, data, plist, bundle, calls = installation
    spec = plistlib.loads(plist.read_bytes())
    spec["WorkingDirectory"] = "/different/install"
    plist.write_bytes(plistlib.dumps(spec))
    with pytest.raises(ValueError, match="different installation"):
        maintenance.apply("uninstall", data, root)
    assert not calls and bundle.exists()


def test_repair_snapshots_data_before_invoking_installer(installation):
    root, data, plist, bundle, calls = installation
    result = maintenance.apply("repair", data, root)
    assert (data / "backups" / result["backup"]).exists()
    assert calls[-1] == [
        "zsh",
        str(root / "core/host/install-macos.sh"),
        "--data",
        str(data),
    ]
    assert plist.exists() and bundle.exists()


def test_diagnostics_are_admin_only_and_exclude_credentials(tmp_path):
    host = StudioHost(tmp_path)
    password = "maintenance-test-password"
    tokens = {}
    for role in ("admin", "member"):
        host.store.create_user(role, password, role, False)
        tokens[role] = host.store.sign_in(role, password, "127.0.0.1")
    server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(host))
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    try:
        url = f"http://127.0.0.1:{server.server_port}/api/admin/maintenance"
        for role in (None, "member"):
            request = urllib.request.Request(
                url, headers={"Cookie": f"aether_session={tokens.get(role, '')}"}
            )
            with pytest.raises(urllib.error.HTTPError) as error:
                urllib.request.urlopen(request)
            assert error.value.code in (401, 403)
        request = urllib.request.Request(
            url, headers={"Cookie": f"aether_session={tokens['admin']}"}
        )
        with urllib.request.urlopen(request) as response:
            report = json.load(response)
        encoded = json.dumps(report)
        assert password not in encoded and all(
            token not in encoded for token in tokens.values()
        )
        assert "password" not in encoded.lower()
        assert report["counts"]["users"] == 2
    finally:
        server.shutdown()
        server.server_close()
        worker.join()
        host.store.db.close()


def test_loaded_service_different_data_is_not_stopped(installation, monkeypatch):
    root, data, plist, bundle, calls = installation

    def run(arguments, **kwargs):
        calls.append(arguments)
        return subprocess.CompletedProcess(
            arguments,
            0,
            f"\nworking directory = {root}\n\t--data\n\t/different/data\n".encode(),
            b"",
        )

    monkeypatch.setattr(maintenance.subprocess, "run", run)
    with pytest.raises(ValueError, match="another data folder"):
        maintenance.apply("uninstall", data, root)
    assert len(calls) == 1 and calls[0][1] == "print"
    assert plist.exists() and bundle.exists()


def test_shortcut_inside_live_data_is_not_removed(installation):
    root, data, plist, bundle, calls = installation
    nested = bundle / "data"
    nested.mkdir()
    (nested / "studio.sqlite3").write_bytes(b"preserve")
    plist.write_bytes(plistlib.dumps(launch_agent(root, nested)))
    with pytest.raises(ValueError, match="Data overlaps"):
        maintenance.apply("uninstall", nested, root)
    assert not calls
    assert (nested / "studio.sqlite3").read_bytes() == b"preserve"

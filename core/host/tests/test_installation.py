import json
import os
import plistlib
import subprocess
import sys
from pathlib import Path

import pytest

from core.host import installation
from core.host.install_macos import launch_agent
from core.host.server_certificates import create_certificate


def test_custom_directory_survives_reinstall_and_spaces(tmp_path, monkeypatch):
    config = tmp_path / "config/installation.json"
    monkeypatch.setattr(
        installation, "platform_paths", lambda: (tmp_path / "default", config)
    )
    assert installation.default_directory() == tmp_path / "default"
    selected = tmp_path / "Team data"
    installation.configure_directory(selected)
    assert installation.default_directory() == selected
    assert json.loads(config.read_text())["data_directory"] == str(selected)
    if os.name != "nt":
        assert config.stat().st_mode & 0o777 == 0o600
    config.write_text("invalid")
    with pytest.raises(ValueError, match="Invalid installation"):
        installation.default_directory()


@pytest.mark.parametrize(
    "name", ["OneDrive - Team", "Dropbox", "CloudStorage", "Mobile Documents"]
)
def test_live_data_rejects_known_sync_roots(tmp_path, name):
    with pytest.raises(ValueError, match="backup destination"):
        installation.local_directory(tmp_path / name / "Studio")


def test_server_lease_rejects_second_process_and_releases(tmp_path):
    script = "from pathlib import Path; from core.host.installation import server_lease; import sys\nwith server_lease(Path(sys.argv[1])): pass"
    with installation.server_lease(tmp_path):
        result = subprocess.run(
            [sys.executable, "-c", script, str(tmp_path)], capture_output=True
        )
        assert result.returncode != 0
        assert b"already owns" in result.stderr
    subprocess.run([sys.executable, "-c", script, str(tmp_path)], check=True)


@pytest.mark.parametrize("platform", ["darwin", "linux", "win32"])
def test_platform_specific_default_paths(monkeypatch, tmp_path, platform):
    monkeypatch.setattr(installation.sys, "platform", platform)
    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path / "Local"))
    monkeypatch.setenv("XDG_DATA_HOME", str(tmp_path / "xdg-data"))
    monkeypatch.setenv("XDG_CONFIG_HOME", str(tmp_path / "xdg-config"))
    data, config = installation.platform_paths()
    assert data.is_absolute() and config.is_absolute()
    assert (
        "Library"
        if platform == "darwin"
        else "Local"
        if platform == "win32"
        else "xdg-data"
    ) in data.parts


def test_mac_launch_agent_keeps_custom_data_explicit(tmp_path):
    data = tmp_path / "Studio team data"
    spec = plistlib.loads(plistlib.dumps(launch_agent(tmp_path / "App source", data)))
    assert spec["ProgramArguments"][-2:] == ["--data", str(data)]
    assert spec["StandardOutPath"] == str(data / "logs/host.log")


def test_generated_certificate_validates_hostname_and_ip(tmp_path):
    import ssl
    import socket
    import threading

    directory = create_certificate(tmp_path, "studio.internal", ["127.0.0.1"])
    server_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    server_context.load_cert_chain(
        directory / "server.pem", directory / "server-key.pem"
    )
    client_context = ssl.create_default_context(cafile=str(directory / "ca.pem"))
    for hostname in ("studio.internal", "127.0.0.1"):
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            listener.listen()
            errors = []

            def accept():
                try:
                    connection, _ = listener.accept()
                    with server_context.wrap_socket(
                        connection, server_side=True
                    ) as connection:
                        connection.sendall(b"ready")
                except Exception as error:
                    errors.append(error)

            worker = threading.Thread(target=accept)
            worker.start()
            with socket.create_connection(listener.getsockname(), timeout=5) as raw:
                with client_context.wrap_socket(
                    raw, server_hostname=hostname
                ) as client:
                    assert client.recv(5) == b"ready"
            worker.join(5)
            assert not errors
    if os.name != "nt":
        assert (directory / "server-key.pem").stat().st_mode & 0o777 == 0o600
    with pytest.raises(ValueError):
        create_certificate(tmp_path, "bad\nDNS:injection")

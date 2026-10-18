"""The Raspberry Pi installer the host hands out, in both its shapes."""

import ast
import base64
import re
import subprocess
from pathlib import Path

import pytest

from aether_map_service import provisioning

from core.host.projects import project_path
SOURCE = project_path("map") / "player"


def embedded(text: str, module: str) -> str:
    variable = module.removesuffix(".py").upper() + "_B64"
    match = re.search(rf"^{variable}='([^']+)'$", text, re.M)
    assert match, f"{variable} is not in the bundled installer"
    return base64.b64decode(match.group(1)).decode()


def test_the_piped_installer_points_at_the_host_that_served_it():
    script = provisioning.installer(SOURCE, "http://studio.local:8780").decode()
    assert "http://studio.local:8780" in script
    assert provisioning.PLACEHOLDER not in script


def test_the_bundle_carries_every_module_and_they_are_real_python():
    """A Pi with no network cannot fetch them, so they travel inside."""
    script = provisioning.bundled_installer(SOURCE).decode()
    for module in provisioning.MODULES:
        ast.parse(embedded(script, module))


def test_the_bundle_matches_the_modules_on_disk():
    script = provisioning.bundled_installer(SOURCE).decode()
    for module in provisioning.MODULES:
        assert embedded(script, module) == (SOURCE / module).read_text()


def test_the_bundle_is_valid_shell():
    """Python source is full of quotes and backslashes; base64 is why. A
    truncated installer that still runs would be far worse than one that
    does not parse."""
    script = provisioning.bundled_installer(SOURCE)
    done = subprocess.run(["bash", "-n", "/dev/stdin"], input=script, capture_output=True)
    assert done.returncode == 0, done.stderr.decode()


def test_the_bundle_leaves_the_host_for_the_wizard_to_ask_for():
    """It is carried to a Pi that has never seen the host; there is nothing
    to stamp in, and install.sh reads the standing placeholder as 'ask'."""
    assert provisioning.PLACEHOLDER in provisioning.bundled_installer(SOURCE).decode()


def test_a_bundle_can_still_be_pointed_at_a_known_host():
    script = provisioning.bundled_installer(SOURCE, "http://studio.local:8780").decode()
    assert provisioning.PLACEHOLDER not in script
    assert "http://studio.local:8780" in script


@pytest.mark.parametrize("module,variable", [
    ("aether_player.py", "AETHER_PLAYER_B64"),
    ("aether_setup.py", "AETHER_SETUP_B64"),
])
def test_the_variable_names_are_the_ones_install_sh_reads(module, variable):
    """These two files agree by name only; nothing would fail loudly if the
    convention drifted — the installer would quietly fetch over a network the
    Pi does not have."""
    assert provisioning._variable(module) == variable
    assert f"${{{variable}:-}}" in (SOURCE / "install.sh").read_text()


def test_the_host_serves_the_bundle_as_a_download(tmp_path):
    """Unauthenticated by necessity: a Pi being imaged has no credentials."""
    import urllib.request
    from http.server import ThreadingHTTPServer
    import threading

    from core.host.server import StudioHost, make_handler

    host = StudioHost(tmp_path)
    host.dispatch("/api/setup", {
        "token": host.store.setup_path.read_text(),
        "username": "provisioning", "password": "provisioning-test-2026",
        "full_name": "Pi Tester", "email": "p@example.test",
        "name": "Workspace", "apps": ["map"],
    }, "", "127.0.0.1")
    server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(host))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    port = server.server_address[1]
    try:
        with urllib.request.urlopen(
            f"http://127.0.0.1:{port}/api/map/{provisioning.BUNDLE_NAME}", timeout=10
        ) as reply:
            body = reply.read().decode()
            assert "attachment" in reply.headers.get("Content-Disposition", "")
        ast.parse(embedded(body, "aether_setup.py"))

        # And the module route the piped installer uses.
        with urllib.request.urlopen(
            f"http://127.0.0.1:{port}/api/map/aether_setup.py", timeout=10
        ) as reply:
            ast.parse(reply.read().decode())
    finally:
        server.shutdown()

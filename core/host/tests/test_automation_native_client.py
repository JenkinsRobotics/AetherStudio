"""Qualify the Rust bridge against the real disposable legacy authority.

No native-host automation coverage is implied: that API is a separate migration.
Run after building aether-agent, with AETHER_AUTOMATION_BIN set to its absolute path.
"""

import json
import os
import subprocess

import pytest

from core.host.tests.test_automation import PASSWORD, grant
from core.host.tests.test_automation import http_host as http_host_fixture
from core.host.tests.test_automation import setup as setup_fixture
from core.host.tests.test_automation_products import Product

setup = setup_fixture
http_host = http_host_fixture
pytestmark = pytest.mark.skipif(
    not os.environ.get("AETHER_AUTOMATION_BIN"),
    reason="Rust bridge binary not configured",
)


def invoke(url, token, mode, arguments=None):
    result = subprocess.run(
        [os.environ["AETHER_AUTOMATION_BIN"], *mode],
        input=json.dumps(arguments or {}),
        text=True,
        capture_output=True,
        check=False,
        env={**os.environ, "AETHER_SERVER_URL": url, "AETHER_AUTOMATION_TOKEN": token},
        timeout=15,
    )
    assert token not in result.stdout + result.stderr
    if result.returncode:
        assert not result.stdout
        return result, None
    assert not result.stderr
    return result, json.loads(result.stdout)


@pytest.mark.parametrize(
    "action", ["revoke", "expire", "password", "disable", "restrict"]
)
def test_rust_cli_current_authority(setup, http_host, action):
    issued = grant(setup, who="member")
    token = issued["token"]
    result, data = invoke(http_host, token, ["run", "document.list"], {"app": "map"})
    assert result.returncode == 0 and data
    host, sessions, call, _ = setup
    with host.lock:
        uid = host.store.user_for(sessions["member"])["id"]
        if action == "revoke":
            call(
                "/api/automation/connections/revoke",
                {"id": issued["connection"]["id"]},
                "member",
            )
        elif action == "expire":
            host.store.db.execute("UPDATE automation_grants SET expires=0")
        elif action == "password":
            host.store.reset_password(uid, PASSWORD + "new")
        elif action == "disable":
            host.store.db.execute("UPDATE users SET active=0 WHERE id=?", (uid,))
        else:
            host.store.db.execute("UPDATE app_access SET restricted=1 WHERE id='map'")
        host.store.db.commit()
    result, _ = invoke(http_host, token, ["run", "document.list"], {"app": "map"})
    assert result.returncode == 1


def test_rust_cli_filters_tools_and_cannot_extend_scope(setup, http_host):
    token = grant(setup)["token"]
    _, data = invoke(http_host, token, ["list"])
    assert {c["id"] for c in data["commands"]} == {
        "document.list",
        "document.inspect",
        "document.history",
    }
    for command, arguments in [
        ("document.list", {"app": "cad"}),
        (
            "document.rename",
            {
                "app": "map",
                "id": setup[3]["id"],
                "expected_revision": 1,
                "name": "Denied",
            },
        ),
    ]:
        result, _ = invoke(http_host, token, ["run", command], arguments)
        assert result.returncode == 1
    _, data = invoke(
        http_host,
        token,
        ["run", "document.inspect"],
        {"app": "map", "id": setup[3]["id"]},
    )
    assert data["result"]["name"] == "Show.aethermap"


def test_rust_cli_uses_product_adapter_and_ordinary_guarded_history(setup, http_host):
    product = Product()
    setup[0].products.services["map"] = product
    token = grant(setup, can_write=True, can_edit_content=True)["token"]
    _, catalog = invoke(http_host, token, ["list"])
    assert "map.test.edit" in {c["id"] for c in catalog["commands"]}
    arguments = {"app": "map", "id": setup[3]["id"], "expected_revision": 1}
    result, data = invoke(http_host, token, ["run", "map.test.edit"], arguments)
    assert result.returncode == 0 and data["result"]["document"]["revision"] == 2
    result, _ = invoke(http_host, token, ["run", "map.test.edit"], arguments)
    assert result.returncode == 1
    assert product.calls == ["map.test.edit"]
    _, history = invoke(
        http_host,
        token,
        ["run", "document.history"],
        {"app": "map", "id": setup[3]["id"]},
    )
    assert len(history["result"]["revisions"]) == 2


def test_rust_mcp_rechecks_grant_in_an_open_connection(setup, http_host):
    import queue
    import threading

    issued = grant(setup, can_write=True)
    process = subprocess.Popen(
        [os.environ["AETHER_AUTOMATION_BIN"], "mcp"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env={
            **os.environ,
            "AETHER_SERVER_URL": http_host,
            "AETHER_AUTOMATION_TOKEN": issued["token"],
        },
    )

    replies = queue.Queue(maxsize=8)

    def read_replies():
        for line in process.stdout:
            replies.put(line)

    reader = threading.Thread(target=read_replies, daemon=True)
    reader.start()

    def send(frame, reply=True):
        process.stdin.write(json.dumps(frame) + "\n")
        process.stdin.flush()
        if reply:
            return json.loads(replies.get(timeout=10))

    try:
        send(
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2025-11-25",
                    "capabilities": {},
                    "clientInfo": {"name": "test", "version": "1"},
                },
            }
        )
        send({"jsonrpc": "2.0", "method": "notifications/initialized"}, reply=False)
        catalog = send({"jsonrpc": "2.0", "id": 2, "method": "tools/list"})
        assert "document_rename" in {c["name"] for c in catalog["result"]["tools"]}
        setup[2](
            "/api/automation/connections/revoke", {"id": issued["connection"]["id"]}
        )
        response = send(
            {
                "jsonrpc": "2.0",
                "id": 3,
                "method": "tools/call",
                "params": {
                    "name": "document_rename",
                    "arguments": {
                        "app": "map",
                        "id": setup[3]["id"],
                        "name": "Denied",
                        "expected_revision": 1,
                    },
                },
            }
        )
        assert response["result"]["isError"] is True
        assert json.loads(response["result"]["content"][0]["text"])["status"] == 401
        assert issued["token"] not in json.dumps(response)
        process.stdin.close()
        assert process.wait(timeout=10) == 0
        assert not process.stderr.read()
    finally:
        if process.poll() is None:
            process.kill()
        process.wait(timeout=10)
        reader.join(timeout=2)

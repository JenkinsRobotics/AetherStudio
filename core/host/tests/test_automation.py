"""The agent bridge cannot exceed the user's document/app permissions."""

import base64
import io
import json
import os
import subprocess
import sys
import threading
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

import pytest

from core.host.automation.client import Client, ClientError
from core.host.automation.mcp import MAX_LINE, Server
from core.host.backup import restore
from core.host.products import Products
from core.host.server import StudioHost, make_handler
from core.host.state import Problem

PASSWORD = "automation-test-password-only"


@pytest.fixture
def setup(tmp_path):
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("test")
    host = StudioHost(
        tmp_path / "data",
        packages={app: (app, app, dist) for app in ("map", "cad", "ui")},
        products=Products({}),
    )
    host.store.create_user("owner", PASSWORD, "admin", False)
    host.store.create_user("member", PASSWORD, "member", False)
    tokens = {
        name: host.store.sign_in(name, PASSWORD, "127.0.0.1")
        for name in ("owner", "member")
    }

    def call(path, data=None, who="owner"):
        with host.lock:
            return host.dispatch(path, data or {}, tokens.get(who, who), "127.0.0.1")

    created = call(
        "/api/library/create",
        {
            "app": "map",
            "name": "Show.aethermap",
            "data_base64": base64.b64encode(b'{"scene":"original"}').decode(),
        },
    )
    yield host, tokens, call, created
    host.agents.close()
    host.store.db.close()


def grant(setup, who="owner", **options):
    return setup[2](
        "/api/automation/connections/create",
        {"label": "Test agent", "apps": ["map"], **options},
        who,
    )


def run(setup, token, command, **args):
    return setup[2](
        "/api/automation/commands/run",
        {"id": command, "arguments": {"app": "map", **args}},
        token,
    )["result"]


def refused(status, operation):
    with pytest.raises(Problem) as error:
        operation()
    assert error.value.status == status


def test_secret_is_hashed_and_read_only_is_default(setup):
    issued = grant(setup)
    token = issued["token"]
    row = setup[0].store.db.execute("SELECT * FROM automation_grants").fetchone()
    assert row["token_hash"] != token and not row["can_write"]
    listing = setup[2]("/api/automation/connections/list")
    assert token not in json.dumps(listing) and "token_hash" not in json.dumps(listing)
    catalog = setup[2]("/api/automation/commands/list", who=token)
    assert len(catalog["commands"]) == 3
    assert not any(c["writes"] for c in catalog["commands"])
    assert run(setup, token, "document.list")["files"][0]["id"] == setup[3]["id"]
    refused(
        403,
        lambda: run(
            setup,
            token,
            "document.rename",
            id=setup[3]["id"],
            name="Changed",
            expected_revision=1,
        ),
    )


def test_permission_checked_mutation_keeps_history_and_conflict_guard(setup):
    token = grant(setup, can_write=True)["token"]
    inspected = run(setup, token, "document.inspect", id=setup[3]["id"])
    assert inspected["saved_state_only"] and inspected["text"] == '{"scene":"original"}'
    assert "data_base64" not in inspected
    changed = run(
        setup,
        token,
        "document.rename",
        id=inspected["id"],
        name="Renamed.aethermap",
        expected_revision=inspected["revision"],
    )
    assert changed["revision"] == 2
    refused(
        409,
        lambda: run(
            setup,
            token,
            "document.rename",
            id=inspected["id"],
            name="Stale",
            expected_revision=1,
        ),
    )
    run(
        setup,
        token,
        "document.version.create",
        id=inspected["id"],
        name="Approved",
        expected_revision=2,
    )
    history = run(setup, token, "document.history", id=inspected["id"])
    assert history["revisions"][0]["event"] == "rename"
    assert history["versions"][0]["name"] == "Approved"
    refused(
        409,
        lambda: run(
            setup,
            token,
            "document.version.create",
            id=inspected["id"],
            name="Stale",
            expected_revision=1,
        ),
    )
    row = setup[0].library.entry(
        setup[0].store.user_for(setup[1]["owner"])["id"], "map", inspected["id"]
    )
    assert row["content"] == b'{"scene":"original"}'
    assert any(
        r[0] == "automation_command"
        for r in setup[0].store.db.execute("SELECT action FROM audit")
    )


def test_user_cannot_gain_another_users_documents_or_connections(setup):
    own = grant(setup)
    member = grant(setup, who="member", can_write=True)
    assert run(setup, member["token"], "document.list")["files"] == []
    refused(
        404, lambda: run(setup, member["token"], "document.inspect", id=setup[3]["id"])
    )
    refused(
        404,
        lambda: setup[2](
            "/api/automation/connections/revoke",
            {"id": own["connection"]["id"]},
            "member",
        ),
    )
    refused(
        403, lambda: setup[2]("/api/automation/connections/create", {}, member["token"])
    )
    assert (
        setup[2]("/api/automation/connections/list", who="member")["connections"][0][
            "id"
        ]
        == member["connection"]["id"]
    )


def test_current_file_roles_and_app_scopes_are_enforced(setup):
    token = grant(setup, who="member", can_write=True)["token"]
    setup[2](
        "/api/library/share",
        {
            "app": "map",
            "id": setup[3]["id"],
            "expected_revision": 1,
            "scope": "workspace",
        },
    )
    assert run(setup, token, "document.inspect", id=setup[3]["id"])["writable"] is False
    refused(
        404,
        lambda: run(
            setup,
            token,
            "document.rename",
            id=setup[3]["id"],
            expected_revision=2,
            name="No",
        ),
    )
    refused(403, lambda: run(setup, token, "document.list", app="cad"))
    setup[0].store.db.execute("UPDATE applications SET enabled=0 WHERE id='map'")
    setup[0].store.db.commit()
    refused(403, lambda: run(setup, token, "document.list"))
    assert setup[2]("/api/automation/commands/list", who=token)["commands"] == []


@pytest.mark.parametrize(
    "action", ["revoke", "expire", "password", "disable", "restrict"]
)
def test_access_is_rechecked_on_every_request(setup, action):
    issued = grant(setup, who="member")
    db = setup[0].store.db
    uid = setup[0].store.user_for(setup[1]["member"])["id"]
    if action == "revoke":
        setup[2](
            "/api/automation/connections/revoke",
            {"id": issued["connection"]["id"]},
            "member",
        )
    elif action == "expire":
        db.execute("UPDATE automation_grants SET expires=0")
    elif action == "password":
        setup[0].store.reset_password(uid, PASSWORD + "new")
    elif action == "disable":
        db.execute("UPDATE users SET active=0 WHERE id=?", (uid,))
    else:
        db.execute("UPDATE app_access SET restricted=1 WHERE id='map'")
    db.commit()
    refused(
        403 if action == "restrict" else 401,
        lambda: run(setup, issued["token"], "document.list"),
    )


@pytest.mark.parametrize(
    "bad",
    [
        {"apps": ["ui"]},
        {"apps": []},
        {"apps": [12]},
        {"lifetime_hours": 169},
        {"lifetime_hours": True},
        {"can_write": "yes"},
    ],
)
def test_invalid_grants_are_rejected(setup, bad):
    refused(400, lambda: grant(setup, **bad))


def test_unknown_fields_invalid_revision_and_unknown_commands(setup):
    token = grant(setup, can_write=True)["token"]
    refused(400, lambda: run(setup, token, "document.list", surprise="value"))
    refused(
        400,
        lambda: run(
            setup,
            token,
            "document.rename",
            id=setup[3]["id"],
            name="No",
            expected_revision=True,
        ),
    )
    refused(404, lambda: run(setup, token, "shell.execute"))
    refused(401, lambda: setup[2]("/api/automation/commands/list"))


def test_inspection_bounds_large_utf8_and_binary(setup):
    token = grant(setup)["token"]
    for content, kind in [(("€" * 40000).encode(), "text"), (b"\x00\xff", "binary")]:
        created = setup[2](
            "/api/library/create",
            {
                "app": "map",
                "name": "Media",
                "data_base64": base64.b64encode(content).decode(),
            },
        )
        result = run(setup, token, "document.inspect", id=created["id"])
        assert result["content_kind"] == kind
        assert len((result["text"] or "").encode()) <= 65536
        assert result["truncated"] == (kind == "text")


def test_backup_restore_never_restores_agent_credentials(setup, tmp_path):
    token = grant(setup)["token"]
    name = setup[0].backup()
    archive = setup[0].store.directory / "backups" / name
    restore(archive, tmp_path / "restored")
    restored = StudioHost(tmp_path / "restored", products=Products({}))
    try:
        assert (
            restored.store.db.execute(
                "SELECT count(*) FROM automation_grants"
            ).fetchone()[0]
            == 0
        )
        refused(401, lambda: restored.automation.authorize(token))
        assert setup[0].automation.authorize(
            token
        )  # Backup does not revoke the live installation.
    finally:
        restored.agents.close()
        restored.store.db.close()


@pytest.fixture
def http_host(setup):
    host = setup[0]
    server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(host))
    server.daemon_threads = True
    url = f"http://127.0.0.1:{server.server_port}"
    host.running_settings["public_url"] = url
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield url
    server.shutdown()
    server.server_close()
    thread.join()


def test_real_http_auth_origin_and_admin_boundary(setup, http_host):
    token = grant(setup)["token"]
    client = Client(http_host, token)
    assert len(client.call("list", {})["commands"]) == 3
    for path, origin, status in [
        ("/api/admin/backup", None, 401),
        ("/api/automation/connections/create", None, 401),
        ("/api/automation/commands/list", "https://untrusted.test", 403),
    ]:
        headers = {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token,
        }
        if origin:
            headers["Origin"] = origin
        request = urllib.request.Request(http_host + path, data=b"{}", headers=headers)
        with pytest.raises(urllib.error.HTTPError) as error:
            urllib.request.urlopen(request)
        assert error.value.code == status
    with pytest.raises(ClientError) as error:
        Client(http_host, "aether_agent_invalid").call("list", {})
    assert error.value.status == 401


@pytest.mark.parametrize(
    "url",
    [
        "https://external.test",
        "http://localhost:8781",
        "http://127.0.0.1.evil.test:8781",
        "http://user:pass@127.0.0.1:8781",
        "http://127.0.0.1:8781/?token=x",
        "http://127.0.0.1:8781/path",
        "http://127.0.0.1:8781#secret",
    ],
)
def test_client_only_accepts_literal_loopback_origin(url):
    with pytest.raises(ValueError):
        Client(url, "aether_agent_test")


@pytest.mark.parametrize("bridge", ["python", "rust"])
def test_real_stdio_mcp_edits_through_host_and_survives_conflict(
    setup, http_host, bridge
):
    executable = [sys.executable, "-m", "core.host.automation"]
    if bridge == "rust":
        binary = os.environ.get("AETHER_AUTOMATION_BIN")
        if not binary:
            pytest.skip("Set AETHER_AUTOMATION_BIN to qualify the Rust bridge")
        executable = [binary]
    token = grant(setup, can_write=True)["token"]

    def request(ident, method, params=None):
        return {"jsonrpc": "2.0", "id": ident, "method": method, "params": params or {}}

    calls = [
        request(
            1,
            "initialize",
            {
                "protocolVersion": "2025-11-25",
                "capabilities": {},
                "clientInfo": {"name": "test", "version": "1"},
            },
        ),
        {"jsonrpc": "2.0", "method": "notifications/initialized"},
        request(2, "tools/list"),
        request(
            3,
            "tools/call",
            {
                "name": "document_rename",
                "arguments": {
                    "app": "map",
                    "id": setup[3]["id"],
                    "name": "MCP renamed",
                    "expected_revision": 1,
                },
            },
        ),
        request(
            4,
            "tools/call",
            {
                "name": "document_rename",
                "arguments": {
                    "app": "map",
                    "id": setup[3]["id"],
                    "name": "Stale",
                    "expected_revision": 1,
                },
            },
        ),
        request(
            5,
            "tools/call",
            {
                "name": "document_inspect",
                "arguments": {"app": "map", "id": setup[3]["id"]},
            },
        ),
    ]
    result = subprocess.run(
        [*executable, "mcp"],
        input="\n".join(json.dumps(c) for c in calls) + "\n",
        text=True,
        capture_output=True,
        check=False,
        env={
            **os.environ,
            "AETHER_SERVER_URL": http_host,
            "AETHER_AUTOMATION_TOKEN": token,
        },
        timeout=15,
    )
    assert result.returncode == 0, result.stderr
    replies = [json.loads(line) for line in result.stdout.splitlines()]
    assert len(replies) == 5 and token not in result.stdout + result.stderr
    assert (
        replies[1]["result"]["tools"][0]["inputSchema"]["additionalProperties"] is False
    )
    assert replies[2]["result"]["structuredContent"]["result"]["revision"] == 2
    assert replies[3]["result"]["isError"] is True
    assert replies[4]["result"]["structuredContent"]["result"]["name"] == "MCP renamed"


def test_protocol_invalid_frames_and_oversize_do_not_stop_server():
    server = Server(None)
    output = io.StringIO()
    wire = (
        b"{invalid}\n"
        + b"x" * (MAX_LINE + 1)
        + b"\n"
        + b'{"jsonrpc":"2.0","id":1,"method":"ping"}\n'
    )
    server.serve(io.BytesIO(wire), output)
    replies = [json.loads(line) for line in output.getvalue().splitlines()]
    assert [reply.get("error", {}).get("code") for reply in replies] == [
        -32700,
        -32600,
        None,
    ]
    assert (
        server.handle({"jsonrpc": "2.0", "id": 2, "method": "tools/list"})["error"][
            "code"
        ]
        == -32000
    )
    assert (
        server.handle(
            {"jsonrpc": "2.0", "method": "notifications/cancelled", "params": {}}
        )
        is None
    )


def test_app_scope_cannot_rename_a_different_apps_shared_folder(setup):
    folder = setup[2](
        "/api/library/create", {"app": "cad", "name": "CAD folder", "kind": "folder"}
    )
    token = grant(setup, can_write=True)["token"]
    assert folder["id"] not in [
        item["id"] for item in run(setup, token, "document.list")["files"]
    ]
    refused(
        404,
        lambda: run(
            setup,
            token,
            "document.rename",
            id=folder["id"],
            name="Outside scope",
            expected_revision=1,
        ),
    )


def test_agent_credentials_survive_host_restart_until_revoked(setup):
    issued = grant(setup)
    reopened = StudioHost(
        setup[0].store.directory, packages=setup[0].packages, products=Products({})
    )
    try:
        assert (
            reopened.automation.authorize(issued["token"])[1]["id"]
            == issued["connection"]["id"]
        )
        setup[2](
            "/api/automation/connections/revoke", {"id": issued["connection"]["id"]}
        )
        refused(401, lambda: reopened.automation.authorize(issued["token"]))
    finally:
        reopened.agents.close()
        reopened.store.db.close()


def test_boolean_command_arguments_require_real_json_booleans():
    from core.host.automation.commands import schema, validate

    definition = schema({"reverse": {"type": "boolean"}}, ["reverse"])
    for value in (True, False):
        validate({"reverse": value}, definition)
    for value in (0, 1, "true", "false", None, [], {}):
        with pytest.raises(Problem):
            validate({"reverse": value}, definition)

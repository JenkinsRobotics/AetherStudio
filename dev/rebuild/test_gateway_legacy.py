"""Real Rust HTTP process -> disposable Python authority -> actual saved history.

Build first: cargo build --locked -p aether-server.
No product worker, running installation, existing account or document is used.
"""

import base64
import json
import os
import re
import subprocess
import sys
import threading
import time
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import ProxyHandler, Request, build_opener

import pytest

from core.host.automation.client import Client
from core.host.products import Products
from core.host.server import StudioHost, make_handler

ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture
def gateway(tmp_path):
    binary = ROOT / "target/debug/aether-server"
    assert binary.is_file(), "Build the Rust server before running this gate."
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("Disposable framework acceptance fixture")
    host = StudioHost(
        tmp_path / "data",
        packages={app: (app, app, dist) for app in ("map", "cad", "ui")},
        products=Products({}),
    )
    server = None
    process = None
    thread = None
    try:
        host.store.create_user("owner", "framework-test-password-only", "admin", False)
        session = host.store.sign_in(
            "owner", "framework-test-password-only", "127.0.0.1"
        )

        def dispatch(path, data=None):
            with host.lock:
                return host.dispatch(path, data or {}, session, "127.0.0.1")

        document = dispatch(
            "/api/library/create",
            {
                "app": "map",
                "name": "Fixture.aethermap",
                "data_base64": base64.b64encode(b'{"scene":"original"}').decode(),
            },
        )
        # A real binary64 rounding boundary: default serde_json parsing used to
        # shift this timestamp by one ULP on its journey through the gateway.
        # Pin it so compatibility cannot depend on the current wall-clock digits.
        host.store.db.execute(
            "UPDATE library SET created=?,modified=? WHERE id=?",
            (1791664024.3650339, 1791664024.3650339, document["id"]),
        )
        host.store.db.commit()
        writable = dispatch(
            "/api/automation/connections/create",
            {
                "label": "Rust acceptance",
                "apps": ["map"],
                "can_write": True,
            },
        )
        readonly = dispatch(
            "/api/automation/connections/create",
            {
                "label": "Read-only acceptance",
                "apps": ["map"],
            },
        )
        drop_next_response = threading.Event()
        malformed_next_result = threading.Event()

        class FaultHandler(make_handler(host)):
            def reply(self, status, data, mime="application/json", headers=None):
                if (
                    status == 200
                    and self.path.endswith("/commands/run")
                    and drop_next_response.is_set()
                ):
                    # Dispatch has committed. Close without sending the result.
                    drop_next_response.clear()
                    self.close_connection = True
                    return
                if (
                    status == 200
                    and self.path.endswith("/commands/run")
                    and malformed_next_result.is_set()
                ):
                    malformed_next_result.clear()
                    data = {
                        "command": data["command"],
                        "result": {"revision": "broken"},
                    }
                super().reply(status, data, mime, headers)

        server = ThreadingHTTPServer(("127.0.0.1", 0), FaultHandler)
        server.daemon_threads = True
        upstream = f"http://127.0.0.1:{server.server_port}"
        host.running_settings["public_url"] = upstream
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        log = tmp_path / "gateway.log"
        with log.open("w") as output:
            process = subprocess.Popen(
                [str(binary)],
                cwd=ROOT,
                env={
                    **os.environ,
                    "AETHER_RUST_LISTEN": "127.0.0.1:0",
                    "AETHER_LEGACY_URL": upstream,
                },
                stdout=output,
                stderr=output,
            )
        deadline = time.monotonic() + 10
        url = None
        while time.monotonic() < deadline:
            assert process.poll() is None, "Rust gateway exited during startup."
            match = re.search(r"gateway on (127\.0\.0\.1:\d+)", log.read_text())
            if match:
                url = "http://" + match[1]
                try:
                    with build_opener(ProxyHandler({})).open(
                        url + "/healthz", timeout=1
                    ):
                        break
                except URLError:
                    pass
            time.sleep(0.02)
        else:
            pytest.fail("Rust gateway did not become healthy within ten seconds.")
        yield {
            "url": url,
            "upstream": upstream,
            "document": document,
            "writable": writable,
            "readonly": readonly,
            "dispatch": dispatch,
            "drop_next_response": drop_next_response,
            "malformed_next_result": malformed_next_result,
        }
    finally:
        if process is not None:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)
        if server is not None:
            server.shutdown()
            server.server_close()
        if thread is not None:
            thread.join(timeout=5)
        host.agents.close()
        host.store.db.close()


def http(g, path, token=None, body=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    request = Request(
        g["url"] + path,
        data=None if body is None else json.dumps(body).encode(),
        headers=headers,
    )
    try:
        response = build_opener(ProxyHandler({})).open(request, timeout=5)
    except HTTPError as error:
        response = error
    with response:
        return response.status, json.load(response)


def command(g, name, arguments, token=None):
    return http(
        g,
        "/v1/commands/run",
        token or g["writable"]["token"],
        {
            "protocol_version": 1,
            "request_id": "acceptance:1",
            "command": name,
            "arguments": {"app": "map", **arguments},
        },
    )


def test_catalog_matches_authority_and_capabilities_are_honest(gateway):
    g = gateway
    token = g["writable"]["token"]
    direct = Client(g["upstream"], token).call("list", {})
    status, typed = http(g, "/v1/commands", token)
    assert status == 200 and typed == direct
    assert Client(g["url"], token).call("list", {}) == direct
    assert (
        len(typed["commands"]) == 5
    )  # Platform commands; no installed product worker.
    status, capabilities = http(g, "/v1/capabilities")
    assert status == 200
    assert capabilities["mode"] == "legacy_authority_gateway"
    assert capabilities["studio_command_profile_version"] == 1
    assert not any(
        capabilities[key]
        for key in ("persistent_storage", "live_collaboration", "durable_retries")
    )


def test_saved_revision_history_readonly_and_revocation(gateway):
    g = gateway
    ident = g["document"]["id"]
    status, result = command(g, "document.inspect", {"id": ident})
    assert status == 200 and result["result"]["revision"] == 1
    assert result["result"]["text"] == '{"scene":"original"}'
    status, result = command(
        g,
        "document.rename",
        {"id": ident, "name": "Saved.aethermap", "expected_revision": 1},
    )
    assert status == 200 and result["result"]["revision"] == 2
    status, result = command(
        g,
        "document.rename",
        {"id": ident, "name": "Stale.aethermap", "expected_revision": 1},
    )
    assert status == 409 and result["error"]["code"] == "conflict"
    status, result = command(
        g,
        "document.rename",
        {"id": ident, "name": "Forbidden.aethermap", "expected_revision": 2},
        g["readonly"]["token"],
    )
    assert status == 403 and result["error"]["code"] == "forbidden"
    status, history = command(g, "document.history", {"id": ident})
    assert status == 200
    assert sum(r["event"] == "rename" for r in history["result"]["revisions"]) == 1
    status, inspected = command(g, "document.inspect", {"id": ident})
    assert status == 200 and inspected["result"]["name"] == "Saved.aethermap"
    assert inspected["result"]["revision"] == 2
    assert inspected["result"]["text"] == '{"scene":"original"}'
    g["dispatch"](
        "/api/automation/connections/revoke", {"id": g["writable"]["connection"]["id"]}
    )
    status, result = command(g, "document.inspect", {"id": ident})
    assert status == 401 and result["error"]["code"] == "unauthenticated"


def test_existing_cli_and_stdio_mcp_use_rust_origin(gateway):
    g = gateway
    env = {
        **os.environ,
        "AETHER_SERVER_URL": g["url"],
        "AETHER_AUTOMATION_TOKEN": g["readonly"]["token"],
    }
    result = subprocess.run(
        [sys.executable, "-m", "core.host.automation", "list"],
        env=env,
        cwd=ROOT,
        capture_output=True,
        text=True,
        timeout=10,
        check=True,
    )
    assert len(json.loads(result.stdout)["commands"]) == 3
    messages = [
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2025-11-25",
                "capabilities": {},
                "clientInfo": {"name": "acceptance", "version": "1"},
            },
        },
        {"jsonrpc": "2.0", "method": "notifications/initialized"},
        {"jsonrpc": "2.0", "id": 2, "method": "tools/list"},
        {
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {
                "name": "document_inspect",
                "arguments": {"app": "map", "id": g["document"]["id"]},
            },
        },
    ]
    result = subprocess.run(
        [sys.executable, "-m", "core.host.automation", "mcp"],
        env=env,
        cwd=ROOT,
        input="".join(json.dumps(m) + "\n" for m in messages),
        capture_output=True,
        text=True,
        timeout=10,
        check=True,
    )
    responses = [json.loads(line) for line in result.stdout.splitlines()]
    assert len(responses) == 3
    assert len(responses[1]["result"]["tools"]) == 3
    assert (
        responses[2]["result"]["structuredContent"]["result"]["text"]
        == '{"scene":"original"}'
    )


def test_committed_save_survives_a_lost_response_without_replay(gateway):
    g = gateway
    ident = g["document"]["id"]
    g["drop_next_response"].set()
    status, result = command(
        g,
        "document.rename",
        {
            "id": ident,
            "name": "Committed.aethermap",
            "expected_revision": 1,
        },
    )
    assert status == 502 and result["error"]["code"] == "outcome_unknown"
    assert result["error"]["execution"] == "unknown"
    status, inspected = command(g, "document.inspect", {"id": ident})
    assert status == 200 and inspected["result"]["revision"] == 2
    assert inspected["result"]["name"] == "Committed.aethermap"
    status, history = command(g, "document.history", {"id": ident})
    assert status == 200
    assert sum(r["event"] == "rename" for r in history["result"]["revisions"]) == 1


def test_profiles_respect_grants_revocation_and_server_history_semantics(gateway):
    g = gateway
    status, profiles = http(g, "/v1/commands/profiles", g["readonly"]["token"])
    assert status == 200 and profiles["profile_version"] == 1
    commands = {c["descriptor"]["id"]: c["semantics"] for c in profiles["commands"]}
    assert set(commands) == {"document.list", "document.inspect", "document.history"}
    assert commands["document.inspect"]["may_update_recents"]
    assert all(
        c["studio_required"] and not c["durable_replay"] for c in commands.values()
    )
    status, profiles = http(g, "/v1/commands/profiles", g["writable"]["token"])
    assert status == 200
    commands = {c["descriptor"]["id"]: c["semantics"] for c in profiles["commands"]}
    assert commands["document.rename"]["history"] == "append_revision"
    assert commands["document.version.create"]["history"] == "name_existing_revision"
    assert commands["document.version.create"]["revision_guard"] == "branch_head"
    assert not any(c["editor_undo"] for c in commands.values())
    g["dispatch"](
        "/api/automation/connections/revoke", {"id": g["readonly"]["connection"]["id"]}
    )
    status, _ = http(g, "/v1/commands/profiles", g["readonly"]["token"])
    assert status == 401  # Discovery must not serve a cached grant after revocation.
    assert http(g, "/v1/commands/profiles")[0] == 401


def test_typed_studio_results_match_authority_and_named_version_does_not_save(gateway):
    g = gateway
    ident = g["document"]["id"]
    client = Client(g["upstream"], g["writable"]["token"])
    for name, arguments in [
        ("document.list", {}),
        ("document.inspect", {"id": ident}),
        ("document.history", {"id": ident}),
    ]:
        direct = client.call(
            "run", {"id": name, "arguments": {"app": "map", **arguments}}
        )
        status, typed = command(g, name, arguments)
        assert status == 200 and typed["result"] == direct["result"]
    status, version = command(
        g,
        "document.version.create",
        {"id": ident, "name": "First", "expected_revision": 1},
    )
    assert status == 200 and version["result"] == {"ok": True, "revision": 1}
    status, history = command(g, "document.history", {"id": ident})
    assert status == 200 and len(history["result"]["revisions"]) == 1
    assert len(history["result"]["versions"]) == 1
    # A retry is not represented as durable replay: the name is already taken.
    assert (
        command(
            g,
            "document.version.create",
            {"id": ident, "name": "First", "expected_revision": 1},
        )[0]
        == 409
    )
    status, listed = command(g, "document.list", {})
    assert status == 200 and listed["result"]["files"][0]["versions"] == 1
    assert listed["result"]["files"][0]["revision"] == 1


def test_bad_success_body_after_commit_preserves_unknown_outcome(gateway):
    g = gateway
    ident = g["document"]["id"]
    g["malformed_next_result"].set()
    status, result = command(
        g,
        "document.rename",
        {
            "id": ident,
            "name": "Actually saved.aethermap",
            "expected_revision": 1,
        },
    )
    assert status == 502 and result["error"]["execution"] == "unknown"
    status, inspected = command(g, "document.inspect", {"id": ident})
    assert status == 200 and inspected["result"]["name"] == "Actually saved.aethermap"
    assert inspected["result"]["revision"] == 2
    status, history = command(g, "document.history", {"id": ident})
    assert status == 200 and len(history["result"]["revisions"]) == 2


def test_typed_profile_preserves_global_revision_numbers_across_branches(gateway):
    g = gateway
    ident = g["document"]["id"]
    target = {"app": "map", "id": ident}
    g["dispatch"](
        "/api/library/branch_create",
        {**target, "name": "Alternate", "expected_revision": 1},
    )
    g["dispatch"](
        "/api/library/save",
        {
            **target,
            "branch": "Alternate",
            "expected_revision": 1,
            "data_base64": base64.b64encode(b'{"scene":"alternate"}').decode(),
        },
    )
    status, inspected = command(
        g, "document.inspect", {"id": ident, "branch": "Alternate"}
    )
    assert status == 200 and inspected["result"]["revision"] == 2
    assert inspected["result"]["text"] == '{"scene":"alternate"}'
    status, named = command(
        g,
        "document.version.create",
        {
            "id": ident,
            "branch": "Alternate",
            "expected_revision": 2,
            "name": "Alternative",
        },
    )
    assert status == 200 and named["result"]["revision"] == 2
    status, renamed = command(
        g,
        "document.rename",
        {
            "id": ident,
            "name": "Main renamed",
            "expected_revision": 1,
        },
    )
    # Main had revision1, but revision2 belongs to another branch. Never assume
    # that the new revision is expected_revision + 1 in the legacy authority.
    assert status == 200 and renamed["result"]["revision"] == 3
    status, history = command(g, "document.history", {"id": ident})
    assert status == 200
    assert {b["name"]: b["head_revision"] for b in history["result"]["branches"]} == {
        "Main": 3,
        "Alternate": 2,
    }

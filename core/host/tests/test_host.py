import hashlib
import json
import socket
import threading
import time
import urllib.error
import urllib.request
import zipfile
from http.server import ThreadingHTTPServer

import pytest

from core.host.backup import restore
from core.host.server import StudioHost, make_handler, validate_settings
from core.host.state import DEFAULT_SETTINGS, Problem, Store

PASSWORD = "test-password-not-for-real-use"


@pytest.fixture
def host(tmp_path):
    instance = StudioHost(tmp_path / "data")
    uid = instance.store.create_user("owner", PASSWORD, "admin", False)
    token = instance.store.sign_in("owner", PASSWORD, "127.0.0.1")
    return instance, uid, token


def call(host, path, data, token=None):
    instance, _, admin_token = host
    with instance.lock:
        return instance.dispatch(
            path, data, token if token is not None else admin_token, "127.0.0.1"
        )


def member(host):
    uid = host[0].store.create_user("member", PASSWORD, "member", False)
    return uid, host[0].store.sign_in("member", PASSWORD, "127.0.0.1")


def test_setup_is_claimed_once_and_password_is_hashed(tmp_path):
    instance = StudioHost(tmp_path)
    with pytest.raises(Problem) as error:
        instance.dispatch(
            "/api/setup",
            {"token": "wrong", "username": "owner", "password": PASSWORD},
            "",
            "127.0.0.1",
        )
    assert error.value.status == 403
    token = instance.store.setup_path.read_text()
    instance.dispatch(
        "/api/setup",
        {
            "token": token,
            "username": "owner",
            "password": PASSWORD,
            "full_name": "Test Owner",
            "email": "owner@example.test",
        },
        "",
        "127.0.0.1",
    )
    assert not instance.store.setup_path.exists()
    assert (
        instance.store.db.execute("SELECT password FROM users").fetchone()[0]
        != PASSWORD
    )
    with pytest.raises(Problem) as error:
        instance.dispatch("/api/setup", {"token": token}, "", "127.0.0.1")
    assert error.value.status == 409


def test_member_cannot_admin_or_read_other_user_files(host):
    uid, token = member(host)
    with pytest.raises(Problem) as error:
        call(host, "/api/admin/apps", {"id": "cad", "enabled": False}, token)
    assert error.value.status == 403
    root = host[0].root_for(uid)
    outside = root.parent / host[1] / "secret.txt"
    outside.parent.mkdir(exist_ok=True)
    outside.write_text("private")
    with pytest.raises(Problem) as error:
        call(
            host,
            "/cad/files/save",
            {"path": f"../{host[1]}/secret.txt", "text": "overwrite"},
            token,
        )
    assert error.value.status == 403
    assert outside.read_text() == "private"


def test_engine_handles_are_isolated_by_login_and_app(host):
    instance, _, token = host
    second = instance.store.sign_in("owner", PASSWORD, "127.0.0.1")
    for app, credential in [("cad", token), ("animation", token), ("cad", second)]:
        result = call(
            host,
            f"/{app}/rpc",
            {"id": 1, "method": "new_workspace", "params": {"name": "Test"}},
            credential,
        )
        assert result["ok"]
    assert len(instance.engines) == 3
    assert len({id(session) for session in instance.engines.values()}) == 3


def test_file_save_conflict_and_restart_persistence(host):
    result = call(host, "/animation/files/save", {"path": "scene.txt", "text": "first"})
    assert result["revision"] == hashlib.sha256(b"first").hexdigest()
    with pytest.raises(Problem) as error:
        call(host, "/animation/files/save", {"path": "scene.txt", "text": "stale"})
    assert error.value.status == 409
    call(
        host,
        "/animation/files/save",
        {
            "path": "scene.txt",
            "text": "second",
            "expected_revision": result["revision"],
        },
    )
    reopened = StudioHost(host[0].store.directory)
    assert reopened.store.user_for(host[2])["id"] == host[1]
    assert (reopened.root_for(host[1]) / "scene.txt").read_text() == "second"


def test_reset_revokes_sessions_and_requires_password_change(host):
    uid, token = member(host)
    call(
        host,
        "/api/admin/user",
        {"id": uid, "action": "reset_password", "password": PASSWORD + "new"},
    )
    assert host[0].store.user_for(token) is None
    temporary = host[0].store.sign_in("member", PASSWORD + "new", "127.0.0.1")
    with pytest.raises(Problem) as error:
        call(host, "/cad/rpc", {"method": "hello"}, temporary)
    assert error.value.status == 403
    call(
        host,
        "/api/password",
        {"current_password": PASSWORD + "new", "password": PASSWORD + "final"},
        temporary,
    )
    assert host[0].store.user_for(temporary) is None
    final = host[0].store.sign_in("member", PASSWORD + "final", "127.0.0.1")
    assert not host[0].store.user_for(final)["must_change"]


def test_last_admin_and_self_disable_guard(host):
    with pytest.raises(Problem) as error:
        call(
            host,
            "/api/admin/user",
            {"id": host[1], "action": "update", "role": "member", "active": True},
        )
    assert error.value.status == 409


def test_disabled_user_revoked_immediately(host):
    uid, token = member(host)
    call(
        host,
        "/api/admin/user",
        {"id": uid, "action": "update", "role": "member", "active": False},
    )
    assert host[0].store.user_for(token) is None
    with pytest.raises(Problem):
        host[0].store.sign_in("member", PASSWORD, "127.0.0.1")


def test_app_disable_blocks_rpc(host):
    call(host, "/api/admin/apps", {"id": "cad", "enabled": False})
    with pytest.raises(Problem) as error:
        call(host, "/cad/rpc", {"method": "hello"})
    assert error.value.status == 403


def test_team_membership_enforces_restricted_apps(host):
    uid, token = member(host)
    call(host, "/api/admin/access", {"id": "cad", "restricted": True})
    with pytest.raises(Problem):
        call(
            host,
            "/cad/rpc",
            {"id": 1, "method": "hello", "params": {"protocol_version": 1}},
            token,
        )
    call(host, "/api/admin/team", {"name": "Design", "members": [uid], "apps": ["cad"]})
    assert call(
        host,
        "/cad/rpc",
        {"id": 1, "method": "hello", "params": {"protocol_version": 1}},
        token,
    )["ok"]
    team = host[0].store.db.execute("SELECT id FROM teams").fetchone()[0]
    call(host, "/api/admin/team", {"id": team, "action": "delete"})
    with pytest.raises(Problem):
        call(host, "/cad/rpc", {"method": "hello"}, token)


def test_service_scope_expiry_and_revocation(host):
    secret = call(
        host, "/api/admin/service", {"name": "robot", "apps": ["animation"], "days": 1}
    )["token"]
    assert call(
        host,
        "/animation/rpc",
        {"method": "hello", "params": {"protocol_version": 1}},
        secret,
    )["ok"]
    for path in ("/cad/rpc", "/api/admin/apps"):
        with pytest.raises(Problem) as error:
            call(host, path, {"method": "hello"}, secret)
        assert error.value.status == 403
    service = host[0].store.db.execute("SELECT * FROM services").fetchone()
    assert service["token"] != secret
    call(host, "/api/admin/service", {"id": service["id"], "action": "revoke"})
    assert host[0].store.user_for(secret) is None


def test_network_validation(host):
    validate_settings(DEFAULT_SETTINGS)
    for settings in [
        {**DEFAULT_SETTINGS, "bind_address": "0.0.0.0"},
        {**DEFAULT_SETTINGS, "port": 80},
        {
            **DEFAULT_SETTINGS,
            "public_url": "https://localhost:8780",
            "tls_cert": "/missing",
        },
    ]:
        with pytest.raises(Problem):
            validate_settings(settings)
    call(host, "/api/admin/settings", {**DEFAULT_SETTINGS, "name": "Workshop"})
    assert Store(host[0].store.directory).settings()["name"] == "Workshop"


def test_backup_restore_preserves_saved_work_but_revokes_credentials(host, tmp_path):
    call(host, "/cad/files/save", {"path": "saved.txt", "text": "project"})
    name = call(host, "/api/admin/backup", {})["name"]
    archive = host[0].store.directory / "backups" / name
    with zipfile.ZipFile(archive) as zipped:
        assert "studio.sqlite3" in zipped.namelist()
        assert "setup-token" not in zipped.namelist()
    destination = tmp_path / "restored"
    restore(archive, destination)
    recovered = StudioHost(destination)
    assert recovered.store.ready()
    assert recovered.store.user_for(host[2]) is None
    assert (recovered.root_for(host[1]) / "saved.txt").read_text() == "project"
    with pytest.raises(Problem):
        restore(archive, destination)


def test_restore_rejects_traversal(tmp_path):
    archive = tmp_path / "bad.zip"
    with zipfile.ZipFile(archive, "w") as zipped:
        zipped.writestr("backup.json", '{"version":1}')
        zipped.writestr("../escape", "bad")
    with pytest.raises(Problem):
        restore(archive, tmp_path / "restore")
    assert not (tmp_path / "escape").exists()


def test_login_rate_limit_and_audit_excludes_password(host):
    store = host[0].store
    for _ in range(10):
        with pytest.raises(Problem):
            store.sign_in("owner", "wrong-password", "127.0.0.1")
    with pytest.raises(Problem) as error:
        store.sign_in("owner", PASSWORD, "127.0.0.1")
    assert error.value.status == 429
    assert PASSWORD not in str(
        [tuple(row) for row in store.db.execute("SELECT * FROM audit")]
    )


def test_http_cookie_csrf_and_host_boundary(host):
    instance = host[0]
    server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(instance))
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    origin = f"http://127.0.0.1:{server.server_port}"
    try:

        def request(path, data=None, headers=None):
            return urllib.request.urlopen(
                urllib.request.Request(
                    origin + path,
                    data=json.dumps(data).encode() if data is not None else None,
                    headers=headers or {},
                )
            )

        for headers in [
            {"Content-Type": "application/json"},
            {"Content-Type": "application/json", "Origin": "https://evil.example"},
            {
                "Host": "evil.example",
                "Origin": origin,
                "Content-Type": "application/json",
            },
        ]:
            with pytest.raises(urllib.error.HTTPError) as error:
                request(
                    "/api/login", {"username": "owner", "password": PASSWORD}, headers
                )
            assert error.value.code == 403
        response = request(
            "/api/login",
            {"username": "owner", "password": PASSWORD},
            {"Origin": origin, "Content-Type": "application/json"},
        )
        cookie = response.headers["Set-Cookie"]
        assert "HttpOnly" in cookie and "SameSite=Strict" in cookie
        state = json.load(request("/api/admin/state", headers={"Cookie": cookie}))
        assert "password" not in state["mail"]
        assert all("password" not in user for user in state["users"])
        with pytest.raises(urllib.error.HTTPError) as error:
            request("/api/admin/state")
        assert error.value.code == 401
        with pytest.raises(urllib.error.HTTPError) as error:
            request(
                "/api/login", [], {"Origin": origin, "Content-Type": "application/json"}
            )
        assert error.value.code == 400
    finally:
        server.shutdown()
        server.server_close()


def test_setup_persists_workspace_and_app_choices_atomically(tmp_path):
    packages = {}
    for app in ("cad", "animation", "ui"):
        directory = tmp_path / app
        directory.mkdir()
        (directory / "index.html").write_text("built")
        packages[app] = (app, app, directory)
    instance = StudioHost(tmp_path / "data", packages)
    token = instance.store.setup_path.read_text()
    payload = {
        "token": token,
        "username": "owner",
        "password": PASSWORD,
        "full_name": "Test Owner",
        "email": "owner@example.test",
        "name": "Workshop",
        "apps": ["animation"],
    }
    with pytest.raises(Problem):
        instance.dispatch(
            "/api/setup", {**payload, "password": "short"}, "", "127.0.0.1"
        )
    assert not instance.store.ready()
    assert instance.store.settings()["name"] == "Aether Studio"
    assert instance.store.setup_path.exists()
    with pytest.raises(Problem):
        instance.dispatch(
            "/api/setup", {**payload, "apps": ["uninstalled"]}, "", "127.0.0.1"
        )
    assert not instance.store.ready()
    instance.dispatch("/api/setup", payload, "", "127.0.0.1")
    assert instance.store.settings()["name"] == "Workshop"
    assert instance.running_settings["name"] == "Workshop"
    assert dict(instance.store.db.execute("SELECT id,enabled FROM applications")) == {
        "cad": 0,
        "animation": 1,
        "ui": 0,
    }
    reopened = Store(instance.store.directory)
    assert reopened.ready() and reopened.settings()["name"] == "Workshop"
    assert not instance.store.setup_path.exists()


def test_theme_settings_flow(tmp_path):
    from core.host.state import Store

    store = Store(tmp_path / "state")
    assert store.settings()["theme"] == {"base": "aether-default", "apps": {}}
    store.db.execute(
        "UPDATE settings SET value=? WHERE key='theme'",
        ('{"base": "community-neon", "apps": {"cad": "aether-default"}}',),
    )
    store.db.commit()
    assert store.settings()["theme"]["base"] == "community-neon"
    assert store.settings()["theme"]["apps"]["cad"] == "aether-default"


def test_a_slow_request_body_does_not_block_other_users(host):
    """One dribbling client must not serialize everyone else's writes.

    Regression: `do_POST` wrapped the whole request — header checks and the
    body read included — in `host.lock`, so a client that sent headers and
    then trickled its body held a global mutex. Every other user's save
    queued behind it. Only `dispatch` needs mutual exclusion.
    """
    instance = host[0]
    server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(instance))
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    origin = f"http://127.0.0.1:{server.server_port}"
    try:
        # A client that announces a body and then stops sending.
        dribbler = socket.create_connection(("127.0.0.1", server.server_port))
        dribbler.sendall(
            b"POST /api/status HTTP/1.1\r\n"
            b"Host: 127.0.0.1\r\n"
            b"Origin: " + origin.encode() + b"\r\n"
            b"Content-Type: application/json\r\n"
            b"Content-Length: 4096\r\n\r\n"
            b'{"a":'  # ...and never the rest
        )

        # Another request must still be served. What matters is that it is
        # answered at all — the status it earns is beside the point.
        started = time.monotonic()
        try:
            status = urllib.request.urlopen(
                urllib.request.Request(
                    f"{origin}/api/status",
                    data=b"{}",
                    headers={"Origin": origin, "Content-Type": "application/json"},
                ),
                timeout=5,
            ).status
        except urllib.error.HTTPError as answered:
            status = answered.code
        elapsed = time.monotonic() - started
        assert status in (200, 401, 403), status
        # The old code blocked until the dribbler's 15 s socket timeout.
        assert elapsed < 3, f"second request waited {elapsed:.1f}s on the first"
        dribbler.close()
    finally:
        server.shutdown()
        server.server_close()


def _freecad_available():
    import sys
    from pathlib import Path

    module = Path(__file__).resolve().parents[3] / "Aether CAD" / "freecad-engine"
    sys.path.insert(0, str(module))
    try:
        from aether_freecad import FreeCADUnavailable, locate_freecad

        try:
            return bool(locate_freecad())
        except FreeCADUnavailable:
            return False
    except ImportError:
        return False


needs_freecad = pytest.mark.skipif(
    not _freecad_available(), reason="FreeCAD is not installed on this machine"
)


@needs_freecad
def test_cad_geometry_route_builds_a_solid_through_freecad(host):
    """The browser's path to the engine: features in, renderable geometry out."""
    result = call(
        host,
        "/api/cad/geometry",
        {
            "features": [
                {"id": "s1", "kind": "sketch-rectangle",
                 "parameters": {"width_mm": 40, "height_mm": 20}},
                {"id": "p1", "kind": "pad",
                 "parameters": {"profile": "s1", "distance_mm": 10}},
            ]
        },
    )
    assert result["status"] == "ok", result
    assert result["engine"].startswith("FreeCAD")
    body = result["bodies"][0]
    assert body["volume_mm3"] == pytest.approx(8000.0, rel=1e-9)
    assert body["face_count"] == 6
    # Everything the renderer needs, over the wire.
    assert len(body["vertices"]) == len(body["normals"]) == 3 * 24
    assert len(body["triangles"]) == 3 * 12
    assert len(body["edge_lines"]) == 12 * 2 * 3
    assert sum(r["count"] for r in body["face_ranges"]) == 12


@needs_freecad
def test_cad_geometry_route_reports_a_bad_feature_without_losing_the_build(host):
    result = call(
        host,
        "/api/cad/geometry",
        {
            "features": [
                {"id": "s1", "kind": "sketch-rectangle",
                 "parameters": {"width_mm": 40, "height_mm": 20}},
                {"id": "p1", "kind": "pad",
                 "parameters": {"profile": "s1", "distance_mm": 10}},
                {"id": "nope", "kind": "not-a-feature", "parameters": {}},
            ]
        },
    )
    assert [d["feature_id"] for d in result["diagnostics"] if d["severity"] == "error"] == ["nope"]
    assert result["bodies"][0]["volume_mm3"] == pytest.approx(8000.0, rel=1e-9)


def test_cad_geometry_route_rejects_a_malformed_feature_list(host):
    with pytest.raises(Problem) as raised:
        call(host, "/api/cad/geometry", {"features": "not a list"})
    assert raised.value.status == 400


@needs_freecad
def test_cad_engine_route_describes_the_engine_and_its_licence(host):
    described = call(host, "/api/cad/engine", {})
    assert described["ok"] is True
    assert described["engine"].startswith("FreeCAD")
    assert described["licence"] == "LGPL-2.1-or-later"


@needs_freecad
@pytest.mark.parametrize(
    "plane,expected",
    [
        # An asymmetric profile, because a symmetric one hides mirroring.
        # Sketch X and Y map to these world axes, and the offset and the pad
        # must both run along the plane's own normal.
        ("XY", {"x": (0, 30), "y": (0, 10), "z": (5, 9)}),
        ("XZ", {"x": (0, 30), "y": (-9, -5), "z": (0, 10)}),
        ("YZ", {"x": (5, 9), "y": (0, 30), "z": (0, 10)}),
    ],
)
def test_sketch_planes_place_and_extrude_along_their_own_normal(host, plane, expected):
    """Regression: YZ was a single axis/angle rotation whose normal disagreed
    with the one used for the offset, so an offset sketch padded the wrong way
    (x 5 -> -15 instead of 5 -> 9). Planes are FreeCAD's datum quaternions now.
    """
    result = call(
        host,
        "/api/cad/geometry",
        {
            "features": [
                {
                    "id": "s1",
                    "kind": "sketch-polygon",
                    "parameters": {
                        "points_mm": [[0, 0], [30, 0], [30, 10], [0, 10]],
                        "plane": plane,
                        "offset_mm": 5,
                    },
                },
                {"id": "e1", "kind": "pad",
                 "parameters": {"profile": "s1", "distance_mm": 4}},
            ]
        },
    )
    body = result["bodies"][0]
    assert body["volume_mm3"] == pytest.approx(30 * 10 * 4, rel=1e-9)
    vertices = body["vertices"]
    for index, axis in enumerate("xyz"):
        values = vertices[index::3]
        low, high = expected[axis]
        assert min(values) == pytest.approx(low, abs=1e-6), f"{plane} {axis} min"
        assert max(values) == pytest.approx(high, abs=1e-6), f"{plane} {axis} max"


@needs_freecad
def test_a_translated_rectangle_document_builds_to_its_own_dimensions(host):
    """What the app's own rectangle Part translates to: 60 x 40 x 20."""
    result = call(
        host,
        "/api/cad/geometry",
        {
            "features": [
                {"id": "s1", "kind": "sketch-polygon", "parameters": {
                    "points_mm": [[-30, -20], [30, -20], [30, 20], [-30, 20]],
                    "plane": "XY", "offset_mm": 0}},
                {"id": "e1", "kind": "pad",
                 "parameters": {"profile": "s1", "distance_mm": 20}},
            ]
        },
    )
    body = result["bodies"][0]
    assert body["volume_mm3"] == pytest.approx(48000.0, rel=1e-9)
    assert body["face_count"] == 6
    assert body["edge_count"] == 12


@needs_freecad
def test_a_circle_profile_pads_into_a_cylinder(host):
    result = call(
        host,
        "/api/cad/geometry",
        {
            "features": [
                {"id": "s1", "kind": "sketch-circle", "parameters": {
                    "radius_mm": 10, "center_mm": [0, 0], "plane": "XY"}},
                {"id": "e1", "kind": "pad",
                 "parameters": {"profile": "s1", "distance_mm": 5}},
            ]
        },
    )
    body = result["bodies"][0]
    import math
    assert body["volume_mm3"] == pytest.approx(math.pi * 100 * 5, rel=1e-3)
    # A cylinder is two planes and one rolled face.
    assert body["face_count"] == 3


@needs_freecad
def test_cad_export_route_returns_selected_native_solid(host):
    import base64
    result = call(host, '/api/cad/export', {
        'format': 'step', 'body_ids': ['plate'],
        'features': [
            {'id': 's', 'kind': 'sketch-rectangle', 'parameters': {'width_mm': 40, 'height_mm': 20}},
            {'id': 'p', 'kind': 'pad', 'parameters': {'profile': 's', 'distance_mm': 10, 'body_id': 'plate', 'operation': 'new'}},
        ],
    })
    assert result['status'] == 'ok', result
    assert result['body_count'] == 1
    assert b'ISO-10303-21' in base64.b64decode(result['data_base64'])


def test_cad_export_requires_authentication_and_supported_format(host):
    with pytest.raises(Problem) as error:
        call(host, '/api/cad/export', {'features': [], 'format': 'step'}, token='invalid')
    assert error.value.status == 401
    with pytest.raises(Problem) as error:
        call(host, '/api/cad/export', {'features': [], 'format': 'exe'})
    assert error.value.status == 400


@needs_freecad
def test_cad_analysis_returns_native_capped_section(host):
    result = call(host, '/api/cad/analysis', {
        'features': [
            {'id': 's', 'kind': 'sketch-rectangle', 'parameters': {'width_mm': 10, 'height_mm': 10}},
            {'id': 'p', 'kind': 'pad', 'parameters': {'profile': 's', 'distance_mm': 10}},
        ],
        'analysis': {'kind': 'section', 'plane': 'XY', 'offset_mm': 5},
    })
    assert result['status'] == 'ok', result
    assert result['bodies'][0]['volume_mm3'] == pytest.approx(500)
    assert result['bodies'][0]['face_count'] == 6


def test_cad_analysis_requires_authentication_and_options(host):
    with pytest.raises(Problem) as error:
        call(host, '/api/cad/analysis', {'features': [], 'analysis': {'kind': 'section'}}, token='invalid')
    assert error.value.status == 401
    with pytest.raises(Problem) as error:
        call(host, '/api/cad/analysis', {'features': []})
    assert error.value.status == 400

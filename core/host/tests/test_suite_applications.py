"""Every registered product follows the same host access and launch contract."""

import json
import threading
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from urllib.parse import urljoin

import pytest

from core.host import server as server_module
from core.host.server import StudioHost, make_handler
from core.host.state import Problem

PASSWORD = "suite-integration-test-password"


@pytest.fixture
def suite(tmp_path, monkeypatch):
    studio = tmp_path / "studio/dist"
    studio.mkdir(parents=True)
    (studio / "index.html").write_text("<title>Aether Studio</title></head>Library home")
    packages = {}
    for app in ("cad", "animation", "ui", "map", "sketch", "vector", "future"):
        bundle = tmp_path / app / "dist"
        (bundle / "assets").mkdir(parents=True)
        (bundle / "index.html").write_text(
            f'<title>Aether {app.title()}</title></head><script src="./assets/app.js"></script>'
        )
        (bundle / "assets/app.js").write_text(f'console.log("{app}")')
        packages[app] = (f"Aether {app.title()}", app, bundle)
    monkeypatch.setattr(server_module, "REPO", tmp_path)
    instance = StudioHost(tmp_path / "data", packages)
    owner = instance.store.create_user("owner", PASSWORD, "admin", False)
    admin_token = instance.store.sign_in("owner", PASSWORD, "127.0.0.1")
    member = instance.store.create_user("member", PASSWORD, "member", False)
    member_token = instance.store.sign_in("member", PASSWORD, "127.0.0.1")
    yield instance, owner, admin_token, member, member_token
    instance.store.db.close()


@pytest.mark.parametrize("app", ["map", "sketch", "vector", "future"])
def test_registered_apps_support_access_teams_services_and_themes(suite, app):
    host, _, token, member_id, member_token = suite

    def admin(path, data):
        return host.dispatch(path, data, token, "127.0.0.1")

    member = host.store.user_for(member_token)
    assert app in {item["id"] for item in host.apps(member)}
    admin("/api/admin/access", {"id": app, "restricted": True})
    with pytest.raises(Problem, match="access"):
        host.require_app(app, member)
    admin("/api/admin/team", {"name": "Creators", "members": [member_id], "apps": [app]})
    host.require_app(app, member)
    admin("/api/admin/service", {"name": "Player", "apps": [app], "days": 1})
    admin("/api/admin/theme", {"base": "aether-default", "apps": {app: "test-theme"}})
    assert host.store.settings()["theme"]["apps"][app] == "test-theme"
    admin("/api/admin/apps", {"id": app, "enabled": False})
    with pytest.raises(Problem, match="disabled"):
        host.require_app(app, member)
    host.store.seed_applications(host.packages)
    assert not next(item for item in host.apps(member) if item["id"] == app)["enabled"]
    admin("/api/admin/apps", {"id": app, "enabled": True})
    host.require_app(app, member)


def test_new_packages_are_added_to_existing_installations_without_reenabling(suite):
    host = suite[0]
    host.store.db.execute("UPDATE applications SET enabled=0 WHERE id='cad'")
    host.store.db.execute("DELETE FROM applications WHERE id='sketch'")
    host.store.db.execute("DELETE FROM app_access WHERE id='sketch'")
    host.store.seed_applications(host.packages)
    assert host.store.db.execute("SELECT enabled FROM applications WHERE id='cad'").fetchone()[0] == 0
    assert host.store.db.execute("SELECT enabled FROM applications WHERE id='sketch'").fetchone()[0] == 1
    assert host.store.db.execute("SELECT restricted FROM app_access WHERE id='sketch'").fetchone()[0] == 0


def test_http_launch_auth_assets_and_disabled_routes(suite):
    host, _, admin_token, _, _ = suite
    server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(host))
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    origin = f"http://127.0.0.1:{server.server_port}"
    try:
        request = urllib.request.Request(
            origin + "/api/login",
            data=json.dumps({"username": "owner", "password": PASSWORD}).encode(),
            headers={"Origin": origin, "Content-Type": "application/json"},
        )
        with urllib.request.urlopen(request) as response:
            cookie = response.headers["Set-Cookie"].split(";", 1)[0]

        def get(path, authenticated=True):
            return urllib.request.urlopen(urllib.request.Request(
                urljoin(origin, path), headers={"Cookie": cookie} if authenticated else {},
            ))

        for app in ("map", "sketch", "vector"):
            with get(f"/{app}/", authenticated=False) as response:
                assert "next=" in response.url
            with get(f"/{app}/") as response:
                page = response.read().decode()
                assert f'<meta name="aether-app" content="{app}">' in page
                assert f"/icons/{app}.png" in page
                assert f"<title>Aether {app.title()}</title>" in page
                if app == "map":
                    assert "Library home" in page
            with get(f"/{app}/index.html") as response:
                assert './assets/app.js' in response.read().decode()
            with get(f"/{app}/assets/app.js") as response:
                assert app in response.read().decode()
            with get(f"/{app}/manifest.webmanifest") as response:
                assert json.load(response)["start_url"] == f"/{app}/"
            with host.lock:
                host.dispatch("/api/admin/apps", {"id": app, "enabled": False}, admin_token, "127.0.0.1")
            for path in (f"/{app}/", f"/{app}/index.html", f"/{app}/assets/app.js"):
                with pytest.raises(urllib.error.HTTPError) as error:
                    get(path)
                assert error.value.code == 403
        with pytest.raises(urllib.error.HTTPError) as error:
            get("/icons/sketch.svg", authenticated=False)
        assert error.value.code == 404
    finally:
        server.shutdown()
        server.server_close()


def test_suite_icons_serve_shared_artwork_and_refuse_escapes(suite, tmp_path):
    """The vanilla suite chrome inlines shared icons over /suite/icons/."""
    host, *_ = suite
    icons = tmp_path / "core/assets/icons"
    icons.mkdir(parents=True)
    (icons / "settings.svg").write_text('<svg stroke="currentColor"/>')
    (tmp_path / "core/session").mkdir(parents=True, exist_ok=True)
    (tmp_path / "core/session/account.js").write_text("// account")
    server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(host))
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    origin = f"http://127.0.0.1:{server.server_port}"
    try:
        # Public: the chrome loads before any session exists.
        with urllib.request.urlopen(origin + "/suite/icons/settings.svg") as response:
            assert response.headers["Content-Type"] == "image/svg+xml"
            assert "currentColor" in response.read().decode()
        for path in (
            "/suite/icons/..%2F..%2Fsession%2Faccount.js.svg",
            "/suite/icons/../../session/account.svg",
            "/suite/icons/Settings.svg",
            "/suite/icons/missing.svg",
        ):
            with pytest.raises(urllib.error.HTTPError) as error:
                urllib.request.urlopen(origin + path)
            assert error.value.code == 404, path
    finally:
        server.shutdown()
        server.server_close()

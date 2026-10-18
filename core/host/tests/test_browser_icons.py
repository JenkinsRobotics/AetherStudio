"""Exercise actual HTTP page and fallback icon routing for every product."""

import json
import shutil
import threading
import urllib.error
import urllib.request
from html.parser import HTMLParser
from http.server import ThreadingHTTPServer
from pathlib import Path

import pytest

from core.host import server as server_module
from core.host.branding import favicon_metadata, icon_metadata
from core.host.server import StudioHost, make_handler

APPS = ("studio", "cad", "animation", "ui", "map", "sketch", "vector", "io", "drive")


class Head(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        if tag == "link":
            self.links.append(dict(attrs))


@pytest.fixture
def branding_host(tmp_path, monkeypatch):
    icons = tmp_path / "core/assets/branding/apps"
    icons.mkdir(parents=True)
    source = Path(__file__).resolve().parents[2] / "assets/branding/apps"
    packages = {}
    for app in APPS:
        for extension in ("png", "ico"):
            shutil.copyfile(source / f"{app}.{extension}", icons / f"{app}.{extension}")
        # Leave obsolete artwork on disk: requests must never serve it.
        (icons / f"{app}.svg").write_text('<svg id="obsolete-logo"/>')
        bundle = tmp_path / app / "dist"
        bundle.mkdir(parents=True)
        title = "Aether CAD" if app == "cad" else f"Aether {app.title()}"
        (bundle / "index.html").write_text(
            f'<head><title>{title}</title><link rel="icon" href="/vite.svg">'
            '<link rel="shortcut icon" href="/old.ico">'
            '<link rel="apple-touch-icon" href="/old.png">'
            '<link rel="stylesheet" href="app.css"></head>'
        )
        if app != "studio":
            packages[app] = (title, app, bundle)
    monkeypatch.setattr(server_module, "REPO", tmp_path)
    host = StudioHost(tmp_path / "data", packages)
    host.store.create_user("owner", "browser-icon-test-password", "admin", False)
    server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(host))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    origin = f"http://127.0.0.1:{server.server_port}"
    with urllib.request.urlopen(urllib.request.Request(
        origin + "/api/login",
        data=json.dumps({"username": "owner", "password": "browser-icon-test-password"}).encode(),
        headers={"Origin": origin, "Content-Type": "application/json"},
    )) as response:
        cookie = response.headers["Set-Cookie"].split(";", 1)[0]

    def get(path, authenticated=False):
        return urllib.request.urlopen(urllib.request.Request(
            origin + path, headers={"Cookie": cookie} if authenticated else {},
        ))

    try:
        yield icons, get
    finally:
        server.shutdown()
        server.server_close()
        host.store.db.close()


@pytest.mark.parametrize("app", APPS)
def test_app_home_editor_and_icon_fallbacks_share_one_identity(branding_host, app):
    icons, get = branding_host
    tab_url, sizes, mime = favicon_metadata(icons, app)
    png_url, _ = icon_metadata(icons, app)
    prefix = "" if app == "studio" else f"/{app}"
    for path in (prefix + "/", prefix + "/index.html"):
        with get(path, authenticated=True) as response:
            head = Head()
            head.feed(response.read().decode())
        links = [link for link in head.links if link.get("rel") == "icon"]
        assert links == [{"rel": "icon", "type": mime, "sizes": sizes, "href": tab_url}]
        assert next(link for link in head.links if link.get("rel") == "apple-touch-icon")["href"] == png_url
        assert any(link.get("rel") == "stylesheet" for link in head.links)
        assert not any("old." in link.get("href", "") or "vite.svg" in link.get("href", "") for link in head.links)

    # Icon fetches happen without a login and must not return a login page.
    for path in (tab_url, f"/icons/{app}.ico", prefix + "/favicon.ico"):
        with get(path) as response:
            assert response.url.endswith(tab_url)
            assert response.headers["Content-Type"] == "image/x-icon"
            assert response.read() == (icons / f"{app}.ico").read_bytes()
    for path in (f"/icons/{app}.svg", prefix + "/favicon.svg", prefix + "/favicon.png", prefix + "/apple-touch-icon.png"):
        with get(path) as response:
            assert response.url.endswith(png_url)
            assert response.headers["Content-Type"] == "image/png"
            assert response.read() == (icons / f"{app}.png").read_bytes()


def test_unknown_or_traversing_icon_names_return_404(branding_host):
    _, get = branding_host
    for path in ("/icons/unknown.ico", "/icons/../server.py", "/icons/sketch/../../server.py"):
        with pytest.raises(urllib.error.HTTPError) as error:
            get(path)
        assert error.value.code == 404

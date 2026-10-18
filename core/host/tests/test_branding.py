import hashlib
import struct

from core.host.branding import favicon_metadata, icon_metadata, without_icon_links


def test_icon_urls_change_when_the_artwork_changes(tmp_path):
    icon = tmp_path / "map.png"
    data = b"\x89PNG\r\n\x1a\n" + b"\x00" * 8 + struct.pack(">II", 512, 512)
    icon.write_bytes(data)
    url, sizes = icon_metadata(tmp_path, "map")
    assert sizes == "512x512"
    assert url == "/icons/map.png?v=" + hashlib.sha256(data).hexdigest()[:12]
    icon.write_bytes(data + b"new artwork")
    assert icon_metadata(tmp_path, "map")[0] != url


def test_host_removes_competing_icons_but_preserves_stylesheets():
    page = b'''<head><link href="old.svg" rel="icon"><link rel='shortcut icon' href='old.ico'>
    <link rel="apple-touch-icon" href="apple.png"><link rel="mask-icon" href="mask.svg">
    <link rel="manifest" href="old.webmanifest"><link rel="stylesheet" href="app.css"></head>'''
    result = without_icon_links(page)
    assert b'old.svg' not in result and b'old.ico' not in result
    assert b'apple.png' not in result and b'mask.svg' not in result
    assert b'old.webmanifest' not in result
    assert b'<link rel="stylesheet" href="app.css">' in result


def test_tab_icon_filename_changes_with_the_artwork(tmp_path):
    icon = tmp_path / "cad.ico"
    icon.write_bytes(b"first ICO")
    first, sizes, mime = favicon_metadata(tmp_path, "cad")
    assert sizes == "16x16 32x32 48x48"
    assert mime == "image/x-icon"
    assert first == "/icons/cad-" + hashlib.sha256(icon.read_bytes()).hexdigest()[:12] + ".ico"
    icon.write_bytes(b"updated ICO")
    assert favicon_metadata(tmp_path, "cad")[0] != first

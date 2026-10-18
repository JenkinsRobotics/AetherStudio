"""Canonical icon URLs for browser metadata and legacy icon requests."""

import hashlib
import re
import struct


def icon_metadata(directory, app):
    target = directory / f"{app}.png"
    url = f"/icons/{app}.png"
    if not target.is_file():
        return url, "1024x1024"
    data = target.read_bytes()
    width, height = struct.unpack(">II", data[16:24])
    digest = hashlib.sha256(data).hexdigest()[:12]
    return f"{url}?v={digest}", f"{width}x{height}"


def favicon_metadata(directory, app):
    """Use a new filename, not just a query, when a tab icon changes."""
    target = directory / f"{app}.ico"
    if not target.is_file():
        url, sizes = icon_metadata(directory, app)
        return url, sizes, "image/png"
    digest = hashlib.sha256(target.read_bytes()).hexdigest()[:12]
    return f"/icons/{app}-{digest}.ico", "16x16 32x32 48x48", "image/x-icon"


def icon_route(directory, path, apps):
    """Resolve only registered identities, including stale browser fallbacks.

    Returns (file, redirect). A missing file lets the host return a normal 404.
    None means this is not an icon route.
    """
    identities = ("studio", *apps)
    aliases = {
        "favicon.ico": "ico", "favicon.png": "png", "favicon.svg": "png",
        "apple-touch-icon.png": "png", "apple-touch-icon-precomposed.png": "png",
    }
    parts = path.strip("/").split("/")
    if len(parts) == 1 and parts[0] in aliases:
        app, extension = "studio", aliases[parts[0]]
    elif len(parts) == 2 and parts[0] in apps and parts[1] in aliases:
        app, extension = parts[0], aliases[parts[1]]
    elif path.startswith("/icons/"):
        for app in identities:
            if path == f"/icons/{app}.png":
                return directory / f"{app}.png", None
            if path == f"/icons/{app}.svg":
                return directory / f"{app}.png", icon_metadata(directory, app)[0]
            if path == f"/icons/{app}.ico" or re.fullmatch(rf"/icons/{re.escape(app)}-[0-9a-f]{{12}}\.ico", path):
                canonical = favicon_metadata(directory, app)[0]
                extension = "ico" if canonical.endswith(".ico") else "png"
                return directory / f"{app}.{extension}", None if path == canonical else canonical
        return None, None
    else:
        return None
    canonical = favicon_metadata(directory, app)[0] if extension == "ico" else icon_metadata(directory, app)[0]
    extension = "ico" if canonical.endswith(".ico") else "png"
    return directory / f"{app}.{extension}", canonical


def without_icon_links(html):
    """A hosted page gets one authoritative icon family, not competing defaults."""
    def keep(match):
        relation = re.search(rb'''\brel\s*=\s*["']([^"']+)["']''', match[0], re.I)
        if relation and set(relation[1].lower().split()) & {
            b"icon", b"apple-touch-icon", b"apple-touch-icon-precomposed", b"mask-icon", b"manifest",
        }:
            return b""
        return match[0]
    return re.sub(rb"<link\b[^>]*>", keep, html, flags=re.I)

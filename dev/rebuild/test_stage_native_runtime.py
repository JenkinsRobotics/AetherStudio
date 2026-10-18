"""Operator runtime snapshots are independent, checked and never overwritten."""

import hashlib
import json
from pathlib import Path

import pytest
from native_installation import InstallationError
from stage_native_runtime import stage


def setup(tmp_path):
    source = tmp_path / "source"
    source.mkdir(mode=0o700)

    def file(name, data):
        path = source / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        path.chmod(0o600)
        return path

    def config(name, value):
        return file(name, json.dumps(value).encode())

    for folder in ("studio", "map", "icons", "branding"):
        file(f"{folder}/index.html", b"public build")
    file("session/account.js", b"export default 1;")
    file("session/account.css", b"body{}")
    front = config(
        "frontends.json",
        {
            "schema": 1,
            "studio": "studio",
            "icons": "icons",
            "branding": "branding",
            "session": "session",
            "apps": {"map": "map"},
        },
    )
    payload = b"installed product fixture"
    sha = hashlib.sha256(payload).hexdigest()
    product = config(
        "native-worker.json",
        {"schema": 1, "app": "map", "entry": "runner.mjs", "sha256": sha},
    )
    file("runner.mjs", payload)
    products = config(
        "products.json",
        {"schema": 1, "node": "/usr/bin/true", "manifests": [str(product)]},
    )
    archive = file("animation.pyz", payload)
    animation = config(
        "animation.json",
        {
            "schema": 1,
            "python": "/usr/bin/true",
            "archive": str(archive),
            "sha256": sha,
        },
    )
    file("app.zip", payload)
    downloads = config(
        "map-downloads.json",
        {
            "schema": 1,
            "app": "map",
            "files": {"app.zip": {"sha256": sha, "size": len(payload)}},
        },
    )
    adapters = config(
        "adapters.json",
        dict(
            zip(
                [
                    "AETHER_NATIVE_FRONTENDS",
                    "AETHER_NATIVE_PRODUCTS",
                    "AETHER_NATIVE_ANIMATION",
                    "AETHER_NATIVE_MAP_DOWNLOADS",
                ],
                map(str, [front, products, animation, downloads]),
                strict=True,
            )
        ),
    )
    return source, adapters


def test_snapshot_does_not_follow_later_build_changes_or_overwrite_a_generation(
    tmp_path,
):
    source, adapters = setup(tmp_path)
    destination = tmp_path / "generation"
    report = stage(adapters, destination)
    assert report["services_started"] is False
    (source / "studio/index.html").write_text("later build")
    assert (destination / "frontends/studio/index.html").read_bytes() == b"public build"
    manifest = json.loads((destination / "runtime-manifest.json").read_text())
    for relative, record in manifest["files"].items():
        assert (
            hashlib.sha256((destination / relative).read_bytes()).hexdigest()
            == record["sha256"]
        )
    with pytest.raises(InstallationError, match="absent destination"):
        stage(adapters, destination)
    assert Path(report["adapters"]).stat().st_mode & 0o077 == 0


@pytest.mark.parametrize("failure", ["symlink", "bad-hash"])
def test_untrusted_or_corrupt_input_never_publishes_a_ready_adapter_set(
    tmp_path, failure
):
    source, adapters = setup(tmp_path)
    if failure == "symlink":
        (source / "studio/link.js").symlink_to(source / "runner.mjs")
    else:
        (source / "runner.mjs").write_bytes(b"different executable")
    destination = tmp_path / "refused"
    with pytest.raises(InstallationError):
        stage(adapters, destination)
    assert not (destination / "adapters.json").exists()

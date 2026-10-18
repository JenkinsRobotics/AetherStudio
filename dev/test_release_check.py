"""Failure injection for the release verifier, without running a real build."""

import hashlib
import io
import json
import tarfile

import pytest

from dev.release_check import require_test_execution, validate_product


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value))


@pytest.fixture
def product(tmp_path):
    archive = tmp_path / "vendor/ui.tgz"
    archive.parent.mkdir()
    content = json.dumps({"name": "@aether/ui", "version": "1.0.0"}).encode()
    with tarfile.open(archive, "w:gz") as tar:
        info = tarfile.TarInfo("package/package.json")
        info.size = len(content)
        tar.addfile(info, io.BytesIO(content))
    package = {
        "name": "aether-example",
        "version": "1.0.0",
        "dependencies": {"@aether/ui": "file:vendor/ui.tgz"},
    }
    write(tmp_path / "package.json", package)
    write(tmp_path / "package-lock.json", {"packages": {"": package}})
    write(tmp_path / "node_modules/@aether/ui/package.json", json.loads(content))
    (tmp_path / "pyproject.toml").write_text(
        '[project]\nname="example-service"\nversion="1.0.0"\n'
    )
    write(
        tmp_path / "service/aether_example_service/compatibility.json",
        {
            "schema": 1,
            "product": "example",
            "platform_api": 1,
            "service": {"distribution": "example-service", "version": "1.0.0"},
            "frontend": {"name": "aether-example", "version": "1.0.0"},
            "shared_packages": {
                "@aether/ui": {
                    "archive": "vendor/ui.tgz",
                    "sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
                }
            },
        },
    )
    return tmp_path


def test_exact_archive_and_installed_version_are_verified(product):
    result = validate_product(product, "example")
    assert "vendor/ui.tgz" in result["inputs"]
    (product / "vendor/ui.tgz").write_bytes(b"changed archive, same filename")
    with pytest.raises(ValueError, match="checksum"):
        validate_product(product, "example")


def test_stale_install_rejected(product):
    write(
        product / "node_modules/@aether/ui/package.json",
        {"name": "@aether/ui", "version": "0.9.0"},
    )
    with pytest.raises(ValueError, match="installed package"):
        validate_product(product, "example")


def test_stale_lock_rejected(product):
    write(product / "package-lock.json", {"packages": {"": {}}})
    with pytest.raises(ValueError, match="stale package lock"):
        validate_product(product, "example")


def test_service_version_drift_rejected(product):
    (product / "pyproject.toml").write_text(
        '[project]\nname="example-service"\nversion="2.0.0"\n'
    )
    with pytest.raises(ValueError, match="service version"):
        validate_product(product, "example")


def test_missing_manifest_is_not_optional_for_release(product):
    (product / "service/aether_example_service/compatibility.json").unlink()
    with pytest.raises(FileNotFoundError):
        validate_product(product, "example")


@pytest.mark.parametrize(
    "xml", ["<testsuites/>", "<testsuite><testcase><skipped/></testcase></testsuite>"]
)
def test_native_skips_and_empty_acceptance_cannot_certify_release(tmp_path, xml):
    report = tmp_path / "native.xml"
    report.write_text(xml)
    with pytest.raises(ValueError, match="skipped tests or no tests"):
        require_test_execution(report)


def test_executed_native_acceptance(tmp_path):
    report = tmp_path / "native.xml"
    report.write_text(
        '<testsuites><testsuite><testcase name="actual rebuild"/></testsuite></testsuites>'
    )
    require_test_execution(report)


def test_failed_preflight_replaces_old_success(tmp_path, monkeypatch):
    import dev.release_check as release

    monkeypatch.setattr(release, "ROOT", tmp_path)
    monkeypatch.setattr(
        release, "source_state", lambda path: {"path": str(path), "commit": "fixture"}
    )
    report = tmp_path / ".verification/release/results.json"
    write(report, {"status": "passed", "artifacts": {"map": "old"}})
    assert release.run_release({"map": tmp_path, "cad": tmp_path}) == 1
    current = json.loads(report.read_text())
    assert current["status"] == "failed"
    assert "artifacts" not in current
    assert "compatibility.json" in current["error"]


def test_release_requires_native_ui_and_engine_workflows(tmp_path, monkeypatch):
    import dev.release_check as release

    monkeypatch.setattr(release, "ROOT", tmp_path)
    folders = ["core/sketch", "core/session", "core/ui", "studio", "map", "cad"]
    for folder in folders:
        write(tmp_path / folder / "package.json", {"scripts": {"test": "vitest run"}})
    jobs = list(
        release.release_jobs({"map": tmp_path / "map", "cad": tmp_path / "cad"}, "test")
    )
    required = {name for name, _, _, native in jobs if native}
    assert required == {"cad-test", "cad-native", "cad-installed-service"}
    assert "--require-freecad" in next(
        command for name, _, command, _ in jobs if name == "cad-native"
    )


@pytest.mark.parametrize("section", ["dependencies", "optionalDependencies", "peerDependencies"])
def test_packed_development_dependencies_cannot_certify_release(product, section):
    archive = product / "vendor/ui.tgz"
    content = json.dumps({"name": "@aether/ui", "version": "1.0.0", section: {"@aether/assets": "file:vendor/missing.tgz"}}).encode()
    with tarfile.open(archive, "w:gz") as tar:
        info = tarfile.TarInfo("package/package.json")
        info.size = len(content)
        tar.addfile(info, io.BytesIO(content))
    manifest = product / "service/aether_example_service/compatibility.json"
    data = json.loads(manifest.read_text())
    data["shared_packages"]["@aether/ui"]["sha256"] = hashlib.sha256(archive.read_bytes()).hexdigest()
    write(manifest, data)
    with pytest.raises(ValueError, match="development-only dependency"):
        validate_product(product, "example")

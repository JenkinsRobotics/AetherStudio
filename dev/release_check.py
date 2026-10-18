"""Map/CAD framework acceptance. Local checks only; never deploys or edits user data."""

import hashlib
import json
import os
import subprocess
import sys
import tarfile
import time
import tomllib
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from core.host.compatibility import validate_contract


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def validate_product(path, app):
    manifest = path / f"service/aether_{app}_service/compatibility.json"
    value = validate_contract(json.loads(manifest.read_text()), app)
    package = json.loads((path / "package.json").read_text())
    lock = json.loads((path / "package-lock.json").read_text())["packages"][""]
    service = tomllib.loads((path / "pyproject.toml").read_text())["project"]
    if value.get("service") != {
        "distribution": service["name"],
        "version": service["version"],
    }:
        raise ValueError(
            f"{app}: service version disagrees with compatibility manifest"
        )
    if value.get("frontend") != {
        "name": package["name"],
        "version": package["version"],
    }:
        raise ValueError(
            f"{app}: frontend version disagrees with compatibility manifest"
        )
    fingerprints = {str(manifest.relative_to(path)): digest(manifest)}
    shared = value.get("shared_packages", {})
    expected = {
        name
        for name in package.get("dependencies", {})
        if name.startswith("@aether/") and name != "@aether/core"
    }
    if not isinstance(shared, dict) or set(shared) != expected:
        raise ValueError(
            f"{app}: shared package declarations do not match dependencies"
        )
    for section in ("dependencies", "devDependencies"):
        if package.get(section, {}) != lock.get(section, {}):
            raise ValueError(f"{app}: stale package lock ({section})")
        for name, spec in package.get(section, {}).items():
            if spec.startswith("file:"):
                target = (path / spec[5:]).resolve()
                if not target.is_relative_to(path.resolve()) or not target.exists():
                    raise ValueError(f"{app}: dependency {name} escapes or is missing")
    for name, pin in shared.items():
        spec = package["dependencies"][name]
        if spec != "file:" + pin["archive"]:
            raise ValueError(f"{app}: archive declaration mismatch for {name}")
        archive = path / pin["archive"]
        actual = digest(archive)
        if actual != pin["sha256"]:
            raise ValueError(f"{app}: archive checksum mismatch for {name}")
        with tarfile.open(archive, "r:gz") as bundle:
            entry = bundle.getmember("package/package.json")
            if not entry.isfile() or entry.size > 1_000_000:
                raise ValueError(f"{app}: invalid package metadata for {name}")
            metadata = json.load(bundle.extractfile(entry))
        for section in ("dependencies", "optionalDependencies", "peerDependencies"):
            for dependency, spec in metadata.get(section, {}).items():
                if not isinstance(spec, str) or spec.startswith(("file:", "link:", "workspace:")):
                    raise ValueError(
                        f"{app}: {name} archive contains a development-only dependency: {dependency}"
                    )
        installed = json.loads(
            (path / "node_modules" / name / "package.json").read_text()
        )
        if (
            metadata["name"] != name
            or installed["name"] != name
            or metadata["version"] != installed["version"]
        ):
            raise ValueError(
                f"{app}: installed package version mismatch for {name}; reinstall dependencies"
            )
        fingerprints[pin["archive"]] = actual
    for file in ("package.json", "package-lock.json", "pyproject.toml"):
        fingerprints[file] = digest(path / file)
    return {"contract": value, "inputs": fingerprints}


def require_test_execution(report):
    """Native acceptance must execute, not silently certify pytest's skip result."""
    suites = ET.parse(report).getroot()
    cases = list(suites.iter("testcase"))
    if not cases or any(case.find("skipped") is not None for case in cases):
        raise ValueError(
            "Required native acceptance contains skipped tests or no tests"
        )


def release_jobs(paths, phase):
    npm = "npm.cmd" if sys.platform == "win32" else "npm"
    python = str(
        ROOT
        / ".venv"
        / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python")
    )
    packages = [
        ("sketch", ROOT / "core/sketch"),
        ("session", ROOT / "core/session"),
        ("ui", ROOT / "core/ui"),
        ("studio", ROOT / "studio"),
        ("map", paths["map"]),
        ("cad", paths["cad"]),
    ]
    for name, folder in packages:
        scripts = json.loads((folder / "package.json").read_text())["scripts"]
        if phase == "build":
            for command in ("build:package", "build:library", "build"):
                if command in scripts:
                    yield (
                        name + "-" + command.replace(":", "-"),
                        folder,
                        [npm, "run", command],
                        False,
                    )
        else:
            yield (
                name + "-test",
                folder,
                [npm, "test", "--", "--maxWorkers=2", "--minWorkers=1"],
                name == "cad",
            )
            if "typecheck" in scripts:
                yield name + "-types", folder, [npm, "run", "typecheck"], False
    if phase == "test":
        yield (
            "architecture",
            ROOT,
            [
                "node",
                "--test",
                "dev/package-boundaries.test.mjs",
                "dev/project-boundaries.test.mjs",
            ],
            False,
        )
        yield (
            "framework-gates",
            ROOT,
            [python, "-m", "pytest", "dev/test_release_check.py", "-q"],
            False,
        )
        yield "platform", ROOT, [python, "-m", "pytest", "core/host/tests", "-q"], False
        yield (
            "cad-browser-engine",
            paths["cad"] / "aether-engine",
            [npm, "test", "--", "--maxWorkers=2", "--minWorkers=1"],
            False,
        )
        yield (
            "cad-native",
            paths["cad"],
            [python, "-m", "pytest", "freecad-engine/tests", "--require-freecad", "-q"],
            True,
        )
        yield (
            "cad-installed-service",
            paths["cad"],
            [python, "-m", "pytest", "service/tests", "-q"],
            True,
        )
        yield (
            "map-installed-service",
            paths["map"],
            [python, "-m", "pytest", "service/tests", "-q"],
            False,
        )
        yield (
            "map-player",
            paths["map"],
            [python, "-m", "pytest", "player/tests", "-q"],
            False,
        )


def source_state(path):
    def git(*args):
        return subprocess.check_output(["git", *args], cwd=path, text=True).strip()

    changed = git("diff", "--binary", "HEAD")
    untracked = {
        name: digest(path / name)
        for name in git("ls-files", "--others", "--exclude-standard").splitlines()
        if (path / name).is_file()
    }
    return {
        "path": str(path),
        "commit": git("rev-parse", "HEAD"),
        "workingTree": git("status", "--porcelain"),
        "changesSha256": hashlib.sha256(
            (changed + json.dumps(untracked, sort_keys=True)).encode()
        ).hexdigest(),
    }


def run_release(paths, workers=2):
    directory = ROOT / ".verification/release"
    directory.mkdir(parents=True, exist_ok=True)
    report = {
        "startedAt": datetime.now(UTC).isoformat(),
        "status": "running",
        "scope": ["map", "cad"],
        "jobs": {},
    }
    target = directory / "results.json"

    def save():
        temporary = target.with_suffix(".tmp")
        temporary.write_text(json.dumps(report, indent=2) + "\n")
        temporary.replace(target)

    save()  # A failed/aborted run must never leave an older PASS as the latest evidence.
    try:
        report["sources"] = {
            name: source_state(path)
            for name, path in {
                "platform": ROOT,
                **{key: paths[key] for key in ("map", "cad")},
            }.items()
        }
        report["products"] = {
            app: validate_product(paths[app], app) for app in ("map", "cad")
        }
        subprocess.run(
            ["node", str(ROOT / "dev/check-project-boundaries.mjs"), "map", "cad"],
            cwd=ROOT,
            check=True,
        )
        save()

        def run(job):
            name, folder, command, native = job
            logpath = directory / (name + ".log")
            junit = directory / (name + ".xml")
            env = {
                **os.environ,
                "AETHER_TEST_FREECAD": "1",
                "AETHER_FREECAD_INTEGRATION": "1",
                "AETHER_PYTHON": str(
                    ROOT
                    / ".venv"
                    / (
                        "Scripts/python.exe"
                        if sys.platform == "win32"
                        else "bin/python"
                    )
                ),
            }
            if native:
                junit.unlink(missing_ok=True)
                command = (
                    [*command, "--junitxml=" + str(junit)]
                    if "pytest" in command
                    else [
                        *command,
                        "--reporter=default",
                        "--reporter=junit",
                        "--outputFile=" + str(junit),
                    ]
                )
            start = time.monotonic()
            error = None
            with logpath.open("w") as log:
                try:
                    code = subprocess.run(
                        command,
                        cwd=folder,
                        env=env,
                        stdout=log,
                        stderr=subprocess.STDOUT,
                        timeout=1200,
                        check=False,
                    ).returncode
                    if code == 0 and native:
                        require_test_execution(junit)
                except (
                    OSError,
                    ValueError,
                    ET.ParseError,
                    subprocess.TimeoutExpired,
                ) as exc:
                    code, error = 1, str(exc)
                    log.write("\nRelease verification failed: " + error + "\n")
            print(f"{name}: {'PASS' if code == 0 else 'FAIL'}", flush=True)
            return name, {
                "exitCode": code,
                "seconds": round(time.monotonic() - start, 2),
                "log": str(logpath),
                "command": command,
                "error": error,
            }

        # Complete generated worker/frontend builds before installed-package tests.
        for phase in ("build", "test"):
            with ThreadPoolExecutor(max_workers=workers) as executor:
                for name, result in executor.map(run, release_jobs(paths, phase)):
                    report["jobs"][name] = result
                    save()
            if any(job["exitCode"] for job in report["jobs"].values()):
                raise ValueError(f"{phase} failed; inspect the job logs")
        report["artifacts"] = {}
        for app in ("map", "cad"):
            folder = paths[app]
            if not (folder / "dist/index.html").is_file():
                raise ValueError(f"{app}: built frontend is missing")
            files = sorted(
                path for path in (folder / "dist").rglob("*") if path.is_file()
            )
            if app == "map":
                files.append(folder / "service/aether_map_service/runtime/runner.mjs")
            # One digest covers all output bytes and their paths, including lazy chunks.
            hashes = {str(path.relative_to(folder)): digest(path) for path in files}
            report["artifacts"][app] = {
                "files": len(hashes),
                "sha256": hashlib.sha256(
                    json.dumps(hashes, sort_keys=True).encode()
                ).hexdigest(),
            }
        current = {
            name: source_state(Path(value["path"]))
            for name, value in report["sources"].items()
        }
        if current != report["sources"]:
            raise ValueError(
                "Source state changed during verification; rerun on the final checkout"
            )
        report["status"] = "passed"
    except (
        OSError,
        ValueError,
        TypeError,
        tarfile.TarError,
        subprocess.SubprocessError,
        KeyError,
    ) as exc:
        report["status"], report["error"] = "failed", str(exc)
        print(f"Release check failed: {exc}", flush=True)
    finally:
        report["finishedAt"] = datetime.now(UTC).isoformat()
        save()
    print(f"Framework evidence: {target}", flush=True)
    return int(report["status"] != "passed")

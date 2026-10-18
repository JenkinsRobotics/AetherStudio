"""Local multi-repository development checks. No live deployment changes."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import argparse, json, os, subprocess, sys

ROOT = Path(__file__).resolve().parent

def projects():
    manifest = Path(os.environ.get("AETHER_PROJECTS_FILE", ROOT / "projects.json")).resolve()
    data = json.loads(manifest.read_text())
    if data.get("schema") != 1:
        raise ValueError("Unsupported project manifest")
    return {name: (manifest.parent / path).resolve() for name, path in data["projects"].items()}

def packages():
    result = [("sketch-core", ROOT / "core/sketch"), ("session", ROOT / "core/session"),
              ("ui", ROOT / "core/ui"), ("studio", ROOT / "studio")]
    return result + [(name, path / "web" if name == "animation" else path) for name, path in projects().items()]

def doctor():
    for name, path in packages():
        for file in ("package.json", "package-lock.json"):
            if not (path / file).is_file():
                raise ValueError(f"Missing {name} {file}: {path}")
        package = json.loads((path / "package.json").read_text())
        lock = json.loads((path / "package-lock.json").read_text())["packages"][""]
        for section in ("dependencies", "devDependencies"):
            if package.get(section, {}) != lock.get(section, {}):
                raise ValueError(f"Stale {name} lockfile: {section}")
            for dependency, value in package.get(section, {}).items():
                if value.startswith("file:"):
                    target = (path / value[5:]).resolve()
                    if not target.is_relative_to(path) or not target.exists():
                        raise ValueError(f"{name}: invalid local dependency {dependency} = {value}")
        print(f"{name}: {path}")
    subprocess.run(["node", str(ROOT / "dev/check-project-boundaries.mjs")], check=True)

def jobs(mode):
    npm = "npm.cmd" if sys.platform == "win32" else "npm"
    for name, folder in packages():
        scripts = json.loads((folder / "package.json").read_text()).get("scripts", {})
        commands = ["test", "typecheck"] if mode == "test" else ["build:package", "build:library", "build"]
        for command in commands:
            if command in scripts:
                yield name + "-" + command.replace(":", "-"), folder, [npm, "run", command]
    if mode == "test":
        python = ROOT / ".venv" / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python")
        paths = projects()
        yield "platform-python", ROOT, [str(python), "-m", "pytest", "core/host/tests", "-q"]
        yield "animation-python", paths["animation"], [str(python), "-m", "pytest", "aether_animation/tests", "-q"]
        yield "cad-engine", paths["cad"] / "aether-engine", [npm, "run", "test", "--", "--maxWorkers=2", "--minWorkers=1"]
        yield "freecad", paths["cad"], [str(python), "-m", "pytest", "freecad-engine/tests", "-q"]
        yield "cad-service", paths["cad"], [str(python), "-m", "pytest", "service/tests", "-q"]
        yield "map-service", paths["map"], [str(python), "-m", "pytest", "service/tests", "-q"]
        yield "map-player", paths["map"], [str(python), "-m", "pytest", "player/tests", "-q"]

def checks(mode, workers):
    directory = ROOT / ".verification" / mode
    directory.mkdir(parents=True, exist_ok=True)
    def run(job):
        name, folder, command = job
        with (directory / (name + ".log")).open("w") as log:
            result = subprocess.run(command, cwd=folder, stdout=log, stderr=subprocess.STDOUT)
        print(f"{name}: {'PASS' if result.returncode == 0 else 'FAIL'}", flush=True)
        return name, {"exitCode": result.returncode, "log": str(directory / (name + ".log"))}
    with ThreadPoolExecutor(max_workers=workers) as executor:
        result = dict(executor.map(run, jobs(mode)))
    (directory / "results.json").write_text(json.dumps(result, indent=2) + "\n")
    return any(value["exitCode"] != 0 for value in result.values())

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["doctor", "setup", "build", "test", "check", "release"])
    parser.add_argument("--workers", type=int, choices=range(1, 5), default=2)
    args = parser.parse_args()
    if args.action == "release":
        from dev.release_check import run_release
        return run_release(projects(), args.workers)
    doctor()
    if args.action == "setup":
        return subprocess.call([sys.executable, str(ROOT / "bootstrap.py")])
    failed = False
    if args.action in ("test", "check"):
        failed |= checks("test", args.workers)
    if args.action in ("build", "check"):
        failed |= checks("build", args.workers)
    return int(failed)

if __name__ == "__main__":
    raise SystemExit(main())

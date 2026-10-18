"""Stage native macOS services or restore a native backup into a NEW stopped target.

Never loads launch agents, stops a live service, overwrites a destination, or
points PostgreSQL at an existing database. Backups are trusted operator artifacts;
the SQL dump is executed only in the newly initialized private cluster.
"""

import argparse
import hashlib
import json
import os
import plistlib
import re
import shutil
import stat
import subprocess
import tempfile
from pathlib import Path


class InstallationError(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise InstallationError(message)


def private(path, directory=False):
    path = Path(path).absolute()
    meta = path.lstat()
    require(not stat.S_ISLNK(meta.st_mode), "Symlinks are not installation inputs.")
    require(
        (stat.S_ISDIR if directory else stat.S_ISREG)(meta.st_mode),
        "Invalid installation input type.",
    )
    require(
        meta.st_uid == os.getuid() and meta.st_mode & 0o077 == 0,
        "Use owner-only installation files/directories.",
    )
    return path


def executable(path):
    path = Path(path).resolve(strict=True)
    require(path.is_file() and os.access(path, os.X_OK), "Missing operator executable.")
    return path


def write(path, data):
    with Path(path).open("xb") as stream:
        os.fchmod(stream.fileno(), 0o600)
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())


def new_destination(path):
    path = Path(path).absolute()
    private(path.parent, directory=True)
    require(
        not path.exists() and not path.is_symlink(), "Choose a new, absent destination."
    )
    path.mkdir(mode=0o700)
    return path


def safe_environment():
    # No inherited alternate native/PG authority or library injection.
    return {
        key: os.environ[key]
        for key in ("HOME", "TMPDIR", "PATH", "LANG", "LC_ALL")
        if key in os.environ
    }


def run(args, *, env, stdin=None):
    result = subprocess.run(
        [str(a) for a in args],
        check=False,
        stdin=stdin,
        env=env,
        capture_output=True,
        timeout=300,
    )
    require(
        result.returncode == 0,
        "Native installation command failed; retain the private destination for diagnosis.",
    )
    return result.stdout


def plan(host_binary, config, postgres_bin, database, socket_dir, destination, label):
    require(
        re.fullmatch(r"com\.aether\.studio\.[a-z0-9-]{1,50}", label),
        "Use a distinct com.aether.studio.<instance> label.",
    )
    host, postgres = (
        executable(host_binary),
        executable(Path(postgres_bin) / "postgres"),
    )
    config = private(config)
    private(config.parent, directory=True)
    database, socket_dir = private(database, True), private(socket_dir, True)
    require(
        (database / "PG_VERSION").is_file(),
        "Prepare or restore the database before staging services.",
    )
    require(
        len(os.fsencode(socket_dir)) < 80,
        "Use a short private PostgreSQL socket directory.",
    )
    require(config.stat().st_size <= 65536, "Installation configuration exceeds limit.")
    config_bytes = config.read_bytes()
    settings = json.loads(config_bytes)
    env = settings["environment"]
    require(
        settings.get("schema") == 1 and isinstance(env, dict),
        "Unsupported installation configuration.",
    )
    # Parse the libpq keyword/value form used by this local installation tool.
    # The runtime separately validates the DSN through tokio-postgres.
    import shlex

    tokens = shlex.split(env["AETHER_NATIVE_PG"])
    values = dict(item.split("=", 1) for item in tokens)
    require(
        len(values) == len(tokens) and values.get("host") == str(socket_dir),
        "Configuration and private database socket must match.",
    )
    port = int(values.get("port", "5432"))
    require(
        1 <= port <= 65535 and values.get("dbname") and values.get("user"),
        "Use an explicit local database and user.",
    )
    root = new_destination(destination)
    (root / "bin").mkdir(mode=0o700)
    copied = root / "bin/aether-native-host"
    with host.open("rb") as source, copied.open("xb") as target:
        shutil.copyfileobj(source, target)
        target.flush()
        os.fsync(target.fileno())
    copied.chmod(0o700)
    # A frozen config is part of this generation; future changes stage a new one.
    write(root / "installation.json", config_bytes)
    common = {
        "RunAtLoad": True,
        "KeepAlive": True,
        "ThrottleInterval": 10,
        # These HTTP/SQL services directly serve interactive editor work. They
        # cannot receive an Adaptive XPC activity boost. Background scheduling
        # also throttles child CAD workers and can turn a normal rebuild into a
        # timeout even though the identical foreground executable succeeds.
        # Application-level queues, deadlines and process limits still apply.
        "ProcessType": "Interactive",
        "Umask": 0o077,
        "ExitTimeOut": 45,
        "WorkingDirectory": str(root),
        # launchd has no interactive shell locale. PostgreSQL on macOS can
        # initialize CoreFoundation threads and refuse startup without this.
        "EnvironmentVariables": {"LANG": "C", "LC_ALL": "C"},
    }
    commands = {
        "database": [
            str(postgres),
            "-D",
            str(database),
            "-k",
            str(socket_dir),
            "-p",
            str(port),
            "-h",
            "",
            "-c",
            "unix_socket_permissions=0700",
        ],
        "server": [str(copied), "serve", "--config", str(root / "installation.json")],
    }
    for kind, command in commands.items():
        log = root / f"{kind}.log"
        write(log, b"")
        service = {
            **common,
            "Label": f"{label}.{kind}",
            "ProgramArguments": command,
            "StandardOutPath": str(log),
            "StandardErrorPath": str(log),
        }
        write(root / f"{kind}.plist", plistlib.dumps(service))
    report = {
        "schema": 1,
        "staged": True,
        "services_started": False,
        "binary_sha256": hashlib.sha256(copied.read_bytes()).hexdigest(),
        "label": label,
        "shutdown_order": ["server", "database"],
    }
    write(root / "plan.json", json.dumps(report, indent=2).encode())
    return report


def copy_backup(backup, root):
    backup = private(backup, True)
    manifest_path = backup / "manifest.json"
    meta = manifest_path.lstat()
    require(
        stat.S_ISREG(meta.st_mode)
        and meta.st_uid == os.getuid()
        and meta.st_size <= 128 * 1024 * 1024,
        "Invalid backup manifest.",
    )
    manifest = json.loads(manifest_path.read_bytes())
    files = manifest["files"]
    require(
        manifest["schema"] == 1
        and isinstance(files, dict)
        and 1 <= len(files) <= 1_000_000
        and "native.sql" in files
        and isinstance(manifest.get("tenant"), str),
        "Unsupported backup manifest.",
    )
    require(
        manifest.get("sessions_restored") is False
        and manifest.get("delegated_credentials_restored") is False,
        "Backup has an unsupported credential policy.",
    )
    total = 0
    source_root = os.open(backup, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        for name, item in files.items():
            parts = name.split("/")
            require(
                all(
                    p not in ("", ".", "..") and "\\" not in p and "\x00" not in p
                    for p in parts
                )
                and (
                    name == "native.sql"
                    or parts[0] in ("objects", "attachments", "workspaces")
                ),
                "Unsafe backup path.",
            )
            require(
                type(item["size"]) is int
                and item["size"] >= 0
                and re.fullmatch("[0-9a-f]{64}", item["sha256"]),
                "Invalid backup digest/size.",
            )
            total += item["size"]
            require(total <= 256 * 1024**3, "Backup exceeds supported size.")
            directory = os.dup(source_root)
            try:
                for component in parts[:-1]:
                    nested = os.open(
                        component,
                        os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
                        dir_fd=directory,
                    )
                    os.close(directory)
                    directory = nested
                fd = os.open(
                    parts[-1],
                    os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK,
                    dir_fd=directory,
                )
            finally:
                os.close(directory)
            with os.fdopen(fd, "rb") as source:
                require(
                    stat.S_ISREG(os.fstat(source.fileno()).st_mode),
                    "Backup entry is not a regular file.",
                )
                target_path = root / name
                target_path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
                h = hashlib.sha256()
                count = 0
                with target_path.open("xb") as target:
                    os.fchmod(target.fileno(), 0o600)
                    while chunk := source.read(1024 * 1024):
                        count += len(chunk)
                        require(
                            count <= item["size"], "Backup entry exceeds recorded size."
                        )
                        h.update(chunk)
                        target.write(chunk)
                    target.flush()
                    os.fsync(target.fileno())
                require(
                    count == item["size"] and h.hexdigest() == item["sha256"],
                    "Backup integrity mismatch.",
                )
    finally:
        os.close(source_root)
    return manifest


def restore(backup, destination, host_binary, postgres_bin):
    host = executable(host_binary)
    binaries = Path(postgres_bin).resolve(strict=True)
    for name in ("initdb", "pg_ctl", "psql"):
        executable(binaries / name)
    root = new_destination(destination)
    manifest = copy_backup(backup, root)
    database = root / "postgres"
    (root / "objects").mkdir(mode=0o700, exist_ok=True)
    env = safe_environment()
    init = [
        binaries / "initdb",
        "-D",
        database,
        "-U",
        "aether_recovery",
        "--auth=trust",
        "--no-locale",
        "--encoding=UTF8",
    ]
    share = binaries.parent / "share/postgresql"
    if (share / "postgres.bki").is_file():
        init += ["-L", share]
    run(init, env=env)
    # Stopped targets cannot accidentally expose a default public trust socket.
    with (database / "postgresql.conf").open("a") as stream:
        stream.write("\nlisten_addresses = ''\nunix_socket_directories = ''\n")
        stream.flush()
        os.fsync(stream.fileno())
    with tempfile.TemporaryDirectory(prefix="aether-recover-", dir="/tmp") as socket:
        attempted = False
        try:
            attempted = True
            run(
                [
                    binaries / "pg_ctl",
                    "-D",
                    database,
                    "-l",
                    root / "postgres.log",
                    "-o",
                    f"-k {socket} -h ''",
                    "-w",
                    "start",
                ],
                env=env,
            )
            env.update(
                PGHOST=socket,
                PGPORT="5432",
                PGUSER="aether_recovery",
                PGDATABASE="postgres",
            )
            with (root / "native.sql").open("rb") as dump:
                run(
                    [binaries / "psql", "-X", "-v", "ON_ERROR_STOP=1"],
                    env=env,
                    stdin=dump,
                )
            native = {
                **env,
                "AETHER_NATIVE_PG": f"host={socket} user=aether_recovery dbname=postgres",
                "AETHER_NATIVE_TENANT": manifest["tenant"],
                "AETHER_NATIVE_OBJECTS": str(root / "objects"),
            }
            run([host, "migrate"], env=native)
            integrity = json.loads(run([host, "verify-store"], env=native))
            query = "SELECT (SELECT count(*) FROM aether_identity.users), (SELECT count(*) FROM aether_identity.sessions), (SELECT count(*) FROM aether_identity.recovery), (SELECT count(*) FROM aether_identity.agent_connections)"
            counts = (
                run([binaries / "psql", "-X", "-At", "-c", query], env=env)
                .decode()
                .strip()
                .split("|")
            )
            require(
                counts[1:] == ["0", "0", "0"],
                "Backup unexpectedly restored live credentials.",
            )
            report = {
                "schema": 1,
                "restored": True,
                "snapshot_files": len(manifest["files"]),
                "users": int(counts[0]),
                "integrity": integrity,
                "live_credentials_restored": False,
                "database_stopped": True,
                "source_unchanged": True,
                "http_service_started": False,
            }
        finally:
            if attempted and (database / "postmaster.pid").exists():
                run(
                    [binaries / "pg_ctl", "-D", database, "-m", "fast", "-w", "stop"],
                    env=env,
                )
    # Report is published only after clean shutdown and flushed copied directories.
    for directory, _, _ in os.walk(root, topdown=False):
        fd = os.open(directory, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)
    write(root / "recovery-report.json", json.dumps(report, indent=2).encode())
    for directory in (root, root.parent):
        fd = os.open(directory, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    for kind in ("plan", "restore"):
        command = commands.add_parser(kind)
        for name in ("host-binary", "postgres-bin", "destination"):
            command.add_argument("--" + name, type=Path, required=True)
        if kind == "restore":
            command.add_argument("--backup", type=Path, required=True)
        else:
            for name in ("config", "database", "socket-dir"):
                command.add_argument("--" + name, type=Path, required=True)
            command.add_argument("--label", required=True)
    args = vars(parser.parse_args())
    kind = args.pop("command")
    os.umask(0o077)
    try:
        result = (plan if kind == "plan" else restore)(**args)
        print(json.dumps(result, indent=2))
    except (
        InstallationError,
        OSError,
        ValueError,
        KeyError,
        TypeError,
        subprocess.SubprocessError,
    ):
        raise SystemExit(
            "Native installation preparation failed. No live service was changed; retain the private destination for diagnosis."
        ) from None


if __name__ == "__main__":
    main()

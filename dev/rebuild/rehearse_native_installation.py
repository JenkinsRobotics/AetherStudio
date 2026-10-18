"""Qualify macOS launchd using an already restored disposable native database.

Starts only newly named rehearsal jobs on an unused loopback port and private
socket. Stops both jobs on exit. Never loads production labels or listeners.
"""

import argparse
import json
import os
import re
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
import uuid
from pathlib import Path

from native_installation import (
    InstallationError,
    plan,
    private,
    require,
    run,
    safe_environment,
    write,
)


def launch(*args):
    return subprocess.run(
        ["/bin/launchctl", *map(str, args)],
        check=False,
        capture_output=True,
        timeout=55,
    )


def rehearse(restored, host_binary, postgres_bin):
    require(sys.platform == "darwin", "This rehearsal requires macOS launchd.")
    root = private(restored, directory=True)
    report = json.loads((root / "recovery-report.json").read_text())
    require(
        report.get("database_stopped") is True
        and not (root / "postgres/postmaster.pid").exists(),
        "Use a new stopped restored target.",
    )
    domain = f"gui/{os.getuid()}"
    require(
        launch("print", domain).returncode == 0, "A user launchd domain is required."
    )
    label = "com.aether.studio.rehearsal-" + uuid.uuid4().hex
    jobs = [f"{domain}/{label}.{kind}" for kind in ("server", "database")]
    socket_root = Path(tempfile.mkdtemp(prefix="aether-service-", dir="/tmp"))
    with socket.socket() as reservation:
        reservation.bind(("127.0.0.1", 0))
        port = reservation.getsockname()[1]
    require(port not in (8780, 8781), "Reserved production port refused.")
    origin = f"http://127.0.0.1:{port}"
    # Tenant comes from the verified native backup retained alongside the target.
    # Recover it from SQL during a short private pg_ctl start, before launchd owns it.
    env = safe_environment()
    bins = Path(postgres_bin).resolve()
    try:
        run(
            [
                bins / "pg_ctl",
                "-D",
                root / "postgres",
                "-l",
                root / "postgres.log",
                "-o",
                f"-k {socket_root} -h ''",
                "-w",
                "start",
            ],
            env=env,
        )
        tenant = (
            run(
                [
                    bins / "psql",
                    "-X",
                    "-At",
                    "-c",
                    "SELECT DISTINCT tenant FROM aether_identity.users",
                ],
                env={
                    **env,
                    "PGHOST": str(socket_root),
                    "PGUSER": "aether_recovery",
                    "PGDATABASE": "postgres",
                    "PGPORT": "5432",
                },
            )
            .decode()
            .strip()
        )
        require(tenant and "\n" not in tenant, "Rehearsal requires exactly one tenant.")
    finally:
        if (root / "postgres/postmaster.pid").exists():
            run(
                [bins / "pg_ctl", "-D", root / "postgres", "-m", "fast", "-w", "stop"],
                env=env,
            )
    attempt = root / ("supervision-" + uuid.uuid4().hex)
    attempt.mkdir(mode=0o700)
    config = attempt / "rehearsal.json"
    write(
        config,
        json.dumps(
            {
                "schema": 1,
                "environment": {
                    "AETHER_NATIVE_PG": f"host={socket_root} user=aether_recovery dbname=postgres",
                    "AETHER_NATIVE_TENANT": tenant,
                    "AETHER_NATIVE_OBJECTS": str(root / "objects"),
                    "AETHER_NATIVE_LISTEN": f"127.0.0.1:{port}",
                    "AETHER_NATIVE_INSTANCE": "rehearsal-" + uuid.uuid4().hex,
                },
            }
        ).encode(),
    )
    generation = attempt / "services"
    plan(host_binary, config, bins, root / "postgres", socket_root, generation, label)
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

    def wait_ready():
        until = time.monotonic() + 50
        while time.monotonic() < until:
            try:
                with opener.open(origin + "/api/status", timeout=2) as response:
                    value = json.load(response)
                    if value.get("ready") is True:
                        return
            except (OSError, ValueError):
                pass
            time.sleep(0.2)
        raise InstallationError("Disposable native service did not become ready.")

    def pid(job):
        output = launch("print", job)
        match = re.search(rb"\bpid = (\d+)", output.stdout)
        require(
            output.returncode == 0 and match, "Rehearsal job has no running process."
        )
        return int(match[1])

    def stop_process(job, expected_path):
        process = pid(job)
        command = subprocess.run(
            ["/bin/ps", "-p", str(process), "-o", "command="],
            check=False,
            capture_output=True,
            text=True,
        )
        require(
            command.returncode == 0 and str(expected_path) in command.stdout,
            "Rehearsal process identity mismatch.",
        )
        os.kill(process, signal.SIGKILL)
        until = time.monotonic() + 45
        while time.monotonic() < until:
            try:
                if pid(job) != process:
                    return
            except InstallationError:
                pass
            time.sleep(0.2)
        raise InstallationError("Disposable job did not restart after crash.")

    complete = False
    try:
        for kind in ("database", "server"):
            require(
                launch("bootstrap", domain, generation / f"{kind}.plist").returncode
                == 0,
                "Could not load disposable rehearsal job.",
            )
        wait_ready()
        command = [
            generation / "bin/aether-native-host",
            "verify-store",
            "--config",
            generation / "installation.json",
        ]
        before = json.loads(run(command, env=env))
        require(
            before == report["integrity"],
            "Supervised service integrity differs from recovery.",
        )
        stop_process(jobs[0], generation / "bin/aether-native-host")
        wait_ready()
        stop_process(jobs[1], root / "postgres")
        wait_ready()
        after = json.loads(run(command, env=env))
        require(after == before, "Integrity changed after supervised crash recovery.")
        complete = True
    finally:
        # Exact random labels only. Never unload an existing production job.
        for job in jobs:
            launch("bootout", job)
        # bootout removes registration before all children finish draining.
        # Wait for PostgreSQL's clean checkpoint/PID-file removal as well.
        until = time.monotonic() + 50
        stopped = False
        while time.monotonic() < until:
            stopped = all(launch("print", job).returncode != 0 for job in jobs)
            if stopped and not (root / "postgres/postmaster.pid").exists():
                break
            time.sleep(0.2)
        require(
            stopped and not (root / "postgres/postmaster.pid").exists(),
            "Retain rehearsal files: service shutdown needs attention.",
        )
        shutil.rmtree(socket_root)
    result = {
        "macos_launchd": True,
        "private_configuration": True,
        "host_crash_restart": complete,
        "database_crash_restart": complete,
        "integrity": before,
        "services_stopped": True,
        "live_authorities_changed": False,
    }
    write(attempt / "supervision-report.json", json.dumps(result, indent=2).encode())
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("restored", "host-binary", "postgres-bin"):
        parser.add_argument("--" + name, type=Path, required=True)
    os.umask(0o077)
    try:
        print(json.dumps(rehearse(**vars(parser.parse_args())), indent=2))
    except (
        InstallationError,
        OSError,
        ValueError,
        KeyError,
        subprocess.SubprocessError,
    ):
        raise SystemExit(
            "Disposable supervision rehearsal failed. Inspect the private target; no production label or port was selected."
        ) from None

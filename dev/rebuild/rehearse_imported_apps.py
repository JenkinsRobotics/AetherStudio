"""Read imported demo files through a fully configured native executable.

Use only a disposable, stopped target produced by native_installation restore or
prepare_demo_target's verified import/independent dump restore.
Temporary sessions exercise imported ownership without changing original account
passwords. This does not claim an original-password sign-in or perform cutover.
"""

import argparse
import base64
import hashlib
import json
import os
import secrets
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
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
from rehearse_native_installation import launch


def rehearse(restored, host_binary, postgres_bin, adapters, *, launchd=False):
    require(not launchd or sys.platform == "darwin", "Launchd requires macOS.")
    root = private(restored, directory=True)
    if (root / "recovery-report.json").exists():
        recovery = json.loads(private(root / "recovery-report.json").read_text())
        require(
            recovery.get("database_stopped") is True, "A restored target is required."
        )
        database_user = "aether_recovery"
        attachments, workspaces = root / "attachments", root / "workspaces"
    else:
        transfer = json.loads(private(root / "transfer-report.json").read_text())
        require(
            transfer.get("target_running") is False
            and transfer.get("native_integrity") == "passed"
            and transfer.get("record_comparison") == "passed"
            and transfer.get("dump_restore") == "passed",
            "A verified stopped imported target is required.",
        )
        database_user = "aether_migration"
        attachments = root / "legacy-assets/drive/blobs"
        workspaces = root / "legacy-assets/workspaces"
    require(not (root / "postgres/postmaster.pid").exists(), "Target must be stopped.")
    extra = json.loads(private(adapters).read_text())
    require(
        set(extra)
        == {
            "AETHER_NATIVE_FRONTENDS",
            "AETHER_NATIVE_PRODUCTS",
            "AETHER_NATIVE_ANIMATION",
            "AETHER_NATIVE_MAP_DOWNLOADS",
        },
        "Supply only the four installed app manifests.",
    )
    require(
        all(
            isinstance(v, str) and Path(v).is_absolute() and Path(v).is_file()
            for v in extra.values()
        ),
        "Installed manifests must exist at absolute paths.",
    )
    attempt = root / ("applications-" + secrets.token_hex(8))
    attempt.mkdir(mode=0o700)
    env = safe_environment()
    bins, host = Path(postgres_bin).resolve(), Path(host_binary).resolve()
    require(host.is_file() and os.access(host, os.X_OK), "Native executable required.")
    process = None
    service_job = None
    credentials = []
    with tempfile.TemporaryDirectory(prefix="aether-apps-", dir="/tmp") as socket_root:
        pg_env = {
            **env,
            "PGHOST": socket_root,
            "PGPORT": "5432",
            "PGUSER": database_user,
            "PGDATABASE": "postgres",
        }

        def sql(statement):
            result = subprocess.run(
                [str(bins / "psql"), "-X", "-qAt", "-v", "ON_ERROR_STOP=1"],
                input=statement.encode(),
                check=False,
                env=pg_env,
                capture_output=True,
                timeout=60,
            )
            require(result.returncode == 0, "Disposable SQL verification failed.")
            return result.stdout.decode().strip()

        def literal(value):
            return "'" + value.replace("'", "''") + "'"

        try:
            run(
                [
                    bins / "pg_ctl",
                    "-D",
                    root / "postgres",
                    "-l",
                    attempt / "postgres.log",
                    "-o",
                    f"-k {socket_root} -h ''",
                    "-w",
                    "start",
                ],
                env=env,
            )
            tenant = sql("SELECT DISTINCT tenant FROM aether_identity.users;")
            require(
                tenant and "\n" not in tenant,
                "Exactly one imported tenant is required.",
            )
            accounts_before = sql(
                "SELECT md5(string_agg(row_to_json(u)::text,',' ORDER BY id)) FROM aether_identity.users u;"
            )
            owners = json.loads(
                sql(
                    "SELECT coalesce(json_agg(row_to_json(u)),'[]') FROM (SELECT id,active,must_change FROM aether_identity.users ORDER BY id) u;"
                )
            )
            with socket.socket() as reservation:
                reservation.bind(("127.0.0.1", 0))
                port = reservation.getsockname()[1]
            require(port not in (8780, 8781), "Production ports are excluded.")
            origin = f"http://127.0.0.1:{port}"
            config = attempt / "installation.json"
            write(
                config,
                json.dumps(
                    {
                        "schema": 1,
                        "environment": {
                            **extra,
                            "AETHER_NATIVE_PG": f"host={socket_root} user={database_user} dbname=postgres",
                            "AETHER_NATIVE_TENANT": tenant,
                            "AETHER_NATIVE_OBJECTS": str(root / "objects"),
                            "AETHER_NATIVE_ATTACHMENTS": str(attachments),
                            "AETHER_NATIVE_WORKSPACES": str(workspaces),
                            "AETHER_NATIVE_LISTEN": f"127.0.0.1:{port}",
                            "AETHER_NATIVE_INSTANCE": attempt.name,
                        },
                    }
                ).encode(),
            )
            before = json.loads(
                run([host, "verify-store", "--config", config], env=env)
            )
            log_path = attempt / "host.log"
            write(log_path, b"")
            if launchd:
                label = "com.aether.studio.apps-" + secrets.token_hex(8)
                domain = f"gui/{os.getuid()}"
                generation = attempt / "services"
                plan(
                    host,
                    config,
                    bins,
                    root / "postgres",
                    socket_root,
                    generation,
                    label,
                )
                require(
                    launch("bootstrap", domain, generation / "server.plist").returncode
                    == 0,
                    "Disposable native service could not start.",
                )
                service_job = f"{domain}/{label}.server"
            else:
                with log_path.open("ab") as log:
                    process = subprocess.Popen(
                        [str(host), "serve", "--config", str(config)],
                        env=env,
                        stdout=log,
                        stderr=log,
                    )
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

            def request(path, token=None, body=None):
                headers = {"Origin": origin}
                if token:
                    headers["Cookie"] = "aether_native_session=" + token
                if body is not None:
                    headers["Content-Type"] = "application/json"
                req = urllib.request.Request(
                    origin + path,
                    data=None if body is None else json.dumps(body).encode(),
                    headers=headers,
                )
                try:
                    with opener.open(req, timeout=45) as response:
                        return response.status, json.load(response)
                except urllib.error.HTTPError as error:
                    return error.code, None

            until = time.monotonic() + 50
            while True:
                require(
                    process.poll() is None
                    if process
                    else launch("print", service_job).returncode == 0,
                    "Disposable native host exited; inspect its private log.",
                )
                try:
                    if request("/api/status")[1].get("ready"):
                        break
                except OSError:
                    pass
                require(time.monotonic() < until, "Disposable host startup timed out.")
                time.sleep(0.2)
            verified, folders, restricted, browser_accounts = 0, 0, 0, []
            for owner in owners:
                token = secrets.token_hex(32)
                token_hash = hashlib.sha256(token.encode()).hexdigest()
                credentials.append(token_hash)
                sql(
                    f"INSERT INTO aether_identity.sessions(tenant,token_hash,user_id,expires) VALUES({literal(tenant)},{literal(token_hash)},{literal(owner['id'])},clock_timestamp()+interval '1 hour');"
                )
                status_code, status = request("/api/status", token)
                require(status_code == 200, "Imported account status failed.")
                apps = {a["id"] for a in status["apps"]}
                require(
                    all(a["runtime_ready"] for a in status["apps"]),
                    "An imported account has a missing app runtime.",
                )
                entries = json.loads(
                    sql(
                        f"SELECT coalesce(json_agg(row_to_json(e)),'[]') FROM (SELECT r.id,r.app,r.kind,r.trashed,d.head_revision,v.metadata FROM aether_access.resources r LEFT JOIN aether_store.documents d ON d.tenant=r.tenant AND d.id=r.id LEFT JOIN aether_store.revisions v ON v.tenant=d.tenant AND v.document_id=d.id AND v.revision=d.head_revision WHERE r.tenant={literal(tenant)} AND r.owner={literal(owner['id'])} ORDER BY r.id) e;"
                    )
                )
                browser_account = {"token": token, "map": None, "cad": None}
                browser_sizes = {"map": -1, "cad": -1}
                for entry in entries:
                    if entry["trashed"] or entry["app"] not in apps:
                        restricted += 1
                        continue
                    if entry["kind"] == "folder":
                        code, _ = request(
                            "/api/drive/details", token, {"id": entry["id"]}
                        )
                        require(
                            code == 200, "Imported folder is inaccessible to its owner."
                        )
                        folders += 1
                        continue
                    expected_hash = entry["metadata"]["content_sha256"]
                    if entry["app"] == "drive":
                        require(
                            len(expected_hash) == 64
                            and all(c in "0123456789abcdef" for c in expected_hash),
                            "Invalid imported content hash.",
                        )
                        descriptor = (
                            root
                            / "objects/v1"
                            / hashlib.sha256(tenant.encode()).hexdigest()
                            / expected_hash
                        ).read_bytes()
                        require(
                            hashlib.sha256(descriptor).hexdigest() == expected_hash,
                            "Imported Drive descriptor differs.",
                        )
                        try:
                            value = json.loads(descriptor)
                        except (ValueError, UnicodeError):
                            value = None
                        if isinstance(value, dict) and "aether_drive_blob" in value:
                            expected_hash = value["aether_drive_blob"]
                        code, value = request(
                            "/api/drive/read", token, {"id": entry["id"]}
                        )
                    else:
                        code, value = request(
                            "/api/library/read",
                            token,
                            {"app": entry["app"], "id": entry["id"]},
                        )
                    require(
                        code == 200,
                        f"Imported {entry['app']} file read returned HTTP {code}.",
                    )
                    content = base64.b64decode(value["data_base64"], validate=True)
                    require(
                        value["revision"] == entry["head_revision"]
                        and hashlib.sha256(content).hexdigest() == expected_hash,
                        "Imported file HTTP read differs from stored head.",
                    )
                    verified += 1
                    if (
                        entry["app"] in browser_sizes
                        and len(content) > browser_sizes[entry["app"]]
                    ):
                        browser_account[entry["app"]] = entry["id"]
                        browser_sizes[entry["app"]] = len(content)
                browser_accounts.append(browser_account)
            require(verified > 0, "No imported files were qualified.")
            browser_input = attempt / "browser-input.json"
            write(
                browser_input,
                json.dumps({"origin": origin, "accounts": browser_accounts}).encode(),
            )
            browser = subprocess.run(
                [
                    "node",
                    str(Path(__file__).with_name("imported_apps_browser.mjs")),
                    str(browser_input),
                ],
                env=env,
                check=False,
                capture_output=True,
                timeout=120,
            )
            write(attempt / "browser.log", browser.stdout + browser.stderr)
            require(
                browser.returncode == 0,
                "Imported app browser qualification failed; inspect the private report.",
            )
            browser_report = json.loads(browser.stdout)
            after = json.loads(run([host, "verify-store", "--config", config], env=env))
            require(
                before == after,
                "Browser opening unexpectedly changed document history.",
            )
            require(
                accounts_before
                == sql(
                    "SELECT md5(string_agg(row_to_json(u)::text,',' ORDER BY id)) FROM aether_identity.users u;"
                ),
                "Original account records changed during rehearsal.",
            )
            report = {
                "schema": 1,
                "imported_users": len(owners),
                "file_heads_verified_over_http": verified,
                "folders_verified_over_http": folders,
                "restricted_or_trashed_entries": restricted,
                "integrity": after,
                "accounts_unchanged": True,
                "browser": browser_report,
                "original_password_signin": "not exercised; temporary sessions only",
                "live_installations_changed": False,
                "server_supervisor": "launchd" if launchd else "foreground",
            }
        finally:
            service_stopped = True
            if service_job is not None:
                service_stopped = launch("bootout", service_job).returncode == 0
            if process is not None:
                process.terminate()
                try:
                    process.wait(timeout=50)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=10)
            if (root / "postgres/postmaster.pid").exists():
                try:
                    if credentials:
                        sql(
                            "DELETE FROM aether_identity.sessions WHERE token_hash IN ("
                            + ",".join(literal(c) for c in credentials)
                            + ");"
                        )
                finally:
                    run(
                        [
                            bins / "pg_ctl",
                            "-D",
                            root / "postgres",
                            "-m",
                            "fast",
                            "-w",
                            "stop",
                        ],
                        env=env,
                    )
            if (attempt / "browser-input.json").exists():
                (attempt / "browser-input.json").unlink()
            require(service_stopped, "Disposable native service shutdown failed.")
        require(
            not (root / "postgres/postmaster.pid").exists(),
            "Database shutdown incomplete.",
        )
        report["database_stopped"] = True
        write(
            attempt / "application-report.json",
            (json.dumps(report, indent=2) + "\n").encode(),
        )
        return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("restored", "host-binary", "postgres-bin", "adapters"):
        parser.add_argument("--" + name, type=Path, required=True)
    parser.add_argument(
        "--launchd",
        action="store_true",
        help="Qualify the macOS service plan, including its scheduling policy.",
    )
    args = parser.parse_args()
    try:
        print(
            json.dumps(
                rehearse(
                    args.restored,
                    args.host_binary,
                    args.postgres_bin,
                    args.adapters,
                    launchd=args.launchd,
                )
            )
        )
    except (
        InstallationError,
        OSError,
        ValueError,
        subprocess.SubprocessError,
    ) as error:
        raise SystemExit(
            "Imported app rehearsal failed; retain the private target for diagnosis."
        ) from error

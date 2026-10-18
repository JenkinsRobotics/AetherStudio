"""Prepare and verify a private, stopped native target; never cut over a server."""
import argparse
import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from legacy_map import file_digest
from legacy_transfer import (
    ROOT,
    TransferError,
    compare,
    digest,
    encoded,
    import_snapshot,
    load,
    pg,
    private_write,
    require,
    sql_import,
    sync_tree,
)
from native_backup import IDENTITY_CREDENTIAL_EXCLUSIONS
from postgres_check import pg_bin


def prepare(snapshot, target, binary=None):
    snapshot, target = snapshot.resolve(), target.absolute()
    require(not target.exists() and snapshot not in target.parents, "Choose a new target outside the snapshot.")
    data, blobs, manifest = load(snapshot)
    binaries = pg_bin()
    binary = Path(binary).resolve() if binary is not None else ROOT / "target/debug/aether-native-host"
    require(binary.is_file(), "Build the native host before preparing a target.")
    target.mkdir(mode=0o700)
    database, objects = target / "postgres", target / "objects"
    objects.mkdir(mode=0o700)
    command = [str(binaries / "initdb"), "-D", str(database), "-U", "aether_migration",
               "--auth=trust", "--no-locale", "--encoding=UTF8"]
    share = binaries.parent / "share/postgresql"
    if (share / "postgres.bki").is_file():
        command += ["-L", str(share)]
    subprocess.run(command, check=True, capture_output=True)
    # A later accidental start must not expose trust authentication over TCP or
    # a public default socket. An operator must supply a private socket explicitly.
    with (database / "postgresql.conf").open("a") as config:
        config.write("\nlisten_addresses = ''\nunix_socket_directories = ''\n")
        config.flush()
        os.fsync(config.fileno())
    with tempfile.TemporaryDirectory(prefix="aether-transfer-", dir="/tmp") as socket:
        started = False
        try:
            subprocess.run([str(binaries / "pg_ctl"), "-D", str(database), "-l", str(target / "postgres.log"),
                            "-o", f"-k {socket} -h ''", "-w", "start"], check=True, capture_output=True)
            started = True
            dsn = f"host={socket} user=aether_migration dbname=postgres"
            env = {**os.environ, "AETHER_NATIVE_PG": dsn, "AETHER_NATIVE_TENANT": "demo",
                   "AETHER_NATIVE_OBJECTS": str(objects)}
            subprocess.run([str(binary), "migrate"], check=True, env=env, capture_output=True)
            report = import_snapshot(snapshot, objects, "demo", dsn, binaries / "psql", binary)
            shutil.copytree(snapshot / "assets", target / "legacy-assets")
            for name, sha in manifest["files"].items():
                if name.startswith("assets/"):
                    copied = target / "legacy-assets" / name.removeprefix("assets/")
                    require(file_digest(copied, require) == sha, "Copied asset verification failed.")
            # A portable dump, not only a machine/version-specific data directory.
            dump = target / "native.sql"
            with dump.open("xb") as stream:
                os.chmod(dump, 0o600)
                subprocess.run([str(binaries / "pg_dump"), "--dbname", dsn, "--no-owner", "--no-privileges", *IDENTITY_CREDENTIAL_EXCLUSIONS],
                               check=True, stdout=stream, stderr=subprocess.PIPE)
                stream.flush()
                os.fsync(stream.fileno())
            # Restore the actual imported demo into another database and content root.
            pg(binaries / "psql", dsn, "CREATE DATABASE recovery_check")
            recovery_dsn = dsn.replace("dbname=postgres", "dbname=recovery_check")
            pg(binaries / "psql", recovery_dsn, dump.read_text())
            for h in data["library_history"]:
                h["size_bytes"] = len(blobs[h["blob_hash"]])
            _, expected = sql_import(data, "demo")
            compare(binaries / "psql", recovery_dsn, expected)
            with tempfile.TemporaryDirectory(prefix="aether-restored-", dir=target) as restored:
                restored_objects = Path(restored) / "objects"
                shutil.copytree(objects, restored_objects)
                subprocess.run([str(binary), "verify-store"], check=True, capture_output=True,
                               env={**env, "AETHER_NATIVE_PG": recovery_dsn,
                                    "AETHER_NATIVE_OBJECTS": str(restored_objects)})
            # Keep the recovery-check database as evidence; nothing is dropped.
            report.update({"snapshot": str(snapshot), "target": str(target), "tenant": "demo",
                           "host_binary_sha256": file_digest(binary, require),
                           "dump_sha256": digest(dump.read_bytes()), "dump_restore": "passed",
                           "original_server_unchanged": True,
                           "attachment_files": len(list((target / "legacy-assets/drive/blobs").glob("*"))),
                           "workspace_asset_files": sum(p.is_file() for p in (target / "legacy-assets/workspaces").rglob("*")),
                           "limitations": ["point-in-time staging: recapture after stopping writes before cutover",
                                           "legacy assets retained; native attachment and workspace reads require explicit private snapshot configuration; new native uploads use object-store chunks; in-flight legacy uploads are not imported",
                                           "account preferences and server name/theme imported; provision native network/TLS and private runtime configuration separately",
                                           "Main and provable branch history, named checkpoints, collaboration and workspace preferences imported; ambiguous name-only lineage requires review",
                                           "requires a fresh login; old sessions and recovery tokens are not activated"]})
        finally:
            if started:
                subprocess.run([str(binaries / "pg_ctl"), "-D", str(database), "-m", "fast", "-w", "stop"],
                               check=True, capture_output=True)
    report["target_running"] = False
    private_write(target / "transfer-report.json", encoded(report).encode())
    # Do not hash transient PG state as a portable backup; native.sql + objects
    # and legacy-assets are the recovery set. All are private to the operator.
    recovery = {str(p.relative_to(target)): file_digest(p, require)
                for area in (objects, target / "legacy-assets") for p in sorted(area.rglob("*")) if p.is_file()}
    recovery["native.sql"] = digest((target / "native.sql").read_bytes())
    private_write(target / "recovery-manifest.json", encoded(recovery).encode())
    sync_tree(target)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--snapshot", type=Path, required=True)
    parser.add_argument("--target", type=Path, required=True)
    parser.add_argument("--host-binary", type=Path, help="Explicit qualified native executable; defaults to the development build")
    args = parser.parse_args()
    os.umask(0o077)
    try:
        print(json.dumps(prepare(args.snapshot, args.target, args.host_binary), indent=2))
    except (TransferError, OSError, subprocess.SubprocessError, ValueError, KeyError):
        raise SystemExit("Target preparation failed. Original remains authoritative; retain the incomplete target for diagnosis. No secret details logged.") from None


if __name__ == "__main__":
    main()

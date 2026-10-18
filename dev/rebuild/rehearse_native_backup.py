"""Exercise the Rust backup command against a staged demo and independently restore it.

Only a disposable PostgreSQL cluster is started. Neither live authority nor the
staged cluster is started or changed. The new backup is retained at the explicit
destination. Connection details, identities and content never enter the report.
"""
import argparse
import json
import os
import subprocess
import tempfile
from pathlib import Path

from legacy_map import file_digest
from legacy_transfer import ROOT, TransferError, require
from postgres_check import pg_bin


def rehearse(source, destination):
    source, destination = source.resolve(), destination.absolute()
    require(not destination.exists(), "Choose a new backup destination.")
    manifest = json.loads((source / "recovery-manifest.json").read_text())
    for name, digest in manifest.items():
        relative = Path(name)
        require(not relative.is_absolute() and ".." not in relative.parts, "Unsafe source manifest.")
        require(file_digest(source / relative, require) == digest, "Staged source integrity failed.")
    binaries = pg_bin()
    host = ROOT / "target/debug/aether-native-host"
    tenant = json.loads((source / "transfer-report.json").read_text())["tenant"]
    with tempfile.TemporaryDirectory(prefix="aether-backup-", dir="/tmp") as temporary:
        root = Path(temporary)
        data = root / "postgres"
        init = [str(binaries / "initdb"), "-D", str(data), "-U", "aether_backup", "--auth=trust", "--no-locale", "--encoding=UTF8"]
        share = binaries.parent / "share/postgresql"
        if (share / "postgres.bki").is_file():
            init += ["-L", str(share)]
        subprocess.run(init, check=True, capture_output=True)
        started = False
        try:
            subprocess.run([str(binaries / "pg_ctl"), "-D", str(data), "-l", str(root / "postgres.log"), "-o", f"-k {root} -h ''", "-w", "start"], check=True, capture_output=True)
            started = True
            env = {**{key: value for key, value in os.environ.items() if not key.startswith(("PG", "AETHER_NATIVE_"))}, "PGHOST": str(root), "PGPORT": "5432", "PGUSER": "aether_backup", "PGDATABASE": "postgres"}
            with (source / "native.sql").open("rb") as dump:
                subprocess.run([str(binaries / "psql"), "-X", "-v", "ON_ERROR_STOP=1"], stdin=dump, env=env, check=True, capture_output=True)
            native = {**env, "AETHER_NATIVE_PG": f"host={root} user=aether_backup dbname=postgres", "AETHER_NATIVE_TENANT": tenant, "AETHER_NATIVE_OBJECTS": str(source / "objects"), "AETHER_NATIVE_PG_DUMP": str(binaries / "pg_dump"), "AETHER_NATIVE_BACKUP_DESTINATION": str(destination), "AETHER_NATIVE_ATTACHMENTS": str(source / "legacy-assets/drive/blobs"), "AETHER_NATIVE_WORKSPACES": str(source / "legacy-assets/workspaces")}
            # Upgrade only the disposable restored database, never the staged source.
            subprocess.run([str(host), "migrate"], env=native, check=True, capture_output=True)
            before = json.loads(subprocess.check_output([str(host), "verify-store"], env=native, stderr=subprocess.PIPE))
            subprocess.run([str(host), "backup"], env=native, check=True, capture_output=True)
            recovery = json.loads((destination / "manifest.json").read_text())
            for name, item in recovery["files"].items():
                relative = Path(name)
                require(not relative.is_absolute() and ".." not in relative.parts, "Unsafe backup manifest.")
                require((destination / relative).stat().st_size == item["size"] and file_digest(destination / relative, require) == item["sha256"], "Native backup integrity failed.")
            subprocess.run([str(binaries / "psql"), "-X", "-v", "ON_ERROR_STOP=1", "-c", "CREATE DATABASE restored"], env=env, check=True, capture_output=True)
            with (destination / "native.sql").open("rb") as dump:
                subprocess.run([str(binaries / "psql"), "-X", "-v", "ON_ERROR_STOP=1"], stdin=dump, env={**env, "PGDATABASE": "restored"}, check=True, capture_output=True)
            after = json.loads(subprocess.check_output([str(host), "verify-store"], env={**native, "AETHER_NATIVE_PG": f"host={root} user=aether_backup dbname=restored", "AETHER_NATIVE_OBJECTS": str(destination / "objects")}, stderr=subprocess.PIPE))
            require(before == after, "Restored integrity counts differ.")
            counts = subprocess.check_output([str(binaries / "psql"), "-X", "-A", "-t", "-c", "SELECT (SELECT count(*) FROM aether_identity.users), (SELECT count(*) FROM aether_identity.sessions), (SELECT count(*) FROM aether_identity.recovery), (SELECT count(*) FROM aether_identity.agent_connections)"], env={**env, "PGDATABASE": "restored"}, stderr=subprocess.PIPE).decode().strip().split("|")
            require(counts[1:] == ["0", "0", "0"], "Live credentials survived recovery.")
            for name, digest in manifest.items():
                require(file_digest(source / name, require) == digest, "Staged source changed during rehearsal.")
            return {"native_backup": "passed", "independent_restore": "passed", "users": int(counts[0]), "integrity": after, "snapshot_files": len(recovery["files"]), "live_credentials_restored": False, "live_authorities_unchanged": True, "staged_source_unchanged": True, "backup_destination": str(destination)}
        finally:
            if started:
                subprocess.run([str(binaries / "pg_ctl"), "-D", str(data), "-m", "fast", "-w", "stop"], check=True, capture_output=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--destination", type=Path, required=True)
    arguments = parser.parse_args()
    os.umask(0o077)
    try:
        print(json.dumps(rehearse(arguments.source, arguments.destination), indent=2))
    except (TransferError, OSError, ValueError, KeyError, subprocess.SubprocessError):
        raise SystemExit("Native backup rehearsal failed; live authorities were not modified. Retain the private destination for diagnosis.") from None
